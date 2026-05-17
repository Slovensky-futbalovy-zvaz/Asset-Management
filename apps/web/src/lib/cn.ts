// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { ClassValue } from 'clsx';

/**
 * Merge Tailwind class names with conflict resolution.
 *
 * `clsx` handles conditional class composition (objects, arrays, falsy
 * values), and `tailwind-merge` resolves conflicts between competing
 * utilities (e.g. `px-2 px-4` → `px-4`). The combination is the de-facto
 * idiom for shadcn/ui-style components.
 *
 * Usage:
 *   cn('px-2', condition && 'px-4', extraClasses)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
