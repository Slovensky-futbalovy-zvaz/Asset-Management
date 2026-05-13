/**
 * Audit log service — high-level "record an event" API.
 *
 * Wraps `AuditLogRepository` with a small builder that:
 *   1. Normalizes timestamps (always `new Date().toISOString()`)
 *   2. Snapshots actor details from `currentUser` so the audit log
 *      reflects who they were AT THE TIME (their displayName may change)
 *   3. Sets sensible defaults (severity=INFO, isPseudonymized=false)
 *
 * Transactional usage:
 *   The `record(...)` method accepts an optional `ClientSession`. When
 *   the caller passes one, the audit insert participates in the same
 *   transaction as the business-data write. Aborting the transaction
 *   rolls back BOTH atomically — no orphan audit records, no missing
 *   audit records.
 *
 * Non-transactional usage:
 *   Omit the session for fire-and-forget logging (e.g. login events
 *   where atomicity with the User document is overkill).
 */

import type { AuditLogRepository } from './audit.repository.js';
import type { AuditLog, User } from '@sfz/shared-types';
import type { FastifyRequest } from 'fastify';
import type { ClientSession, WithId } from 'mongodb';

// ---------------------------------------------------------------------------
// Public API types
// ---------------------------------------------------------------------------

/**
 * Subset of `AuditLog` fields the caller must provide. Everything else
 * (`at`, `actor`, `isPseudonymized`) is filled in by the service.
 */
export interface RecordEventInput {
  action: AuditLog['action'];
  target: AuditLog['target'];
  description: string;
  changes?: AuditLog['changes'];
  metadata?: AuditLog['metadata'];
  severity?: AuditLog['severity'];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AuditLogService {
  constructor(private readonly repo: AuditLogRepository) {}

  /**
   * Record an audit event for a user-initiated action.
   *
   * Pass `session` to make the insert part of a multi-document transaction
   * — strongly recommended for any state-changing business operation
   * (asset CRUD, loan transitions, role changes).
   *
   * The `request` parameter is used only for snapshotting actor metadata
   * (IP, User-Agent). It's optional for background/system actions; pass
   * `null` and the metadata fields will be set to `null`.
   */
  async record(
    user: WithId<User>,
    request: FastifyRequest | null,
    input: RecordEventInput,
    session?: ClientSession,
  ): Promise<void> {
    const record: Omit<AuditLog, '_id'> = {
      at: new Date().toISOString(),
      actor: {
        userId: String(user._id),
        displayName: user.displayName,
        accountType: user.accountType,
        ipAddress: request ? extractIpAddress(request) : null,
        userAgent: request ? extractUserAgent(request) : null,
      },
      action: input.action,
      target: input.target,
      description: input.description,
      changes: input.changes ?? null,
      metadata: input.metadata ?? {},
      severity: input.severity ?? 'INFO',
      isPseudonymized: false,
    };

    await this.repo.insert(record, session);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the client IP from a Fastify request.
 *
 * Fastify's `request.ip` honours `trustProxy` (set in server.ts), which
 * means on Vercel it returns the real client IP from `X-Forwarded-For`
 * rather than the Vercel edge IP.
 *
 * We truncate to 45 chars (max IPv6 length) to match the schema constraint.
 */
function extractIpAddress(request: FastifyRequest): string | null {
  const ip = request.ip;
  if (!ip) return null;
  // Drop trailing nulls / placeholders some proxies emit
  if (ip === '::1' || ip === '127.0.0.1') return ip;
  return ip.slice(0, 45);
}

/**
 * Extracts and truncates the User-Agent header. Schema cap is 500 chars.
 */
function extractUserAgent(request: FastifyRequest): string | null {
  const ua = request.headers['user-agent'];
  if (typeof ua !== 'string') return null;
  return ua.slice(0, 500);
}
