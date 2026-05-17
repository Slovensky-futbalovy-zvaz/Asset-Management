/**
 * Typy lokalít — fyzické miesta, kde sa majetok môže nachádzať.
 *
 * Hodnoty sú zámerne zaokrúhlené na 6 hlavných typov — neskôr možno doplniť
 * granulárnejšie členenie (kabinet, polica, zóna), to však zostáva v `name`
 * alebo voľne v `description` jednotlivej lokality.
 */
export const LocationType = {
  /** Hlavný sklad (centrála). */
  WAREHOUSE: 'WAREHOUSE',
  /** Kancelária. */
  OFFICE: 'OFFICE',
  /** Štadión alebo športový areál. */
  STADIUM: 'STADIUM',
  /** Tréningové centrum. */
  TRAINING_CENTER: 'TRAINING_CENTER',
  /** Externé miesto (klubová budova, zahraničie počas výjazdu). */
  EXTERNAL: 'EXTERNAL',
  /** Položka momentálne v preprave medzi lokalitami. */
  IN_TRANSIT: 'IN_TRANSIT',
} as const;

export type LocationType = (typeof LocationType)[keyof typeof LocationType];

export const LOCATION_TYPE_VALUES = Object.values(LocationType) as readonly LocationType[];
