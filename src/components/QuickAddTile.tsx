import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import type { Treat } from '../domain/entities';
import { formatQuantity } from '../domain/units';
import { MIN_TOUCH_TARGET, radii, spacing, tabularNumbers, typography, useTheme } from '../theme';

type Props = {
  treat: Treat;
  /** Spoken label, e.g. "Add Chicken treat for Miso". */
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Tile styling shared by Today's quick-add grid and the add-treat search step. */
export function QuickAddTile({
  treat,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  style,
}: Props) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: colors.surface,
          borderColor: treat.isFavorite ? colors.accent : colors.line,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text style={[typography.headline, { color: colors.ink }]} numberOfLines={2}>
        {treat.name}
      </Text>
      <Text style={[typography.caption, tabularNumbers, { color: colors.mutedInk }]}>
        {formatQuantity(treat.defaultQuantityMilli)} {treat.unit}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    minWidth: 140,
    flexGrow: 1,
    minHeight: MIN_TOUCH_TARGET + spacing.md,
    borderRadius: radii.quickAdd,
    borderWidth: 1,
    padding: spacing.sm,
    justifyContent: 'center',
    gap: spacing.xxs,
  },
});
