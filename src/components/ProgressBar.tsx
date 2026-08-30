import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';

type Props = {
  /** 0..1+; values above 1 are clamped for drawing but not treated as an error. */
  fraction: number;
  /** Full sentence describing the progress for assistive technology. */
  accessibilityLabel: string;
};

/**
 * Neutral budget progress.
 *
 * docs/visual-design.md rules out traffic-light status, and docs/ux-flows.md
 * rules out warning red just because a user-defined budget was exceeded, so an
 * over-budget bar uses the same accent as any other value.
 */
export function ProgressBar({ fraction, accessibilityLabel }: Props) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[styles.track, { backgroundColor: colors.accentSoft }]}
    >
      <View
        style={[
          styles.fill,
          { backgroundColor: colors.accent, width: `${clamped * 100}%` },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});
