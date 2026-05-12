/**
 * SFZ Design Tokens — TypeScript export
 *
 * Zdroj: SFZ Design Manual 2024-01 (Codes Brand House).
 *
 * Tento súbor je ručne písaný typovaný export. V budúcnosti ho nahradí
 * generovaný výstup zo `style-dictionary` build pipeline.
 *
 * Použitie:
 *   import { tokens, colors } from '@sfz/design-tokens';
 *
 *   const primary = colors.brand.blue;        // '#1450df'
 *   const success = colors.semantic.success;  // '#29ba2e'
 */

export const colors = {
  brand: {
    blue: '#1450df',
    red: '#ec1c24',
    black: '#070504',
    white: '#ffffff',
  },
  neutral: {
    grey30: '#bbbdbf',
    grey60: '#808285',
  },
  accent: {
    blueLight: '#008aff',
    green: '#29ba2e',
    yellow: '#ffda00',
    yellowWarm: '#f9b214',
    teal: '#27cbd5',
    gold: '#a9883c',
  },
  semantic: {
    success: '#29ba2e',
    warning: '#f9b214',
    danger: '#ec1c24',
    info: '#1450df',
  },
  assetStatus: {
    available: '#29ba2e',
    reserved: '#ffda00',
    borrowed: '#1450df',
    inService: '#f9b214',
    disposed: '#808285',
    lost: '#ec1c24',
  },
} as const;

export const typography = {
  fontFamily: {
    sans: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace",
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

export const spacing = {
  0: '0',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
} as const;

export const radius = {
  none: '0',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  full: '9999px',
} as const;

export const shadow = {
  sm: '0 1px 2px 0 rgba(7, 5, 4, 0.05)',
  md: '0 4px 6px -1px rgba(7, 5, 4, 0.1), 0 2px 4px -1px rgba(7, 5, 4, 0.06)',
  lg: '0 10px 15px -3px rgba(7, 5, 4, 0.1), 0 4px 6px -2px rgba(7, 5, 4, 0.05)',
} as const;

/**
 * Kompletný objekt všetkých tokenov.
 */
export const tokens = {
  color: colors,
  typography,
  spacing,
  radius,
  shadow,
} as const;

export type SFZColors = typeof colors;
export type SFZTokens = typeof tokens;
export type AssetStatus = keyof typeof colors.assetStatus;

export default tokens;
