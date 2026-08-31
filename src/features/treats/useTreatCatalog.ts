import { getDatabase, treatsRepository } from '../../db';
import { useAsyncData } from '../../utils/useAsyncData';
import { useDebouncedValue } from '../../utils/useDebouncedValue';

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Backs the Treat Catalog screen: a searchable, favorite-first list of active
 * or archived treats (docs/product-spec.md, "Treat catalog").
 *
 * Search is debounced here so the catalog screen and any future callers share
 * the same behavior instead of re-implementing it.
 */
export function useTreatCatalog(query: string, includeArchived: boolean) {
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);

  const { data, loading, error, refresh } = useAsyncData(
    async () =>
      treatsRepository.listCatalogTreats(await getDatabase(), {
        query: debouncedQuery,
        includeArchived,
      }),
    [debouncedQuery, includeArchived],
  );

  return { treats: data ?? [], loading, error, refresh };
}
