import { z } from 'zod';

/**
 * MongoDB ObjectId vo formáte 24-znakového hex stringu.
 *
 * V API a JSON serializácii ho posielame ako string. V dátovej vrstve
 * Mongo driver ho automaticky konvertuje na BSON ObjectId.
 */
export const ObjectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Neplatný formát ObjectId (očakáva sa 24 hex znakov).')
  .describe('MongoDB ObjectId (24 hex znakov)');

export type ObjectId = z.infer<typeof ObjectIdSchema>;

/**
 * ISO 8601 timestamp ako string. Vždy v UTC, formát `YYYY-MM-DDTHH:mm:ss.sssZ`.
 *
 * Mongo driver pri serializácii konvertuje JS `Date` ↔ string.
 */
export const TimestampSchema = z
  .string()
  .datetime({ offset: true })
  .describe('ISO 8601 timestamp v UTC');

export type Timestamp = z.infer<typeof TimestampSchema>;

/**
 * Audit polia, ktoré má každý dokument.
 *
 * `createdAt` / `updatedAt` — automaticky nastavované repository vrstvou.
 * `createdBy` / `updatedBy` — ID používateľa, ktorý záznam vytvoril/zmenil.
 *   Pre systémové akcie (seedy, batch joby) je hodnota "SYSTEM".
 */
export const AuditFieldsSchema = z.object({
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  createdBy: z.union([ObjectIdSchema, z.literal('SYSTEM')]),
  updatedBy: z.union([ObjectIdSchema, z.literal('SYSTEM')]),
});

export type AuditFields = z.infer<typeof AuditFieldsSchema>;

/**
 * Identifikačné polia spoločné pre väčšinu dokumentov.
 */
export const BaseDocumentSchema = z
  .object({
    _id: ObjectIdSchema,
  })
  .merge(AuditFieldsSchema);

export type BaseDocument = z.infer<typeof BaseDocumentSchema>;

/**
 * Soft delete podpora — pre dokumenty, ktoré sa nemažú fyzicky.
 */
export const SoftDeleteSchema = z.object({
  deletedAt: TimestampSchema.nullable().default(null),
  deletedBy: z.union([ObjectIdSchema, z.literal('SYSTEM')]).nullable().default(null),
});

export type SoftDelete = z.infer<typeof SoftDeleteSchema>;

/**
 * Slovenský telefón vo formáte +421 9XX XXX XXX alebo 09XX XXX XXX.
 *
 * Normalizácia na +421 formát sa robí v parsovacej fáze (pre konzistenciu v DB).
 */
export const PhoneSchema = z
  .string()
  .regex(
    /^(\+421|0)9\d{2}\s?\d{3}\s?\d{3}$/,
    'Telefón musí byť vo formáte +421 9XX XXX XXX alebo 09XX XXX XXX.',
  )
  .transform((val) => {
    // Normalizuj na +421 formát bez medzier
    const digits = val.replace(/\s/g, '');
    if (digits.startsWith('0')) {
      return `+421${digits.slice(1)}`;
    }
    return digits;
  })
  .describe('Slovenský mobilný telefón');

export type Phone = z.infer<typeof PhoneSchema>;

/**
 * E-mail s normalizáciou na lowercase.
 */
export const EmailSchema = z
  .string()
  .email('Neplatný formát e-mailovej adresy.')
  .toLowerCase()
  .max(255, 'E-mail je príliš dlhý (max 255 znakov).');

export type Email = z.infer<typeof EmailSchema>;
