import { z } from 'zod';

import { BaseDocumentSchema, ObjectIdSchema, SoftDeleteSchema } from './common.js';

/**
 * Lokalita = fyzické miesto, kde sa majetok nachádza.
 *
 * Typy lokalít:
 * - Hlavné sklady (Centrála Bratislava, Akadémia Senec)
 * - Kancelárie (per zamestnanec)
 * - Externé miesta (klubové štadióny, zahraničie počas výjazdov)
 */
export const LocationSchema = BaseDocumentSchema.merge(SoftDeleteSchema).extend({
  /** Názov lokality. */
  name: z.string().min(1).max(200).trim(),

  /** Typ lokality. */
  type: z.enum([
    'WAREHOUSE', // Hlavný sklad
    'OFFICE', // Kancelária
    'STADIUM', // Štadión
    'TRAINING_CENTER', // Tréningové centrum
    'EXTERNAL', // Externé miesto (klub, zahraničie)
    'IN_TRANSIT', // V preprave
  ]),

  /** Voliteľná adresa. */
  address: z
    .object({
      street: z.string().max(200).optional(),
      city: z.string().max(100).optional(),
      postalCode: z.string().max(20).optional(),
      country: z.string().length(2).default('SK'), // ISO 3166-1 alpha-2
    })
    .nullable()
    .default(null),

  /** GPS súradnice (voliteľné). */
  coordinates: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .nullable()
    .default(null),

  /** ID nadradenej lokality (pre hierarchiu: sklad → konkrétna polica). */
  parentId: ObjectIdSchema.nullable().default(null),

  /** Voliteľný popis (otváracie hodiny, kontakt, špeciálne pravidlá). */
  description: z.string().max(2000).nullable().default(null),

  /** ID správcu lokality. */
  managerId: ObjectIdSchema.nullable().default(null),

  /** Či je lokalita aktívna. */
  isActive: z.boolean().default(true),
});

export type Location = z.infer<typeof LocationSchema>;

export const CreateLocationSchema = LocationSchema.omit({
  _id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  deletedAt: true,
  deletedBy: true,
});

export type CreateLocationInput = z.infer<typeof CreateLocationSchema>;
