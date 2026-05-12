/**
 * Users service — business logic for user management.
 *
 * Slice #2 scope: just-in-time provisioning. When a request comes in with
 * a validated Entra ID JWT, we either:
 *   - find the existing user (matched by `entraOid`), or
 *   - create a new user record with sensible defaults
 *
 * Default role for JIT-provisioned users is `EMPLOYEE`. Admins promote
 * users to higher roles by editing the DB directly (slice #2b will add
 * a proper admin UI / endpoint).
 *
 * Future slices will add:
 *   - Soft delete (deactivation)
 *   - Role management endpoints
 *   - LOCAL account creation (for external users without Entra accounts)
 *   - Organizational unit assignment
 */

import { AccountType, UserRole, type User } from '@sfz/shared-types';

import type { UsersRepository } from './users.repository.js';
import type { EntraClaims } from '../../plugins/auth.js';
import type { WithId } from 'mongodb';

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class UsersService {
  constructor(private readonly repo: UsersRepository) {}

  /**
   * Find an existing user by their Entra OID, or provision a new one
   * from the JWT claims if no match is found.
   *
   * Concurrency note: between `findByEntraOid` and `insert`, another
   * request from the same user could attempt the same provisioning. We
   * rely on the `entraOid` unique index to make the second insert fail
   * with code 11000 (duplicate key); we catch that and re-query.
   */
  async findOrProvision(claims: EntraClaims): Promise<WithId<User>> {
    const existing = await this.repo.findByEntraOid(claims.oid);
    if (existing) {
      // Fire-and-forget: don't await `touchLastLogin` to keep auth latency
      // low. Failures are logged inside the repository.
      void this.repo.touchLastLogin(claims.oid);
      return existing;
    }

    const newUser = this.buildUserFromClaims(claims);

    try {
      return await this.repo.insert(newUser);
    } catch (err) {
      // MongoDB error code 11000 = duplicate key. This happens if two
      // concurrent requests for the same first-time user race to insert.
      // The "loser" of the race should just re-fetch what the "winner"
      // inserted.
      if (isDuplicateKeyError(err)) {
        const existingAfterRace = await this.repo.findByEntraOid(claims.oid);
        if (existingAfterRace) {
          return existingAfterRace;
        }
      }
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Constructs a `User` document from validated Entra ID claims.
   *
   * Email is required for provisioning — if the token lacks both `email`
   * and `preferred_username`, we cannot satisfy the unique-email constraint.
   * In that case we throw, which surfaces as a 401 to the caller. The fix
   * is for the tenant admin to add `email` to the optional claims of the
   * API app registration (see Azure setup, Krok 5).
   */
  private buildUserFromClaims(claims: EntraClaims): Omit<User, '_id'> {
    const email = claims.email ?? claims.preferred_username;
    if (!email) {
      throw new Error(
        'Entra token lacks `email` and `preferred_username` claims — ' +
          'cannot JIT-provision. Add `email` to optional claims in the API app registration.',
      );
    }

    const { firstName, lastName, displayName } = splitName(claims);
    const now = new Date().toISOString();

    return {
      email: email.toLowerCase(),
      firstName,
      lastName,
      displayName,
      accountType: AccountType.ENTRA_ID,
      entraOid: claims.oid,
      passwordHash: null,
      roles: [UserRole.EMPLOYEE],
      organizationalUnit: null,
      teams: [],
      isActive: true,
      lastLoginAt: now,
      invitationSentAt: null,
      mustChangePassword: false,
      preferences: {
        language: 'sk',
        timezone: 'Europe/Bratislava',
        emailNotifications: true,
        pushNotifications: false,
      },
      // Audit fields: the user is "creating themselves" on first login,
      // so createdBy points at their own (yet-to-be-assigned) _id. We don't
      // know it until after insert — so use SYSTEM here. This is a
      // documented convention for JIT-provisioned users.
      createdAt: now,
      updatedAt: now,
      createdBy: 'SYSTEM',
      updatedBy: 'SYSTEM',
      deletedAt: null,
      deletedBy: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Plain-function helpers (no class state needed)
// ---------------------------------------------------------------------------

/**
 * Best-effort name parsing from Entra claims.
 *
 * Order of preference:
 *   1. `given_name` + `family_name` — most accurate (when configured)
 *   2. Split `name` on first space
 *   3. Fall back to the email local part
 */
function splitName(claims: EntraClaims): {
  firstName: string;
  lastName: string;
  displayName: string;
} {
  if (claims.given_name && claims.family_name) {
    return {
      firstName: claims.given_name,
      lastName: claims.family_name,
      displayName: claims.name ?? `${claims.given_name} ${claims.family_name}`,
    };
  }

  if (claims.name) {
    const parts = claims.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return {
        firstName: parts[0]!,
        lastName: parts.slice(1).join(' '),
        displayName: claims.name,
      };
    }
    return {
      firstName: parts[0] ?? 'Unknown',
      lastName: 'Unknown',
      displayName: claims.name,
    };
  }

  // Last resort: derive from email local part.
  const email = claims.email ?? claims.preferred_username ?? 'unknown@unknown';
  const localPart = email.split('@')[0] ?? 'unknown';
  return {
    firstName: localPart,
    lastName: 'Unknown',
    displayName: localPart,
  };
}

// Type guard for MongoDB duplicate-key errors.
function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 11000
  );
}
