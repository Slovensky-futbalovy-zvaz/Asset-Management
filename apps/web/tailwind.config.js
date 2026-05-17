// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

import inventarioPreset from '@inventario/design-tokens/tailwind';

/** @type {import('tailwindcss').Config} */
const config = {
  presets: [inventarioPreset],
  content: ['./src/**/*.{ts,tsx,mdx}'],
};

export default config;
