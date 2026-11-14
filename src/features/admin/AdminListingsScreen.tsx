import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQueries, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react-native';
import { productsApi } from '../../api/products';
import { usersApi } from '../../api/users';
import { errorMessage } from '../../api/client';
import { useAppDispatch } from '../../store';
import { removeRecentlyViewed } from '../../store/slices/recentlyViewedSlice';
import type { Product } from '../../api/types';
import { ProductImage } from '../../components/ProductImage';
import { AppText, Button, Card, EmptyState, ErrorBox, Loader, Row } from '../../components/ui';
import { ConfirmDialog } from '../../components/ui/Sheet';
import { toast } from '../../components/ui/Toast';
import { timeAgo } from '../../lib/format';
import { colors, radius, spacing } from '../../theme';

const PAGE = 20;

/** Moderation: products posted by users (marketplace listings). */
export function AdminListingsScreen() {
  const navigation = useNavigation();
  const qc = useQueryClient();
  const dispatch = useAppDispatch();
  const removeRecent = (id: number) => dispatch(removeRecentlyViewed(id));
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const q = useQuery({
    queryKey: ['adminListings', page],
    queryFn: () => productsApi.list({ page, size: PAGE, isStoreProduct: false }),
    placeholderData: keepPreviousData,
  });
  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE));

  const sellerIds = [...new Set(items.map((p) => p.sellerId).filter(Boolean))] as string[];
  const names = useQueries({
    queries: sellerIds.map((id) => ({ queryKey: ['userName', id], queryFn: () => usersApi.nameByNodeId(id), staleTime: 60 * 60_000 })),
  });
  const nameOf = (id?: string) => (id ? names[sellerIds.indexOf(id)]?.data || id : '—');

  const visible = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter((p) =>
      [p.title, nameOf(p.sellerId), p.sellerId, String(p.id)].some((x) => x?.toLowerCase().includes(s)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search, names]);

  const doDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await productsApi.remove(toDelete.id);
      removeRecent(toDelete.id);
      toast.show('Listing deleted');
      setToDelete(null);
      if (items.length === 1 && page > 0) setPage((p) => p - 1);
      else q.refetch();
      qc.invalidateQueries({ queryKey: ['products'] });
    } catch (e) {
      toast.show(`Failed to delete: ${errorMessage(e)}`, 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (q.isLoading) return <Loader style={{ flex: 1 }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.gray100 }}>
      <FlatList
        data={visible}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={{ padding: spacing.md, gap: 8 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.gold500} />}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 4 }}>
            <AppText muted>Products posted by users on the marketplace. Remove anything that breaks the rules.</AppText>
            {q.error ? <ErrorBox message={errorMessage(q.error) || 'Could not load listings.'} onRetry={q.refetch} /> : null}
            <Row style={styles.search}>
              <Search size={16} color={colors.gray400} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search title, seller or ad ID on this page"
                placeholderTextColor={colors.gray400}
                style={{ flex: 1, height: 42, color: colors.gray900 }}
              />
            </Row>
            <AppText variant="caption">{total} listings</AppText>
          </View>
        }
        ListEmptyComponent={<EmptyState emoji="📭" title={search ? 'No listings match your search.' : 'No user listings yet.'} />}
        renderItem={({ item: p }) => (
          <Card style={{ padding: 12 }}>
            <Pressable style={{ flexDirection: 'row', gap: 12 }} onPress={() => navigation.navigate('ProductDetails', { id: p.id, product: p })}>
              <ProductImage uri={p.images[0]} style={styles.thumb} />
              <View style={{ flex: 1 }}>
                <AppText style={{ fontWeight: '700' }} numberOfLines={2}>{p.title}</AppText>
                <AppText variant="caption">Ad #{p.id} · {timeAgo(p.createdAt)}</AppText>
                <AppText variant="caption" numberOfLines={1}>By {nameOf(p.sellerId)} · {p.location || '—'}</AppText>
                <AppText style={{ fontWeight: '800', color: colors.gold600, marginTop: 2 }}>₹{Number(p.price).toLocaleString('en-IN')}</AppText>
              </View>
            </Pressable>
            <Button title="Delete" size="sm" variant="dangerOutline" style={{ marginTop: 10, alignSelf: 'flex-end' }} onPress={() => setToDelete(p)} />
          </Card>
        )}
        ListFooterComponent={
          totalPages > 1 ? (
            <Row style={{ justifyContent: 'center', marginTop: 8 }} gap={16}>
              <Pressable disabled={page === 0 || q.isFetching} onPress={() => setPage((x) => x - 1)} style={[styles.pageBtn, page === 0 && { opacity: 0.4 }]}>
                <ChevronLeft size={18} color={colors.gray700} />
              </Pressable>
              <AppText>
                Page {page + 1} of {totalPages}
              </AppText>
              <Pressable
                disabled={page + 1 >= totalPages || q.isFetching}
                onPress={() => setPage((x) => x + 1)}
                style={[styles.pageBtn, page + 1 >= totalPages && { opacity: 0.4 }]}
              >
                <ChevronRight size={18} color={colors.gray700} />
              </Pressable>
            </Row>
          ) : undefined
        }
      />
      <ConfirmDialog
        visible={!!toDelete}
        title="Delete this listing?"
        message={toDelete ? `“${toDelete.title}” by ${nameOf(toDelete.sellerId)} will be removed from the marketplace. This can't be undone.` : undefined}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        destructive
        loading={deleting}
        onConfirm={doDelete}
        onCancel={() => setToDelete(null)}
      />
    </View>
  );
}

export const adminStyles = StyleSheet.create({
  pageBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const styles = StyleSheet.create({
  search: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.gray200, borderRadius: radius.md, paddingHorizontal: 12 },
  thumb: { width: 72, height: 72, borderRadius: radius.md },
  pageBtn: adminStyles.pageBtn,
});
