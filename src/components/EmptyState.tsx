import { StyleSheet, Text, View } from 'react-native';

import { spacing, typography, useTheme } from '../theme';
import { Button } from './Button';

type Props = {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * A "nothing here" state is a normal, valid state -- never an error
 * (docs/ux-flows.md). Copy stays neutral and never implies a missed obligation.
 */
export function EmptyState({ title, body, actionLabel, onAction }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[typography.title2, { color: colors.ink }]}>{title}</Text>
      {body ? (
        <Text style={[typography.body, styles.body, { color: colors.mutedInk }]}>
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  body: { textAlign: 'center' },
  action: { marginTop: spacing.sm, alignSelf: 'stretch' },
});
