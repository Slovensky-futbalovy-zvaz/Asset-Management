// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

import { useMDXComponents as getThemeComponents } from 'nextra-theme-docs';

import type { ComponentType } from 'react';

// Získa default komponenty z Nextra docs theme
const themeComponents = getThemeComponents();

// Spojí default Nextra komponenty s našimi vlastnými (pre custom rendering)
export function useMDXComponents(components?: Record<string, ComponentType>) {
  return {
    ...themeComponents,
    ...components,
  };
}
