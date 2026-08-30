/** Spacing, radii, and touch-target tokens from docs/visual-design.md. */

/** 4-point base grid. */
export const spacing = {
  /** Icon/text optical correction. */
  xxs: 4,
  /** Compact internal gap. */
  xs: 8,
  /** List item gap. */
  sm: 12,
  /** Standard card padding. */
  md: 16,
  /** Section separation. */
  lg: 24,
  /** Major screen rhythm. */
  xl: 32,
} as const;

export const radii = {
  /** Small controls. */
  control: 10,
  /** Favorite quick-add buttons. */
  quickAdd: 18,
  /** Cards. */
  card: 16,
  /** Bottom sheets, top corners only. */
  sheet: 24,
} as const;

/**
 * Minimum interactive target in points. Required by docs/visual-design.md and
 * AGENTS.md; apply to every pressable.
 */
export const MIN_TOUCH_TARGET = 44;
