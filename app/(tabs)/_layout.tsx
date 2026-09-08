import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useTheme } from '../../src/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Active tab is marked by tint *and* by swapping outline -> filled glyph, so
 * the current destination is never signaled by color alone (WCAG 1.4.1; see
 * the app convention audit). Still one coherent Ionicons outline set
 * (docs/visual-design.md, "Iconography") -- filled is that set's own
 * selected-state variant, not a second icon family.
 */
function tabIcon(outline: IconName, filled: IconName) {
  return ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
    <Ionicons name={focused ? filled : outline} size={size} color={color} />
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
          tabBarIcon: tabIcon('home-outline', 'home'),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: tabIcon('time-outline', 'time'),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: tabIcon('stats-chart-outline', 'stats-chart'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: tabIcon('settings-outline', 'settings'),
        }}
      />
    </Tabs>
  );
}
