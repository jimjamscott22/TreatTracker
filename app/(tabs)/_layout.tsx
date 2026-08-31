import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useActivePet } from '../../src/features/pets/usePets';
import { useUiStore } from '../../src/state/preferences';
import { MIN_TOUCH_TARGET, spacing, typography, useTheme } from '../../src/theme';

/**
 * Header "Add" lives in the tab layout so Expo Router cannot wipe it when the
 * screen re-renders. `setOptions` from Today previously lost the button on iOS
 * because this layout already set static `options={{ title: 'Today' }}`.
 *
 * Label is "Add" with headline styles -- not a oversized "+" -- because iOS
 * clips Text to `lineHeight`, and headline's 22pt line height hid a 28pt plus.
 */
function TodayAddButton() {
  const { colors } = useTheme();
  const { pet } = useActivePet();
  const openAddTreatSheet = useUiStore((state) => state.openAddTreatSheet);

  if (!pet) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add a treat"
      onPress={openAddTreatSheet}
      style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={[typography.headline, { color: colors.accent }]}>Add</Text>
    </Pressable>
  );
}

/**
 * The four primary tabs defined in docs/ux-flows.md.
 *
 * Labels are always shown: icon-only tabs would leave the destination
 * unlabelled for assistive technology and at large text sizes.
 */
export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.mutedInk,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
        headerStyle: { backgroundColor: colors.canvas },
        headerTintColor: colors.ink,
        sceneStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          headerRight: () => <TodayAddButton />,
        }}
      />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    marginRight: spacing.xs,
  },
});
