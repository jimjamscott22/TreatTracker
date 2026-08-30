import { useEffect } from 'react';

import { getDatabase, petsRepository } from '../../db';
import type { Pet } from '../../domain/entities';
import { useUiStore } from '../../state/preferences';
import { useAsyncData } from '../../utils/useAsyncData';

export function usePets() {
  return useAsyncData<Pet[]>(
    async () => petsRepository.listPets(await getDatabase()),
    [],
  );
}

/**
 * The pet whose data every screen is currently showing.
 *
 * Falls back to the first active pet so the app never renders an ambiguous
 * "all pets" tracker, which docs/ux-flows.md rules out.
 */
export function useActivePet() {
  const { data: pets, loading, error, refresh } = usePets();
  const activePetId = useUiStore((state) => state.activePetId);
  const setActivePet = useUiStore((state) => state.setActivePet);

  const resolved =
    pets?.find((pet) => pet.id === activePetId) ??
    pets?.find((pet) => pet.isActive) ??
    pets?.[0] ??
    null;

  useEffect(() => {
    if (resolved && resolved.id !== activePetId) setActivePet(resolved.id);
  }, [resolved, activePetId, setActivePet]);

  return { pet: resolved, pets: pets ?? [], loading, error, refresh };
}
