import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { favoritesApi } from '../../api/social';
import type { Favorite } from '../../api/types';
import { useAppSelector } from '../../store';
import { toast } from '../../components/ui/Toast';
import { errorMessage } from '../../api/client';

export const wishlistKey = (nodeId: string | null | undefined) => ['favorites', nodeId] as const;

/** Favourites for the signed-in user, with optimistic add/remove. */
export function useWishlist() {
  const nodeId = useAppSelector((s) => s.auth.user?.nodeId ?? null);
  const qc = useQueryClient();
  const key = wishlistKey(nodeId);

  const query = useQuery({
    queryKey: key,
    queryFn: () => favoritesApi.byUser(nodeId!),
    enabled: !!nodeId,
    staleTime: 5 * 60_000,
  });

  const favorites = query.data ?? [];
  const byProduct = new Map(favorites.map((f) => [f.productFkId, f]));

  const toggle = useMutation({
    mutationFn: async (productId: number) => {
      const existing = byProduct.get(productId);
      if (existing) {
        await favoritesApi.remove(existing.favoritesPkId);
        return { removed: productId } as const;
      }
      const created = await favoritesApi.add(nodeId!, productId);
      return { added: created } as const;
    },
    onMutate: async (productId) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Favorite[]>(key) ?? [];
      const has = prev.some((f) => f.productFkId === productId);
      qc.setQueryData<Favorite[]>(
        key,
        has
          ? prev.filter((f) => f.productFkId !== productId)
          : [...prev, { favoritesPkId: -productId, userFkId: nodeId!, productFkId: productId, createdAt: null }],
      );
      toast.show(has ? 'Removed from wishlist' : 'Added to wishlist ❤️');
      return { prev };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      toast.show(errorMessage(err), 'error');
    },
    onSuccess: (res) => {
      if ('added' in res && res.added?.favoritesPkId) {
        qc.setQueryData<Favorite[]>(key, (list = []) =>
          list.map((f) => (f.productFkId === res.added.productFkId ? res.added : f)),
        );
      }
    },
  });

  return {
    isReady: !nodeId || query.isSuccess,
    favorites,
    isFavorited: (productId: number) => byProduct.has(productId),
    toggle: (productId: number) => {
      if (!nodeId) {
        toast.show('Sign in to save items to your wishlist', 'info');
        return;
      }
      if (!toggle.isPending) toggle.mutate(productId);
    },
    refetch: query.refetch,
  };
}
