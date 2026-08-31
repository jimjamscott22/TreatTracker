import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';

/**
 * Fills the screen while a first load is in flight, so the user sees an
 * indicator instead of a flash of blank canvas or a stale empty state.
 */
export function LoadingState() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.canvas }]}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
