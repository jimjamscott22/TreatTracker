import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '../src/components';
import { getDatabase, petsRepository } from '../src/db';
import { petDraftSchema, type Species } from '../src/domain/entities';
import { useUiStore } from '../src/state/preferences';
import { MIN_TOUCH_TARGET, radii, spacing, typography, useTheme } from '../src/theme';

/**
 * First launch: reach a usable Today screen with a name and a species.
 *
 * No account, no notification permission, and no optional profile fields are
 * required to get here (docs/ux-flows.md, "First launch").
 */
export default function Onboarding() {
  const { colors } = useTheme();
  const router = useRouter();
  const setActivePet = useUiStore((state) => state.setActivePet);

  const [name, setName] = useState('');
  const [species, setSpecies] = useState<Species>('dog');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const parsed = petDraftSchema.safeParse({ name, species });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the details and try again.');
      return;
    }

    setSaving(true);
    try {
      const pet = await petsRepository.createPet(await getDatabase(), parsed.data);
      setActivePet(pet.id);
      router.replace('/(tabs)');
    } catch {
      // Keep the draft on screen so nothing the user typed is lost.
      setError('That pet could not be saved. Try again.');
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[typography.largeTitle, { color: colors.ink }]}>
          Keep a simple record of your pet’s treats.
        </Text>

        <View style={styles.field}>
          <Text style={[typography.headline, { color: colors.ink }]}>Pet name</Text>
          <TextInput
            value={name}
            onChangeText={(next) => {
              setName(next);
              setError(null);
            }}
            placeholder="Miso"
            placeholderTextColor={colors.mutedInk}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
            accessibilityLabel="Pet name"
            style={[
              styles.input,
              typography.body,
              { color: colors.ink, backgroundColor: colors.surface, borderColor: colors.line },
            ]}
          />
        </View>

        <View style={styles.field}>
          <Text style={[typography.headline, { color: colors.ink }]}>Species</Text>
          <View style={styles.speciesRow} accessibilityRole="radiogroup">
            {(['dog', 'cat'] as const).map((option) => {
              const selected = species === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setSpecies(option)}
                  style={[
                    styles.speciesOption,
                    {
                      backgroundColor: selected ? colors.accentSoft : colors.surface,
                      borderColor: selected ? colors.accent : colors.line,
                    },
                  ]}
                >
                  <Text style={[typography.body, { color: colors.ink }]}>
                    {option === 'dog' ? 'Dog' : 'Cat'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {error ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[typography.body, { color: colors.accent }]}
          >
            {error}
          </Text>
        ) : null}

        <Button label="Continue" onPress={handleSave} busy={saving} />

        <Text style={[typography.caption, { color: colors.mutedInk }]}>
          Everything stays on this device. You can add more details later.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.lg },
  field: { gap: spacing.xs },
  input: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radii.control,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
  },
  speciesRow: { flexDirection: 'row', gap: spacing.xs },
  speciesOption: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radii.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
