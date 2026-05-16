import { z } from 'zod';

import { OrganisationPlan, OrganisationStatus } from '../enums/organisation-status.js';

import { BaseDocumentSchema, EmailSchema, SoftDeleteSchema } from './common.js';

/**
 * Organisation = tenant in the multi-tenant Inventario platform.
 *
 * Every domain document (asset, category, location, user, audit log)
 * carries an `organisationId` field referencing exactly one Organisation.
 * The backend enforces tenant scoping via `OrganisationScopedRepository`
 * so no query can accidentally span tenants.
 *
 * See ADR-0010 for multi-tenant rationale. See BRAND.md §8 for the
 * per-tenant brand customisation model. See
 * `@inventario/design-tokens/src/brand-kit.schema.json` for the brand
 * kit payload shape.
 *
 * # Identity sources
 *
 * - **Slug** is the tenant's URL identifier and matches the `data-tenant`
 *   attribute used by design-tokens for runtime brand override. Lowercase
 *   ASCII letters, digits, hyphens. Must be globally unique.
 *
 * - **Entra tenant id** is the Microsoft Entra ID directory id (the `tid`
 *   claim on issued JWTs). Used to map an incoming SSO request to its
 *   Organisation during JIT tenant provisioning. Optional — LOCAL-account
 *   tenants do not have one.
 *
 * # Branding
 *
 * `brandKit` is an embedded object matching the brand-kit JSON schema
 * shipped in `@inventario/design-tokens`. It is rendered into runtime CSS
 * overrides for the tenant. Empty / null means "use Inventario defaults".
 */
export const OrganisationBrandKitSchema = z
  .object({
    logoUrl: z.string().url().nullable().default(null),
    faviconUrl: z.string().url().nullable().default(null),
    primary: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a #RRGGBB hex value.')
      .nullable()
      .default(null),
    primaryFg: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullable()
      .default(null),
    accent: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullable()
      .default(null),
    accentFg: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullable()
      .default(null),
    fontFamilySans: z.string().max(200).nullable().default(null),
  })
  .strict();

export type OrganisationBrandKit = z.infer<typeof OrganisationBrandKitSchema>;

export const OrganisationSchema = BaseDocumentSchema.merge(SoftDeleteSchema).extend({
  /**
   * Tenant display name. Free-form, shown in UI alongside the wordmark.
   * Examples: "Inventario", "Slovenský futbalový zväz", "Mesto Bratislava".
   */
  displayName: z.string().min(1, 'Display name is required.').max(200).trim(),

  /**
   * Stable slug for the tenant. Used as `data-tenant` value, in URLs,
   * and as the unique business key. Lowercase ASCII letters, digits,
   * hyphens. 2-40 chars.
   */
  slug: z
    .string()
    .regex(
      /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/,
      'Slug must be lowercase ASCII letters, digits, and hyphens, 2-40 chars.',
    )
    .min(2)
    .max(40),

  /** Microsoft Entra ID directory id (the `tid` JWT claim). Null for LOCAL-only tenants. */
  entraTenantId: z.string().uuid().nullable().default(null),

  /** Optional custom domain (Pro/Enterprise plans). */
  customDomain: z
    .string()
    .max(253)
    .regex(
      /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/,
      'Custom domain must be a valid lowercase fully-qualified domain name.',
    )
    .nullable()
    .default(null),

  /** Lifecycle status. */
  status: z.enum(
    Object.values(OrganisationStatus) as [string, ...string[]],
  ) as z.ZodType<OrganisationStatus>,

  /** Subscription plan. */
  plan: z.enum(
    Object.values(OrganisationPlan) as [string, ...string[]],
  ) as z.ZodType<OrganisationPlan>,

  /** Primary billing / admin contact for the tenant. */
  primaryContactEmail: EmailSchema.nullable().default(null),

  /** Per-tenant brand kit. Null means "use Inventario defaults". */
  brandKit: OrganisationBrandKitSchema.nullable().default(null),

  /**
   * Free-form settings bag for per-tenant feature flags and config.
   * Currently unused; will fill in once Slice #4 frontend and admin
   * onboarding settle on what tenants need to configure.
   */
  settings: z.record(z.string(), z.unknown()).default({}),
});

export type Organisation = z.infer<typeof OrganisationSchema>;

/**
 * Input shape for creating an organisation through the admin API or
 * during JIT tenant provisioning on first SSO login.
 */
export const CreateOrganisationSchema = OrganisationSchema.omit({
  _id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  deletedAt: true,
  deletedBy: true,
}).extend({
  status: z
    .enum(Object.values(OrganisationStatus) as [string, ...string[]])
    .default(OrganisationStatus.ACTIVE) as z.ZodType<OrganisationStatus>,
  plan: z
    .enum(Object.values(OrganisationPlan) as [string, ...string[]])
    .default(OrganisationPlan.FREE) as z.ZodType<OrganisationPlan>,
});

export type CreateOrganisationInput = z.infer<typeof CreateOrganisationSchema>;

/**
 * Update shape for admin edits. Slug and entraTenantId are deliberately
 * NOT updatable — they are stable identifiers used by JWT claim
 * resolution and URL routing. Renaming a tenant means migrating data.
 */
export const UpdateOrganisationSchema = OrganisationSchema.omit({
  _id: true,
  slug: true,
  entraTenantId: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  deletedAt: true,
  deletedBy: true,
}).partial();

export type UpdateOrganisationInput = z.infer<typeof UpdateOrganisationSchema>;
