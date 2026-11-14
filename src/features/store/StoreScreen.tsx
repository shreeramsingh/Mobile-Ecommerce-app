import React, { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronDown, ChevronRight, LayoutGrid, Plus, Search, ShoppingCart, X } from 'lucide-react-native';
import type { RootScreenProps } from '../../navigation/types';
import type { Product } from '../../api/types';
import { useAppSelector } from '../../store';
import { usersApi } from '../../api/users';
import { useSellerProducts } from '../products/queries';
import { ProductCard } from '../products/ProductCard';
import { ProductCardSkeleton } from '../products/ProductCardSkeleton';
import { Button, EmptyState } from '../../components/ui';
import { Sheet } from '../../components/ui/Sheet';
import {
  SHOOTING_CATEGORIES,
  selectionIds,
  selectionLabel,
  selectionTerms,
  type CategorySelection,
} from '../../data/shootingCategories';
import { timeAgo } from '../../lib/format';
import { colors, font, radius } from '../../theme';

const STORE_LOGO = require('../../assets/images/store-logo.jpeg');
type Sort = 'newest' | 'priceAsc' | 'priceDesc';
const SORTS: { key: Sort; label: string }[] = [
  { key: 'newest', label: 'Newest first' },
  { key: 'priceAsc', label: 'Price: low to high' },
  { key: 'priceDesc', label: 'Price: high to low' },
];

export function StoreScreen({ allowPosting }: { allowPosting?: boolean } = {}) {
  const navigation = useNavigation();
  const route = useRoute<RootScreenProps<'Store'>['route']>();
  const user = useAppSelector((s) => s.auth.user);
  const isAdmin = useAppSelector((s) => s.auth.isAdmin);
  const sellerId = route.params?.sellerId || user?.nodeId || undefined;
  const isOwnStore = !!sellerId && sellerId === user?.nodeId;
  const canPost = isOwnStore && (allowPosting ?? route.params?.allowPosting ?? isAdmin);

  const q = useSellerProducts(sellerId, true, 200);
  const nameQ = useQuery({
    queryKey: ['userName', sellerId],
    queryFn: () => usersApi.nameByNodeId(sellerId!),
    enabled: !!sellerId && !isOwnStore,
    staleTime: 60 * 60_000,
  });
  const sellerName = isOwnStore ? user?.name || 'My Store' : nameQ.data || 'Luthra Gun House Private Limited';

  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('newest');
  const [selection, setSelection] = useState<CategorySelection | null>(null);
  const [catsOpen, setCatsOpen] = useState(false);

  const all = useMemo(() => (q.data?.items ?? []).filter((p) => !hidden.has(p.id)), [q.data, hidden]);
  const total = Math.max(0, (q.data?.total || all.length) - hidden.size);

  const visible = useMemo(() => {
    let list = all;
    const s = search.trim().toLowerCase();
    if (s) list = list.filter((p) => [p.title, p.brand, p.location].some((x) => x?.toLowerCase().includes(s)));
    if (selection) {
      const ids = new Set(selectionIds(selection));
      const terms = selectionTerms(selection).map((t) => t.toLowerCase());
      list = list.filter((p) => {
        if (selection.subcategory ? ids.has(p.subcategoryId ?? -1) : ids.has(p.categoryId ?? -1) || ids.has(p.subcategoryId ?? -1)) return true;
        const text = `${p.title} ${p.description ?? ''} ${p.brand ?? ''}`.toLowerCase();
        return terms.some((t) => text.includes(t));
      });
    }
    const sorted = [...list];
    if (sort === 'newest') sorted.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    if (sort === 'priceAsc') sorted.sort((a, b) => a.price - b.price);
    if (sort === 'priceDesc') sorted.sort((a, b) => b.price - a.price);
    return sorted;
  }, [all, search, selection, sort]);

  const stockValue = all.reduce((n, p) => n + p.price * (typeof p.productQuantity === 'number' ? p.productQuantity : 0), 0);
  const lastAdded = all.reduce<string | undefined>((m, p) => (p.createdAt && (!m || p.createdAt > m) ? p.createdAt : m), undefined);
  const filtering = !!search.trim() || !!selection;
  const showUploadTile = canPost && !filtering;

  const onDeleted = useCallback((id: number) => setHidden((h) => new Set(h).add(id)), []);
  const post = () => navigation.navigate('StoreProductForm');

  const data: (Product | 'upload')[] = q.isLoading ? [] : showUploadTile ? ['upload', ...visible] : visible;

  const header = (
    <View>
      <View style={styles.banner}>
        <View style={styles.logoRing}>
          <Image source={STORE_LOGO} style={styles.logo} />
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{isOwnStore ? 'Your store' : 'Store'}</Text>
          </View>
          <View style={[styles.chip, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
            <ShoppingCart size={11} color="#86efac" />
            <Text style={[styles.chipText, { color: '#86efac' }]}>Cart enabled</Text>
          </View>
        </View>
        <Text style={styles.storeTitle}>{sellerName}'s Store</Text>
        <Text style={styles.storeSub}>Customers add these items to cart and pay securely.</Text>
        {canPost && <Button title="Post new item" icon={Plus} onPress={post} style={{ marginTop: 14, alignSelf: 'stretch' }} />}
      </View>

      <View style={styles.stats}>
        <Stat label="Products" value={q.isLoading ? '…' : total.toLocaleString('en-IN')} />
        {isAdmin && <Stat label="Stock value" value={q.isLoading ? '…' : `₹${stockValue.toLocaleString('en-IN')}`} />}
        <Stat label="Last added" value={q.isLoading ? '…' : lastAdded ? timeAgo(lastAdded) : '—'} />
      </View>

      {(q.isLoading || all.length > 0) && (
        <View style={{ paddingHorizontal: 6, marginTop: 14 }}>
          <Text style={styles.listTitle}>
            {isOwnStore ? 'Your products' : `Products by ${sellerName}`}{' '}
            <Text style={{ color: colors.gray400, fontWeight: '400' }}>({visible.length})</Text>
          </Text>
          <View style={styles.searchBox}>
            <Search size={16} color={colors.gray400} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={isOwnStore ? 'Search your products' : 'Search products'}
              placeholderTextColor={colors.gray400}
              style={{ flex: 1, paddingHorizontal: 8, color: colors.gray900, height: 42 }}
            />
            {search ? (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <X size={16} color={colors.gray400} />
              </Pressable>
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 10 }}>
            <Pressable style={[styles.pill, selection && styles.pillActive]} onPress={() => setCatsOpen(true)}>
              <LayoutGrid size={14} color={selection ? colors.onAccent : colors.gray700} />
              <Text style={[styles.pillText, selection && { color: colors.onAccent }]}>
                {selection ? selectionLabel(selection) : 'Categories'}
              </Text>
              {selection ? (
                <Pressable onPress={() => setSelection(null)} hitSlop={8}>
                  <X size={14} color={colors.onAccent} />
                </Pressable>
              ) : (
                <ChevronDown size={14} color={colors.gray700} />
              )}
            </Pressable>
            {SORTS.map((s) => (
              <Pressable key={s.key} style={[styles.pill, sort === s.key && styles.pillActive]} onPress={() => setSort(s.key)}>
                <Text style={[styles.pillText, sort === s.key && { color: colors.onAccent }]}>{s.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {q.isLoading && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={{ width: '50%', padding: 5 }}>
              <ProductCardSkeleton />
            </View>
          ))}
        </View>
      )}
      <View style={{ height: 10 }} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.gray100 }}>
      <FlashList
        data={data}
        numColumns={2}
        keyExtractor={(p) => (p === 'upload' ? 'upload' : String(p.id))}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { setHidden(new Set()); q.refetch(); }} tintColor={colors.gold500} />}
        contentContainerStyle={{ paddingHorizontal: 6, paddingBottom: 30 }}
        renderItem={({ item }) => (
          <View style={{ flex: 1, padding: 5 }}>
            {item === 'upload' ? (
              <Pressable style={styles.uploadTile} onPress={post}>
                <View style={styles.uploadIcon}>
                  <Plus size={28} color={colors.onAccent} />
                </View>
                <Text style={{ fontWeight: '700', color: colors.gray800, marginTop: 10 }}>Upload new item</Text>
                <Text style={{ fontSize: font.xs, color: colors.gray500, textAlign: 'center', marginTop: 4 }}>
                  Add photos, price and details for a new store product
                </Text>
              </Pressable>
            ) : (
              <ProductCard item={item} onDeleted={onDeleted} />
            )}
          </View>
        )}
        ListEmptyComponent={
          q.isLoading ? null : filtering ? (
            <EmptyState
              emoji="🔍"
              title={`No products match${search ? ` "${search}"` : ''}${selection ? ` in ${selectionLabel(selection)}` : ''}`}
              action={<Button title="Clear filters" variant="ghost" onPress={() => { setSearch(''); setSelection(null); }} />}
            />
          ) : (
            <EmptyState
              emoji="🏪"
              title={isOwnStore ? 'Your store is empty' : 'This store has no products'}
              message={canPost ? 'Upload your first product with photos, price and details to start selling.' : undefined}
              action={canPost ? <Button title="Upload your first product" onPress={post} /> : undefined}
            />
          )
        }
      />
      <CategorySheet
        visible={catsOpen}
        onClose={() => setCatsOpen(false)}
        onSelect={(s) => {
          setSelection(s);
          setCatsOpen(false);
        }}
      />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function CategorySheet({ visible, onClose, onSelect }: { visible: boolean; onClose: () => void; onSelect: (s: CategorySelection) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Sheet visible={visible} onClose={onClose} title="Categories">
      {SHOOTING_CATEGORIES.map((g) => (
        <View key={g.id} style={{ marginBottom: 8 }}>
          <Pressable style={styles.groupRow} onPress={() => setOpen((o) => (o === g.name ? null : g.name))}>
            <Text style={styles.groupText}>{g.name}</Text>
            {open === g.name ? <ChevronDown size={18} color={colors.gray500} /> : <ChevronRight size={18} color={colors.gray500} />}
          </Pressable>
          {open === g.name && (
            <View style={{ paddingLeft: 8 }}>
              <Pressable style={styles.catRow} onPress={() => onSelect({ group: g.name })}>
                <Text style={{ color: colors.gold600, fontWeight: '700' }}>All {g.name}</Text>
              </Pressable>
              {g.categories.map((c) => (
                <View key={c.id}>
                  <Pressable style={styles.catRow} onPress={() => onSelect({ group: g.name, category: c.name })}>
                    <Text style={{ color: colors.gray900, fontWeight: '600' }}>{c.name}</Text>
                  </Pressable>
                  {(c.subcategories ?? []).map((s) => (
                    <Pressable
                      key={s.id}
                      style={[styles.catRow, { paddingLeft: 24 }]}
                      onPress={() => onSelect({ group: g.name, category: c.name, subcategory: s.name })}
                    >
                      <Text style={{ color: colors.gray600 }}>{s.name}</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </View>
          )}
        </View>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  banner: {
    margin: 6,
    marginTop: 12,
    padding: 20,
    borderRadius: 20,
    backgroundColor: colors.surfaceDeep,
    alignItems: 'center',
  },
  logoRing: { padding: 3, borderRadius: 48, borderWidth: 3, borderColor: colors.gold500 },
  logo: { width: 84, height: 84, borderRadius: 42 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245,179,1,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  chipText: { color: colors.gold300, fontSize: 11, fontWeight: '700' },
  storeTitle: { color: colors.white, fontSize: font.xl, fontWeight: '800', textAlign: 'center', marginTop: 10 },
  storeSub: { color: colors.gray400, fontSize: font.sm, textAlign: 'center', marginTop: 4 },
  stats: { flexDirection: 'row', gap: 8, marginHorizontal: 6, marginTop: 8 },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    padding: 12,
  },
  statLabel: { fontSize: font.xs, color: colors.gray500 },
  statValue: { fontSize: font.md, fontWeight: '800', color: colors.gray900, marginTop: 4 },
  listTitle: { fontSize: font.lg, fontWeight: '700', color: colors.gray800 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pillActive: { backgroundColor: colors.gold500, borderColor: colors.gold500 },
  pillText: { fontSize: font.xs, fontWeight: '700', color: colors.gray700 },
  uploadTile: {
    flex: 1,
    minHeight: 260,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.gold500,
    backgroundColor: 'rgba(245,179,1,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  uploadIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.gold500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  groupText: { fontSize: font.md, fontWeight: '800', color: colors.gray900, textTransform: 'uppercase' },
  catRow: { paddingVertical: 10, paddingLeft: 8 },
});
