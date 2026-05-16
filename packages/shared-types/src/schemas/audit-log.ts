import { z } from 'zod';

import { ObjectIdSchema, TimestampSchema } from './common.js';

/**
 * Audit log = nemenný (append-only) záznam o každej významnej akcii v systéme.
 *
 * Účel:
 * - Bezpečnostný/súdne použiteľný záznam ("kto, kedy, čo")
 * - Forenzika incidentov
 * - Compliance (GDPR čl. 30 — záznamy o spracovaní)
 *
 * Audit log sa NIKDY nemení ani nemaže. Záznamy sú write-only z aplikácie.
 * Iba systémový retention job ich môže pseudonymizovať po definovanej dobe.
 *
 * NEMÁ AuditFields ani SoftDelete — používa iba vlastný `_id` a `at`.
 */
export const AuditLogSchema = z.object({
  /** MongoDB _id. */
  _id: ObjectIdSchema,

  /** Tenant scope. Audit log entries always belong to exactly one tenant. */
  organisationId: ObjectIdSchema,

  /** Kedy sa udalosť stala (server time, UTC). */
  at: TimestampSchema,

  /** Kto akciu vykonal. "SYSTEM" pre automatizované úlohy. */
  actor: z.object({
    userId: z.union([ObjectIdSchema, z.literal('SYSTEM')]),
    displayName: z.string().max(200), // snapshot mena v čase akcie
    accountType: z.enum(['ENTRA_ID', 'LOCAL', 'SYSTEM']),
    ipAddress: z.string().max(45).nullable().default(null), // IPv4 alebo IPv6
    userAgent: z.string().max(500).nullable().default(null),
  }),

  /** Typ akcie. */
  action: z.enum([
    // Auth
    'USER_LOGIN',
    'USER_LOGIN_FAILED',
    'USER_LOGOUT',
    'USER_PASSWORD_CHANGED',
    'USER_PASSWORD_RESET_REQUESTED',
    'USER_MFA_ENABLED',
    'USER_MFA_DISABLED',

    // User management
    'USER_CREATED',
    'USER_UPDATED',
    'USER_DEACTIVATED',
    'USER_REACTIVATED',
    'USER_ROLE_GRANTED',
    'USER_ROLE_REVOKED',

    // Organisation (tenant lifecycle — admin only)
    'ORGANISATION_CREATED',
    'ORGANISATION_UPDATED',
    'ORGANISATION_DELETED',

    // Asset
    'ASSET_CREATED',
    'ASSET_UPDATED',
    'ASSET_DELETED',
    'ASSET_STATUS_CHANGED',
    'ASSET_LOCATION_CHANGED',
    'ASSET_DISPOSED',

    // Category (slice #3)
    'CATEGORY_CREATED',
    'CATEGORY_UPDATED',
    'CATEGORY_DELETED',

    // Location (slice #3)
    'LOCATION_CREATED',
    'LOCATION_UPDATED',
    'LOCATION_DELETED',

    // Loan
    'LOAN_REQUEST_CREATED',
    'LOAN_REQUEST_APPROVED',
    'LOAN_REQUEST_REJECTED',
    'LOAN_REQUEST_CANCELLED',
    'LOAN_PICKED_UP',
    'LOAN_RETURNED',
    'LOAN_EXTENDED',
    'LOAN_MARKED_OVERDUE',
    'LOAN_MARKED_LOST',

    // GDPR
    'DATA_EXPORT_REQUESTED',
    'DATA_DELETION_REQUESTED',
    'USER_PSEUDONYMIZED',

    // System
    'SYSTEM_CONFIG_CHANGED',
    'BULK_IMPORT_EXECUTED',
    'INTEGRATION_TOKEN_CREATED',
    'INTEGRATION_TOKEN_REVOKED',
  ]),

  /** Cieľová entita akcie. */
  target: z
    .object({
      entityType: z.enum([
        'User',
        'Organisation',
        'Asset',
        'Loan',
        'LoanRequest',
        'Category',
        'Location',
        'System',
      ]),
      entityId: ObjectIdSchema.nullable(),
      snapshot: z.record(z.string(), z.unknown()).optional(), // snapshot kľúčových polí v čase
    })
    .nullable(),

  /** Stručný popis pre čítanie ľuďmi. */
  description: z.string().min(1).max(1000),

  /** Diff zmien (pre UPDATE akcie). */
  changes: z
    .array(
      z.object({
        field: z.string().max(200),
        before: z.unknown(),
        after: z.unknown(),
      }),
    )
    .nullable()
    .default(null),

  /** Voliteľný kontext / metadata. */
  metadata: z.record(z.string(), z.unknown()).default({}),

  /** Severity pre filtrovanie a alerty. */
  severity: z.enum(['INFO', 'WARNING', 'ERROR', 'CRITICAL']).default('INFO'),

  /** Či je záznam pseudonymizovaný (GDPR). */
  isPseudonymized: z.boolean().default(false),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

/**
 * Schéma pre vytvorenie audit log záznamu. Bez _id (generuje ho Mongo).
 */
export const CreateAuditLogSchema = AuditLogSchema.omit({ _id: true });

export type CreateAuditLogInput = z.infer<typeof CreateAuditLogSchema>;
