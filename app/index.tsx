import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { usePets } from '../src/features/pets/usePets';
import { useTheme } from '../src/theme';

/**
 * Entry gate.
 *
 * With no pet on record there is nothing to track against, so the user goes
 * straight to pet creation rather than an empty global tracker
 * (docs/ux-flows.md, "No active pet").
 */
export default function Index() {
  const { data: pets, loading } = usePets();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return pets && pets.length > 0 ? <Redirect href="/(tabs)" /> : <Redirect href="/onboarding" />;
}
