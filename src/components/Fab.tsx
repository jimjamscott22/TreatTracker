import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, useTheme } from '../theme';

type Props = {
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

const SIZE = 56;

/**
 * Primary "add" action, anchored bottom-right in the thumb zone.
 *
 * Replaces a header-right text button: the top corner is the worst reach for
 * a one-handed, seconds-matter capture flow. Position accounts for the
 * device safe area so the button never sits under the home indicator.
 */
export function Fab({ onPress, accessibilityLabel, accessibilityHint, style }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        {
          bottom: insets.bottom + spacing.md,
          right: spacing.md,
          backgroundColor: colors.accent,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Ionicons name="add" size={28} color={colors.surface} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
});
