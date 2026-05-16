/*
 * SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
 * SPDX-License-Identifier: EUPL-1.2
 *
 * Inventario Design Tokens — Tailwind preset
 *
 * Použitie v `tailwind.config.{js,ts,mjs}`:
 *
 *   import inventarioPreset from '@inventario/design-tokens/tailwind';
 *
 *   export default {
 *     presets: [inventarioPreset],
 *     content: ['./src/**\/*.{ts,tsx}'],
 *     // ...vlastné rozšírenia
 *   };
 *
 * Tailwind triedy ktoré tento preset sprístupní:
 *
 *   - bg-brand-primary, text-brand-primary, …
 *   - bg-surface-page, bg-surface-card, …
 *   - text-text-primary, text-text-secondary, …
 *   - border-border-subtle, border-border-default, …
 *   - text-success-fg, bg-warning-bg, …
 *   - text-asset-available, bg-asset-borrowed, …
 *   - font-sans, font-mono (z primitive font family)
 *   - rounded-lg = 10px (per BRAND.md), rounded-xl = 16px (cards)
 *   - shadow-cta (s CSS color-mix nad current brand)
 *
 * Preset mapuje IBA semantic + brand vrstvy do Tailwind. Primitive vrstva
 * je accessible cez CSS custom properties (--inv-primitive-*) ak naozaj
 * treba — ale v 99% prípadov by si mal používať semantic.
 *
 * Multi-tenant: keďže preset mapuje hodnoty cez `var(--inv-brand-primary)`,
 * Tailwind utilities sa automaticky prispôsobia tenant overrides — žiadny
 * extra setup nie je potrebný v consumer projekte.
 */

/** @type {import('tailwindcss').Config} */
const inventarioPreset = {
  theme: {
    extend: {
      colors: {
        // Brand layer — Inventario default, overridable per-tenant
        brand: {
          primary: 'var(--inv-brand-primary)',
          'primary-fg': 'var(--inv-brand-primary-fg)',
          accent: 'var(--inv-brand-accent)',
          'accent-fg': 'var(--inv-brand-accent-fg)',
          'logo-dot': 'var(--inv-brand-logo-dot)',
        },

        // Semantic layer — UI roles
        text: {
          primary: 'var(--inv-semantic-text-primary)',
          secondary: 'var(--inv-semantic-text-secondary)',
          muted: 'var(--inv-semantic-text-muted)',
          inverse: 'var(--inv-semantic-text-inverse)',
          link: 'var(--inv-semantic-text-link)',
          'link-hover': 'var(--inv-semantic-text-link-hover)',
        },
        surface: {
          page: 'var(--inv-semantic-surface-page)',
          card: 'var(--inv-semantic-surface-card)',
          elevated: 'var(--inv-semantic-surface-elevated)',
          subtle: 'var(--inv-semantic-surface-subtle)',
          inverse: 'var(--inv-semantic-surface-inverse)',
        },
        border: {
          subtle: 'var(--inv-semantic-border-subtle)',
          default: 'var(--inv-semantic-border-default)',
          strong: 'var(--inv-semantic-border-strong)',
          focus: 'var(--inv-semantic-border-focus)',
        },
        success: {
          fg: 'var(--inv-semantic-success-fg)',
          bg: 'var(--inv-semantic-success-bg)',
        },
        warning: {
          fg: 'var(--inv-semantic-warning-fg)',
          bg: 'var(--inv-semantic-warning-bg)',
        },
        danger: {
          fg: 'var(--inv-semantic-danger-fg)',
          bg: 'var(--inv-semantic-danger-bg)',
        },
        info: {
          fg: 'var(--inv-semantic-info-fg)',
          bg: 'var(--inv-semantic-info-bg)',
        },

        // Asset status (mirrors backend AssetStatus enum)
        asset: {
          available: 'var(--inv-semantic-asset-available)',
          reserved: 'var(--inv-semantic-asset-reserved)',
          borrowed: 'var(--inv-semantic-asset-borrowed)',
          'in-service': 'var(--inv-semantic-asset-in-service)',
          disposed: 'var(--inv-semantic-asset-disposed)',
          lost: 'var(--inv-semantic-asset-lost)',
        },
      },

      fontFamily: {
        sans: ['Poppins', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },

      fontWeight: {
        regular: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extrabold: '800',
      },

      borderRadius: {
        // Override default Tailwind to match BRAND.md spec
        lg: '0.625rem', // 10px — buttons, inputs
        xl: '1rem', // 16px — cards
      },

      boxShadow: {
        // Navy-tinted shadows (BRAND.md §2)
        sm: 'var(--inv-shadow-sm)',
        DEFAULT: 'var(--inv-shadow-md)',
        md: 'var(--inv-shadow-md)',
        lg: 'var(--inv-shadow-lg)',
        cta: 'var(--inv-shadow-cta)',
      },
    },
  },
};

export default inventarioPreset;
