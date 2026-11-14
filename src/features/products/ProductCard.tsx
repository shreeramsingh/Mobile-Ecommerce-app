import React, { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import {
  Eye, Heart, MapPin, MessageCircle, Pencil, ShoppingCart, Sparkles, Store, Trash2, Users,
} from 'lucide-react-native';
import type { Product } from '../../api/types';
import { isNewProduct, isOutOfStock, productAge, productsApi, stockLeftLabel } from '../../api/products';
import { usersApi } from '../../api/users';
import { ProductImage } from '../../components/ProductImage';
import { PriceTag } from '../../components/PriceTag';
import { ConfirmDialog } from '../../components/ui/Sheet';
import { toast } from '../../components/ui/Toast';
import { useWishlist } from '../wishlist/useWishlist';
import { useAppDispatch, useAppSelector } from '../../store';
import { addRecentlyViewed, removeRecentlyViewed } from '../../store/slices/recentlyViewedSlice';
import { errorMessage } from '../../api/client';
import { colors, font, radius } from '../../theme';

interface Props {
  item: Product;
  onDeleted?: (id: number) => void;
  /** Small card for horizontal rows: photo, title, price. */
  compact?: boolean;
  /** Hide the owner's edit/delete controls (owner sees "View item"). */
  readOnly?: boolean;
}

/** Seller display name for marketplace cards (products only carry the seller's node id). */
function useSellerName(item: Product, enabled: boolean) {
  const known = item.sellerName && item.sellerName !== item.sellerId ? item.sellerName : null;
  const q = useQuery({
    queryKey: ['userName', item.sellerId],
    queryFn: () => usersApi.nameByNodeId(item.sellerId!),
    enabled: enabled && !known && !!item.sellerId,
    staleTime: 60 * 60_000,
  });
  return known || q.data || 'Seller';
}

function ProductCardImpl({ item, onDeleted, compact, readOnly }: Props) {
  const navigation = useNavigation();
  const nodeId = useAppSelector((s) => s.auth.user?.nodeId);
  const isAdmin = useAppSelector((s) => s.auth.isAdmin);
  const { isFavorited, toggle, isReady } = useWishlist();
  const dispatch = useAppDispatch();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isStore = item.isStoreProduct === true;
  const isOwner = !!nodeId && nodeId === item.sellerId;
  const showOwnerControls = isOwner && !readOnly;
  const outOfStock = isOutOfStock(item);
  const stockLeft = stockLeftLabel(item);
  const favorited = isFavorited(item.id);
  const extraImages = Math.max(0, item.images.length - 1);
  const sellerName = useSellerName(item, !isStore && !compact);
  const accent = isStore ? colors.gold500 : colors.blue500;

  const openDetails = () => {
    dispatch(addRecentlyViewed(item));
    navigation.navigate('ProductDetails', { id: item.id, product: item });
  };

  const edit = () => {
    if (isStore && isAdmin) navigation.navigate('StoreProductForm', { product: item });
    else navigation.navigate('SellProduct', { productId: item.id });
  };

  const doDelete = async () => {
    try {
      setDeleting(true);
      await productsApi.remove(item.id);
      setConfirmDelete(false);
      dispatch(removeRecentlyViewed(item.id));
      onDeleted?.(item.id);
      toast.show('Product deleted');
    } catch (e) {
      toast.show(`Failed to delete: ${errorMessage(e)}`, 'error');
    } finally {
      setDeleting(false);
    }
  };

  // ── Image with badges and controls (shared by both layouts) ──
  const image = (
    <View style={[styles.imageWrap, { aspectRatio: isStore || compact ? 1 : 4 / 3 }]}>
      <ProductImage uri={item.images[0]} style={[styles.image, outOfStock && { opacity: 0.45 }]} />
      {outOfStock && (
        <View style={styles.oosOverlay} pointerEvents="none">
          <Text style={styles.oosText}>{isStore ? 'OUT OF STOCK' : 'SOLD'}</Text>
        </View>
      )}
      <View style={styles.badges} pointerEvents="none">
        {isStore ? (
          <View style={[styles.badge, { backgroundColor: colors.gold500 }]}>
            <Store size={11} color={colors.onAccent} />
            <Text style={[styles.badgeText, { color: colors.onAccent }]}>Store</Text>
          </View>
        ) : (
          <View style={[styles.badge, { backgroundColor: colors.blue600 }]}>
            <Users size={11} color={colors.white} />
            <Text style={[styles.badgeText, { color: colors.white }]}>Marketplace</Text>
          </View>
        )}
        {isNewProduct(item) && (
          <View style={[styles.badge, { backgroundColor: colors.red600 }]}>
            <Sparkles size={10} color={colors.white} />
            <Text style={[styles.badgeText, { color: colors.white }]}>NEW</Text>
          </View>
        )}
        {isStore && item.isNegotiable && (
          <View style={[styles.badge, { backgroundColor: 'rgba(20,83,45,0.92)' }]}>
            <Text style={[styles.badgeText, { color: '#86efac' }]}>Negotiable</Text>
          </View>
        )}
      </View>
      {!compact && (
        <View style={styles.topRight}>
          {showOwnerControls ? (
            <>
              <Pressable onPress={edit} style={styles.roundBtn} hitSlop={6} accessibilityLabel="Edit">
                <Pencil size={14} color={colors.amber500} />
              </Pressable>
              <Pressable onPress={() => setConfirmDelete(true)} style={styles.roundBtn} hitSlop={6} accessibilityLabel="Delete">
                <Trash2 size={14} color="#f87171" />
              </Pressable>
            </>
          ) : !isOwner ? (
            <Pressable
              onPress={() => toggle(item.id)}
              disabled={!isReady}
              style={styles.roundBtn}
              hitSlop={6}
              accessibilityLabel={favorited ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart size={16} color={favorited ? colors.red500 : colors.gray800} fill={favorited ? colors.red500 : 'transparent'} />
            </Pressable>
          ) : null}
        </View>
      )}
      {extraImages > 0 && (
        <View style={styles.photoCount} pointerEvents="none">
          <Text style={styles.photoCountText}>+{extraImages}</Text>
        </View>
      )}
    </View>
  );

  // ── Call to action ──
  const cta = isOwner ? (
    readOnly ? (
      <CtaButton label="View item" icon={Eye} color={accent} onPress={openDetails} />
    ) : (
      <CtaButton label="Edit item" icon={Pencil} color={accent} onPress={edit} />
    )
  ) : outOfStock ? (
    <View style={[styles.cta, { borderColor: colors.gray300 }]}>
      <Text style={[styles.ctaText, { color: colors.gray400 }]}>{isStore ? 'Out of stock' : 'Sold'}</Text>
    </View>
  ) : isStore ? (
    <CtaButton label="Add to cart & buy" icon={ShoppingCart} color={colors.gold500} onPress={openDetails} />
  ) : (
    <CtaButton label="Chat with seller" icon={MessageCircle} color={colors.blue600} onPress={openDetails} filled />
  );

  return (
    <>
      <Pressable
        onPress={openDetails}
        style={({ pressed }) => [styles.card, !isStore && styles.marketCard, pressed && { opacity: 0.92 }]}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ₹${item.price}`}
      >
        {image}
        {compact ? (
          <View style={styles.body}>
            <Text style={[styles.title, { minHeight: 0, fontSize: font.md }]} numberOfLines={1}>{item.title}</Text>
            <Text style={[styles.price, { marginTop: 4, color: accent }]} numberOfLines={1}>
              ₹{Number(item.price).toLocaleString('en-IN')}
            </Text>
          </View>
        ) : isStore ? (
          <View style={styles.body}>
            <PriceTag item={item} />
            <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.stock}>{stockLeft ?? ' '}</Text>
            <MetaRow item={item} />
            {cta}
          </View>
        ) : (
          <View style={styles.body}>
            <Text style={[styles.title, { fontWeight: '700', minHeight: 36 }]} numberOfLines={2}>{item.title}</Text>
            <View style={styles.priceRow}>
              <Text style={[styles.price, { color: colors.blue700 }]} numberOfLines={1}>
                {Number(item.price) > 0 ? `₹ ${Number(item.price).toLocaleString('en-IN')}` : 'Ask for price'}
              </Text>
              {item.isNegotiable && (
                <View style={styles.negotiable}>
                  <Text style={styles.negotiableText}>Negotiable</Text>
                </View>
              )}
            </View>
            <View style={styles.sellerRow}>
              <View style={styles.sellerAvatar}>
                <Text style={styles.sellerInitial}>{sellerName.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sellerName} numberOfLines={1}>{isOwner ? 'You' : sellerName}</Text>
                <Text style={styles.sellerSub}>Individual seller</Text>
              </View>
            </View>
            <MetaRow item={item} />
            {cta}
          </View>
        )}
      </Pressable>

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete product?"
        message={`"${item.title}" will be permanently removed.`}
        confirmLabel={deleting ? 'Deleting…' : 'Yes, delete'}
        destructive
        loading={deleting}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

function MetaRow({ item }: { item: Product }) {
  return (
    <View style={styles.metaRow}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, flex: 1 }}>
        <MapPin size={11} color={colors.gray500} />
        <Text style={styles.meta} numberOfLines={1}>{item.location || 'India'}</Text>
      </View>
      <Text style={styles.meta}>{productAge(item)}</Text>
    </View>
  );
}

function CtaButton({
  label,
  icon: Icon,
  color,
  onPress,
  filled,
}: {
  label: string;
  icon: typeof Eye;
  color: string;
  onPress: () => void;
  filled?: boolean;
}) {
  const fg = filled ? colors.white : color;
  return (
    <Pressable onPress={onPress} style={[styles.cta, { borderColor: color }, filled && { backgroundColor: color }]}>
      <Icon size={13} color={fg} />
      <Text style={[styles.ctaText, { color: fg }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export const ProductCard = memo(ProductCardImpl);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    overflow: 'hidden',
  },
  marketCard: { borderColor: 'rgba(59,130,246,0.45)' },
  imageWrap: { backgroundColor: colors.surfaceAlt },
  image: { width: '100%', height: '100%' },
  oosOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  oosText: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    color: colors.white,
    fontWeight: '800',
    fontSize: font.xs,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    overflow: 'hidden',
  },
  badges: { position: 'absolute', top: 8, left: 8, gap: 4, alignItems: 'flex-start' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  topRight: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', gap: 6 },
  roundBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCount: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  photoCountText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  body: { padding: 10, flex: 1 },
  price: { fontSize: font.lg, fontWeight: '800', color: colors.gold500 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' },
  negotiable: { backgroundColor: 'rgba(34,197,94,0.16)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  negotiableText: { color: colors.green700, fontSize: 10, fontWeight: '700' },
  title: { fontSize: font.sm, fontWeight: '500', color: colors.gray800, minHeight: 34, marginTop: 2 },
  stock: { fontSize: font.xs, fontWeight: '600', color: colors.green600, marginTop: 2 },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  sellerAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(59,130,246,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerInitial: { color: colors.blue700, fontWeight: '800', fontSize: 12 },
  sellerName: { color: colors.gray800, fontSize: font.xs, fontWeight: '700' },
  sellerSub: { color: colors.gray500, fontSize: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  meta: { fontSize: font.xs, color: colors.gray500 },
  cta: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  ctaText: { fontSize: font.xs, fontWeight: '700' },
});
