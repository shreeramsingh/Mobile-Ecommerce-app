import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { productsApi } from '../../api/products';
import type { Product } from '../../api/types';

export const PAGE_SIZE = 24;

export const productKeys = {
  all: ['products'] as const,
  feed: (store: boolean) => ['products', 'feed', store] as const,
  weaponCategory: (id: number) => ['products', 'weaponCategory', id] as const,
  detail: (id: number) => ['products', 'detail', id] as const,
  seller: (sellerId: string, store: boolean) => ['products', 'seller', sellerId, store] as const,
  similar: (categoryId: number, store: boolean) => ['products', 'similar', categoryId, store] as const,
};

/** Paged feed of one product kind (store products or user listings). */
export function useProductFeed(isStoreProduct: boolean, enabled = true) {
  return useInfiniteQuery({
    queryKey: productKeys.feed(isStoreProduct),
    enabled,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => productsApi.list({ page: pageParam, size: PAGE_SIZE, isStoreProduct }),
    getNextPageParam: (last, pages) => {
      // A short or empty page means there's nothing more. Don't trust `count` alone:
      // the API can report a higher total than it returns (e.g. count 27, 17 items,
      // then empty pages), which would otherwise request pages forever.
      if (last.items.length < PAGE_SIZE) return undefined;
      const loaded = pages.reduce((n, p) => n + p.items.length, 0);
      if (last.total > 0 && loaded >= last.total) return undefined;
      return pages.length;
    },
    staleTime: 60_000,
  });
}

export const flattenPages = (data?: { pages: { items: Product[] }[] }) => {
  const seen = new Set<number>();
  const out: Product[] = [];
  data?.pages.forEach((p) =>
    p.items.forEach((item) => {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        out.push(item);
      }
    }),
  );
  return out;
};

export function useWeaponCategoryProducts(categoryId: number | null) {
  return useQuery({
    queryKey: productKeys.weaponCategory(categoryId ?? 0),
    queryFn: () => productsApi.byWeaponCategory(categoryId!),
    enabled: categoryId != null,
  });
}

export function useProduct(id: number, initial?: Product) {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => productsApi.byId(id),
    initialData: initial,
    // Data passed from a list is shown at once, then refreshed in the background.
    initialDataUpdatedAt: initial ? 0 : undefined,
  });
}

export function useSellerProducts(sellerId: string | undefined, isStoreProduct: boolean, size = 50) {
  return useQuery({
    queryKey: [...productKeys.seller(sellerId ?? '', isStoreProduct), size],
    queryFn: () => productsApi.bySeller(sellerId!, isStoreProduct, size),
    enabled: !!sellerId,
  });
}

export function useSimilarProducts(categoryId: number | undefined, isStoreProduct: boolean) {
  return useQuery({
    queryKey: productKeys.similar(categoryId ?? 0, isStoreProduct),
    queryFn: () => productsApi.byCategory(categoryId!, 13, isStoreProduct),
    enabled: categoryId != null,
  });
}

/** Client-side search + city filter (the API has no full-text search). */
export function applyFilters(list: Product[], searchQuery: string, city: string) {
  let out = list;
  const q = searchQuery.trim().toLowerCase();
  if (q) {
    out = out.filter(
      (p) =>
        p.title?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q),
    );
  }
  if (city) {
    const c = city.toLowerCase();
    out = out.filter((p) => p.location?.toLowerCase().includes(c));
  }
  return out;
}
