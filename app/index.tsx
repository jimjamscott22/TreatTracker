import { Redirect } from 'expo-router';

import { LoadingState } from '../src/components';
import { usePets } from '../src/features/pets/usePets';

/**
 * Entry gate.
 *
 * With no pet on record there is nothing to track against, so the user goes
 * straight to pet creation rather than an empty global tracker
 * (docs/ux-flows.md, "No active pet").
 */
export default function Index() {
  const { data: pets, loading } = usePets();

  if (loading) return <LoadingState />;

  return pets && pets.length > 0 ? <Redirect href="/(tabs)" /> : <Redirect href="/onboarding" />;
}
