import { Platform, type TextStyle } from 'react-native';

/**
 * Type ramp from docs/visual-design.md. Uses the platform system font for
 * correct Dynamic Type behavior.
 *
 * Sizes are unscaled starting points: do NOT cap Dynamic Type growth on these,
 * and never shrink critical totals to fit -- allow reflow instead.
 */
export const typography = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700' },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} satisfies Record<string, TextStyle>;

/**
 * Tabular numerals, required for counts, quantities, times, and chart axes.
 * Spread onto any Text that renders a number.
 */
export const tabularNumbers: TextStyle = Platform.select({
  ios: { fontVariant: ['tabular-nums'] },
  default: { fontVariant: ['tabular-nums'] },
});
