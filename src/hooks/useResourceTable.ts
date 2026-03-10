import { useState } from "react";
import { useResources } from "./useResources";
import { useTableSearch } from "./useTableSearch";
import { useTableSort } from "./useTableSort";
import { useInfiniteScroll } from "./useInfiniteScroll";
import { useClusterStore } from "@/stores/clusterStore";

/**
 * Composes the standard table data pipeline:
 *   useResources → useTableSearch → useTableSort → useInfiniteScroll
 *
 * Also provides viewMode and setSelectedResourceName from the cluster store so
 * individual table components don't need to reach into the store themselves.
 */
export function useResourceTable<T extends object>() {
  const { data, loading, error, refresh } = useResources<T>();

  const [searchQuery, setSearchQuery] = useState("");
  const filteredData = useTableSearch(data, searchQuery);
  const { sortedItems, getSortProps } = useTableSort(filteredData);
  const { visibleItems, totalCount, visibleCount, hasMore, sentinelRef, reset } =
    useInfiniteScroll({ items: sortedItems });

  const viewMode = useClusterStore((s) => s.viewMode);
  const setSelectedResourceName = useClusterStore((s) => s.setSelectedResourceName);

  return {
    // Raw data (for dialogs, bulk actions, etc.)
    data,
    loading,
    error,
    refresh,
    // Search
    searchQuery,
    setSearchQuery,
    // Sort
    getSortProps,
    // Pagination
    visibleItems,
    totalCount,
    visibleCount,
    hasMore,
    sentinelRef,
    reset,
    // View
    viewMode,
    setSelectedResourceName,
    // Convenience props to spread onto ResourceTableWrapper
    wrapperProps: {
      loading,
      error,
      count: totalCount,
      visibleCount,
      hasMore,
      sentinelRef,
      onRefresh: refresh,
      searchQuery,
      onSearchChange: setSearchQuery,
    },
  };
}
