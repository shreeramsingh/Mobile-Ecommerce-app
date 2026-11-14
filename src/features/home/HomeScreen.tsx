import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Check, MessageCircle, ShoppingCart, type LucideIcon } from 'lucide-react-native';
import type { Product } from '../../api/types';
import { effectivePrice, productsApi } from '../../api/products';
import { AppHeader } from '../../components/AppHeader';
import { ProductCard } from '../products/ProductCard';
import { ProductCardSkeleton } from '../products/ProductCardSkeleton';
import { applyFilters, flattenPages, PAGE_SIZE, useProductFeed } from '../products/queries';
import { useAppDispatch, useAppSelector } from '../../store';
import { addRecentlyViewed, refreshRecentlyViewed, removeRecentlyViewed } from '../../store/slices/recentlyViewedSlice';
import { Button, EmptyState, ErrorBox } from '../../components/ui';
import { HeroCarousel, type HeroSlide } from './HeroCarousel';
import { HowItWorks } from './HowItWorks';
import { CategoryBar, type CategoryFilter, type ShopMode } from './CategoryBar';
import { errorMessage } from '../../api/client';
import { colors, font, radius } from '../../theme';

// Two ways to buy — never mixed in one grid (same as the website).
const SHOP_MODES: Record<ShopMode, { title: string; tagline: string; points: string[]; howToBuy: string; icon: LucideIcon; color: string; fg: string }> = {
  store: {
    title: 'Bandookwale Store',
    tagline: 'New products at a fixed price',
    points: ['Add to cart & pay online', 'Delivered to your door'],
    howToBuy: 'Fixed price — add to cart, check out, and we deliver it.',
    icon: ShoppingCart,
    color: colors.gold500,
    fg: colors.onAccent,
  },
  listing: {
    title: 'Marketplace',
    tagline: 'Items posted by individual sellers',
    points: ['Chat with the seller & negotiate', 'Meet & inspect before you pay'],
    howToBuy: 'Posted by individual sellers — chat to agree a price, then meet to buy.',
    icon: MessageCircle,
    color: colors.blue500,
    fg: colors.white,
  },
};
const HERO_STORE_LIMIT = 50;

export function HomeScreen() {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const searchQuery = useAppSelector((s) => s.filters.searchQuery);
  const selectedCity = useAppSelector((s) => s.filters.selectedCity);
  const [mode, setMode] = useState<ShopMode>('store');
  const [category, setCategory] = useState<CategoryFilter | null>(null);
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const listRef = useRef<FlashListRef<Product>>(null);

  // One feed: `isStoreProduct=false` returns both store products and listings.
  const feed = useProductFeed(false);
  const all = useMemo(() => flattenPages(feed.data).filter((p) => !hidden.has(p.id)), [feed.data, hidden]);

  // Hero: store products with a real photo.
  const heroQ = useQuery({
    queryKey: ['products', 'heroStore'],
    queryFn: () => productsApi.list({ page: 0, size: HERO_STORE_LIMIT, isStoreProduct: true }).then((r) => r.items),
    staleTime: 5 * 60_000,
  });
  const heroSlides: HeroSlide[] = useMemo(
    () =>
      (heroQ.data ?? [])
        .filter((p) => !!p.images[0])
        .map((p) => ({
          image: p.images[0],
          title: p.title,
          subtitle: `₹ ${effectivePrice(p).toLocaleString('en-IN')}`,
          onOpen: () => {
            dispatch(addRecentlyViewed(p));
            navigation.navigate('ProductDetails', { id: p.id, product: p });
          },
        })),
    [heroQ.data, dispatch, navigation],
  );

  // Keep recently-viewed copies fresh with newly loaded data.
  useEffect(() => {
    if (all.length) dispatch(refreshRecentlyViewed(all));
  }, [all, dispatch]);

  const searched = useMemo(() => applyFilters(all, searchQuery, selectedCity), [all, searchQuery, selectedCity]);
  const storeProducts = useMemo(() => searched.filter((p) => p.isStoreProduct === true), [searched]);
  const marketProducts = useMemo(() => searched.filter((p) => p.isStoreProduct !== true), [searched]);
  const modeList = mode === 'store' ? storeProducts : marketProducts;
  const visible = useMemo(() => (category ? modeList.filter(category.match) : modeList), [modeList, category]);
  const counts = { store: storeProducts.length, listing: marketProducts.length };
  const other: ShopMode = mode === 'store' ? 'listing' : 'store';

  // Auto-fill: keep loading pages until this section has a page of items or the feed ends.
  useEffect(() => {
    if (!feed.isLoading && !feed.isFetchingNextPage && feed.hasNextPage && visible.length < PAGE_SIZE) {
      feed.fetchNextPage();
    }
  }, [feed, visible.length]);

  const selectMode = (m: ShopMode, scroll = false) => {
    if (m !== mode) setCategory(null);
    setMode(m);
    if (scroll) listRef.current?.scrollToIndex({ index: 0, animated: true, viewOffset: 160 });
  };

  const loadMore = useCallback(() => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
  }, [feed]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    setHidden(new Set());
    await Promise.all([feed.refetch(), heroQ.refetch()]);
    setRefreshing(false);
  };

  const onDeleted = useCallback(
    (id: number) => {
      setHidden((prev) => new Set(prev).add(id));
      dispatch(removeRecentlyViewed(id));
    },
    [dispatch],
  );

  const showGrid = category === null;
  const M = SHOP_MODES[mode];
  const filterLabel =
    [category?.label, selectedCity ? `📍 ${selectedCity}` : '', searchQuery ? `🔍 "${searchQuery}"` : '']
      .filter(Boolean)
      .join(' · ');

  const header = (
    <View>
      {showGrid && !searchQuery && (
        <HeroCarousel slides={heroSlides} onShopStore={() => selectMode('store', true)} onMarketplace={() => selectMode('listing', true)} />
      )}

      <View style={styles.productsHead}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <Text style={styles.heading}>
            {M.title}
            {filterLabel ? ` · ${filterLabel}` : ''} <Text style={{ color: colors.gray400, fontWeight: '400' }}>({visible.length})</Text>
          </Text>
          {category && (
            <Pressable onPress={() => setCategory(null)} hitSlop={8}>
              <Text style={{ color: colors.blue700, fontWeight: '600' }}>← All Categories</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.subheading}>There are two ways to buy here — choose one below.</Text>

        <View style={styles.choices}>
          {(['store', 'listing'] as ShopMode[]).map((k) => {
            const m = SHOP_MODES[k];
            const active = mode === k;
            const Icon = m.icon;
            return (
              <Pressable
                key={k}
                onPress={() => selectMode(k)}
                style={[styles.choice, active ? { borderColor: m.color, backgroundColor: `${m.color}1A` } : { opacity: 0.7 }]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.choiceIcon, { backgroundColor: m.color }]}>
                    <Icon size={18} color={m.fg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.choiceTitle} numberOfLines={1}>{m.title}</Text>
                    <Text style={styles.choiceTag} numberOfLines={1}>{m.tagline}</Text>
                  </View>
                  {active ? (
                    <View style={[styles.showing, { backgroundColor: m.color }]}>
                      <Check size={11} color={m.fg} />
                      <Text style={[styles.showingText, { color: m.fg }]}>Showing</Text>
                    </View>
                  ) : (
                    <Text style={styles.count}>{counts[k]} items</Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.howTo, { borderColor: `${M.color}55`, backgroundColor: `${M.color}14` }]}>
          <M.icon size={14} color={M.color} />
          <Text style={[styles.howToText, { color: mode === 'store' ? colors.gold600 : colors.blue700 }]}>{M.howToBuy}</Text>
        </View>
        {feed.error ? <ErrorBox message={errorMessage(feed.error)} onRetry={onRefresh} /> : null}
      </View>

      {feed.isLoading && (
        <View style={styles.skeletonGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={styles.skeletonCell}>
              <ProductCardSkeleton />
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const otherTitle = SHOP_MODES[other].title;
  const emptyTitle = searchQuery
    ? `No results for "${searchQuery}" in the ${M.title}`
    : selectedCity
    ? `No ${M.title} items in ${selectedCity}`
    : category
    ? `No ${M.title} items in "${category.label}"`
    : mode === 'store'
    ? 'Nothing in the Bandookwale Store yet'
    : 'No Marketplace items yet';
  const emptyMessage = category
    ? 'Try a different category'
    : counts[other] > 0
    ? `The ${otherTitle} has ${counts[other]} matching item${counts[other] === 1 ? '' : 's'}`
    : searchQuery || selectedCity
    ? 'Try adjusting your search or location filter'
    : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.navy }}>
      <AppHeader />
      <CategoryBar mode={mode} selected={category} onSelect={setCategory} />
      <FlashList
        ref={listRef}
        data={feed.isLoading ? [] : visible}
        numColumns={2}
        keyExtractor={(p) => String(p.id)}
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <ProductCard item={item} onDeleted={onDeleted} />
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          feed.isLoading || feed.isFetchingNextPage ? null : (
            <EmptyState
              emoji={searchQuery ? '🔍' : selectedCity ? '📍' : mode === 'store' ? '🛒' : '💬'}
              title={emptyTitle}
              message={emptyMessage}
              action={
                category ? (
                  <Button title="All categories" variant="ghost" onPress={() => setCategory(null)} />
                ) : counts[other] > 0 ? (
                  <Button title={`Go to ${otherTitle}`} variant="outline" onPress={() => selectMode(other)} />
                ) : undefined
              }
            />
          )
        }
        ListFooterComponent={
          <View>
            {/* Fixed-height slot so showing/hiding the spinner never shifts the content. */}
            <View style={{ height: 56, justifyContent: 'center' }}>
              {feed.isFetchingNextPage && <ActivityIndicator color={colors.gold500} />}
            </View>
            {showGrid && !searchQuery && !feed.isLoading && <HowItWorks />}
          </View>
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold500} />}
        contentContainerStyle={{ paddingHorizontal: 6, paddingBottom: 24 }}
        keyboardDismissMode="on-drag"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  productsHead: {
    marginTop: 20,
    marginHorizontal: 6,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    paddingBottom: 6,
    paddingHorizontal: 6,
  },
  heading: { flex: 1, fontSize: font.lg, fontWeight: '800', color: colors.white },
  subheading: { color: colors.gray500, fontSize: font.sm, marginTop: 4 },
  choices: { gap: 8, marginTop: 12 },
  choice: {
    borderWidth: 1.5,
    borderColor: colors.gray200,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 12,
  },
  choiceIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  choiceTitle: { color: colors.white, fontWeight: '800', fontSize: font.md },
  choiceTag: { color: colors.gray500, fontSize: font.xs, marginTop: 1 },
  count: { color: colors.gray500, fontSize: font.xs, fontWeight: '700' },
  showing: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  showingText: { fontSize: 10, fontWeight: '800' },
  howTo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 10,
  },
  howToText: { flex: 1, fontSize: font.xs, fontWeight: '600' },
  cell: { flex: 1, padding: 5 },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  skeletonCell: { width: '50%', padding: 5 },
});
