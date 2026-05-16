import { z } from 'zod';

import { AccountType, UserRole } from '../enums/user-role.js';

import {
  BaseDocumentSchema,
  EmailSchema,
  ObjectIdSchema,
  OrganisationScopedSchema,
  PhoneSchema,
  SoftDeleteSchema,
  TimestampSchema,
} from './common.js';

/**
 * Reprezentácia používateľa systému.
 *
 * Hlavné identitné polia:
 * - `email` — primárny identifikátor, unique
 * - `accountType` — určuje spôsob prihlásenia (Entra SSO vs lokálne heslo)
 * - `entraOid` — Object ID z Microsoft Entra (povinné pre ENTRA_ID účty)
 *
 * Bezpečnostné polia (`passwordHash`, `passwordSalt`, `mfaSecret`) sa NIKDY
 * neserializujú do API response — repository vrstva ich odfiltruje cez projekcie.
 */
export const UserSchema = BaseDocumentSchema.merge(SoftDeleteSchema)
  .merge(OrganisationScopedSchema)
  .extend({
    /** Primárny e-mail (unique, lowercase, normalizovaný). */
    email: EmailSchema,

    /** Krstné meno. */
    firstName: z
      .string()
      .min(1, 'Meno je povinné.')
      .max(100, 'Meno je príliš dlhé (max 100 znakov).')
      .trim(),

    /** Priezvisko. */
    lastName: z
      .string()
      .min(1, 'Priezvisko je povinné.')
      .max(100, 'Priezvisko je príliš dlhé (max 100 znakov).')
      .trim(),

    /** Display name — celé meno, pre UI. */
    displayName: z.string().min(1).max(200).trim(),

    /** Telefón. Voliteľný, ale silne odporúčaný (pre notifikácie). */
    phone: PhoneSchema.optional(),

    /** Typ účtu — určuje spôsob autentifikácie. */
    accountType: z.enum(
      Object.values(AccountType) as [string, ...string[]],
    ) as z.ZodType<AccountType>,

    /** Microsoft Entra ID Object ID — povinné pre ENTRA_ID účty, null pre LOCAL. */
    entraOid: z.string().uuid().nullable().default(null),

    /** Hash hesla (bcrypt/argon2). Len pre LOCAL účty. NIKDY do API response. */
    passwordHash: z.string().nullable().default(null),

    /** Roly používateľa. Používateľ môže mať viacero rolí naraz. */
    roles: z
      .array(z.enum(Object.values(UserRole) as [string, ...string[]]) as z.ZodType<UserRole>)
      .min(1, 'Používateľ musí mať aspoň jednu rolu.'),

    /** ID organizačnej jednotky / útvaru SFZ (alebo klubu pre EXTERNAL). */
    organizationalUnit: z
      .object({
        id: ObjectIdSchema,
        name: z.string().min(1).max(200),
        type: z.enum(['SFZ_DEPARTMENT', 'NATIONAL_TEAM', 'CLUB', 'EXTERNAL_ORG']),
      })
      .nullable()
      .default(null),

    /** Tímy, ktorých je členom (pre TEAM_MANAGER). */
    teams: z
      .array(
        z.object({
          teamId: ObjectIdSchema,
          teamName: z.string().min(1).max(200),
          role: z.enum(['MEMBER', 'MANAGER', 'COACH', 'ASSISTANT']),
        }),
      )
      .default([]),

    /** Či je účet aktívny (povolený prihlásiť sa). */
    isActive: z.boolean().default(true),

    /** Posledné prihlásenie. */
    lastLoginAt: TimestampSchema.nullable().default(null),

    /** Posledné odoslanie aktivačného e-mailu (pre LOCAL účty). */
    invitationSentAt: TimestampSchema.nullable().default(null),

    /** Či musí používateľ pri ďalšom prihlásení zmeniť heslo (pre LOCAL). */
    mustChangePassword: z.boolean().default(false),

    /** Preferencie používateľa. */
    preferences: z
      .object({
        language: z.enum(['sk', 'en']).default('sk'),
        timezone: z.string().default('Europe/Bratislava'),
        emailNotifications: z.boolean().default(true),
        pushNotifications: z.boolean().default(false),
      })
      .default({}),
  });

export type User = z.infer<typeof UserSchema>;

/**
 * Schéma pre vytvorenie nového používateľa cez API.
 * Bez audit fields (tie generuje server) a bez bezpečnostných polí.
 */
export const CreateUserSchema = UserSchema.omit({
  _id: true,
  organisationId: true, // Server-provided from authenticated context
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  deletedAt: true,
  deletedBy: true,
  passwordHash: true,
  lastLoginAt: true,
  invitationSentAt: true,
}).extend({
  /** Pre LOCAL účty — počiatočné heslo. Musí byť zaslané cez secure channel. */
  initialPassword: z.string().min(12).max(128).optional(),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

/**
 * Schéma pre update používateľa — všetky polia voliteľné okrem identity.
 */
export const UpdateUserSchema = UserSchema.omit({
  _id: true,
  organisationId: true, // Tenant scope is immutable
  email: true, // E-mail sa nemení (alebo cez special flow)
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  deletedAt: true,
  deletedBy: true,
  passwordHash: true,
  accountType: true,
  entraOid: true,
}).partial();

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

/**
 * Public profile — verzia, ktorú môžu vidieť ostatní používatelia.
 * Bez sensitive polí.
 */
export const UserPublicSchema = UserSchema.pick({
  _id: true,
  firstName: true,
  lastName: true,
  displayName: true,
  email: true,
  organizationalUnit: true,
  roles: true,
});

export type UserPublic = z.infer<typeof UserPublicSchema>;
