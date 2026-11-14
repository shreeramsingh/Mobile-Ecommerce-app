import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban, CheckCircle, Clock, Eye, Handshake, Heart, Link2, MapPin, MessageCircle,
  Scale, Search, Share2, ShieldCheck, ShoppingCart, Star, Store,
} from 'lucide-react-native';
import type { RootScreenProps } from '../../navigation/types';
import type { Product, Review } from '../../api/types';
import { effectivePrice, isOutOfStock, productAge, stockLeftLabel } from '../../api/products';
import { PriceTag } from '../../components/PriceTag';
import { reviewsApi, viewsApi } from '../../api/social';
import { usersApi } from '../../api/users';
import { useProduct, useSellerProducts, useSimilarProducts } from './queries';
import { Gallery } from './Gallery';
import { ProductCard } from './ProductCard';
import { useWishlist } from '../wishlist/useWishlist';
import { useAppDispatch, useAppSelector } from '../../store';
import { addToCart as addToCartAction, selectIsInCart, type CartItem } from '../../store/slices/cartSlice';
import { addRecentlyViewed } from '../../store/slices/recentlyViewedSlice';
import { useRequireAuth } from '../auth/useRequireAuth';
import { weaponDetails } from '../../data/weaponCategories';
import { AppText, Button, Card, EmptyState, Loader, Row } from '../../components/ui';
import { toast } from '../../components/ui/Toast';
import { WEB_ORIGIN } from '../../config/env';
import { colors, font, radius, spacing } from '../../theme';

const SAFETY_TIPS = [
  { icon: Handshake, text: 'Meet the seller in a safe, public place' },
  { icon: Search, text: 'Inspect the item properly before you pay' },
  { icon: Ban, text: "Never pay in advance to someone you haven't met" },
  { icon: Scale, text: 'Check your local laws for replicas and airsoft items' },
];

export function ProductDetailsScreen({ route, navigation }: RootScreenProps<'ProductDetails'>) {
  const { id, product: initial } = route.params;
  const { data: item, isLoading, refetch } = useProduct(id, initial);

  if (isLoading && !item) return <Loader style={{ flex: 1 }} />;
  if (!item)
    return (
      <EmptyState
        emoji="📭"
        title="No product found"
        message="It may have been sold or removed."
        action={<Button title="Go back" variant="ghost" onPress={() => navigation.goBack()} />}
      />
    );
  return <ProductDetails item={item} onRefresh={refetch} />;
}

function ProductDetails({ item }: { item: Product; onRefresh: () => void }) {
  const navigation = useNavigation();
  const user = useAppSelector((s) => s.auth.user);
  const requireAuth = useRequireAuth();
  const dispatch = useAppDispatch();
  const addToCart = (c: Omit<CartItem, 'quantity'>) => dispatch(addToCartAction(c));
  const inCart = useAppSelector(selectIsInCart(String(item.id)));
  const addRecent = (p: Product) => dispatch(addRecentlyViewed(p));
  const { isFavorited, toggle, isReady } = useWishlist();
  const [justAdded, setJustAdded] = useState(false);
  const [showOffer, setShowOffer] = useState(false);
  const [offer, setOffer] = useState('');

  const isStore = item.isStoreProduct === true;
  const isOwner = !!user?.nodeId && user.nodeId === item.sellerId;
  const outOfStock = isOutOfStock(item);
  const stockLeft = stockLeftLabel(item);
  const weapon = weaponDetails(item);
  const favorited = isFavorited(item.id);

  // Seller name: products only carry the seller's node id, so look the name up.
  const knownName = item.sellerName && item.sellerName !== item.sellerId ? item.sellerName : null;
  const sellerNameQ = useQuery({
    queryKey: ['userName', item.sellerId],
    queryFn: () => usersApi.nameByNodeId(item.sellerId!),
    enabled: !knownName && !!item.sellerId,
    staleTime: 60 * 60_000,
  });
  const sellerName = knownName || sellerNameQ.data || 'Seller';

  const viewsQ = useQuery({ queryKey: ['views', item.id], queryFn: () => viewsApi.count(item.id) });
  const similarQ = useSimilarProducts(item.categoryId, isStore);
  const fromSellerQ = useSellerProducts(item.sellerId, isStore, 13);
  const similar = useMemo(() => (similarQ.data ?? []).filter((p) => p.id !== item.id).slice(0, 12), [similarQ.data, item.id]);
  const fromSeller = useMemo(
    () => (fromSellerQ.data?.items ?? []).filter((p) => p.id !== item.id).slice(0, 12),
    [fromSellerQ.data, item.id],
  );

  useEffect(() => {
    addRecent(item);
    viewsApi.record(user?.nodeId, item.id).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const handleAddToCart = () =>
    requireAuth(() => {
      if (outOfStock) return toast.show('This product is out of stock', 'error');
      addToCart({ id: String(item.id), title: item.title, price: effectivePrice(item), originalPrice: Number(item.price), image: item.images[0], location: item.location });
      setJustAdded(true);
      toast.show('Added to cart 🛒');
      setTimeout(() => setJustAdded(false), 2000);
    }, 'Sign in to add items to your cart');

  const buyNow = () =>
    requireAuth(() => {
      if (!inCart) addToCart({ id: String(item.id), title: item.title, price: effectivePrice(item), originalPrice: Number(item.price), image: item.images[0], location: item.location });
      navigation.navigate('Cart');
    }, 'Sign in to buy');

  const openChat = (initialMessage?: string) =>
    requireAuth(() => {
      if (outOfStock && !isOwner) return toast.show('This product is out of stock', 'error');
      navigation.navigate('Chat', {
        productId: String(item.id),
        productTitle: item.title,
        productImage: item.images[0],
        sellerId: item.sellerId,
        sellerName,
        initialMessage,
      });
    }, 'Sign in to chat with the seller');

  const sendOffer = () => {
    const amount = Number(offer);
    if (!amount || amount <= 0) return toast.show('Enter a valid offer amount', 'error');
    openChat(`Hi! I'm interested in "${item.title}". Would you accept ₹${amount.toLocaleString('en-IN')}?`);
  };

  const shareUrl = `${WEB_ORIGIN}/productdetails?id=${item.id}`;
  const shareText = `${item.title} — ₹${effectivePrice(item).toLocaleString('en-IN')} on Bandookwale`;
  const share = () => Share.share({ message: `${shareText}\n${shareUrl}`, url: shareUrl, title: item.title }).catch(() => {});
  const copyLink = () => {
    Clipboard.setString(shareUrl);
    toast.show('Link copied 🔗');
  };
  const whatsapp = () => {
    const text = encodeURIComponent(`${shareText}\n${shareUrl}`);
    Linking.openURL(`whatsapp://send?text=${text}`).catch(() => Linking.openURL(`https://wa.me/?text=${text}`));
  };
  const openMap = () =>
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location)}`);

  const detailRows = [
    ['Brand', item.brand],
    ['Category', weapon.category],
    ['Weapon type', [weapon.type, weapon.subType].filter(Boolean).join(' · ')],
    ['Caliber / Gauge', weapon.caliber],
    ['Licence required', item.isLicenseRequired == null ? null : item.isLicenseRequired ? 'Yes' : 'No'],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.gray100 }} contentContainerStyle={{ paddingBottom: 40 }}>
      <Gallery images={item.images} title={item.title} />

      <View style={{ padding: spacing.md, gap: spacing.md }}>
        {/* Price & actions */}
        <Card>
          <Row style={{ flexWrap: 'wrap', marginBottom: 10 }} gap={6}>
            {isStore ? (
              <Pill icon={Store} label="Store product" bg="rgba(245,179,1,0.15)" fg={colors.gold600} />
            ) : (
              <Pill icon={MessageCircle} label="Marketplace listing" bg="rgba(59,130,246,0.12)" fg={colors.blue600} />
            )}
            {item.isNegotiable && <Pill label="Negotiable" bg="rgba(34,197,94,0.15)" fg={colors.green700} />}
            {!!viewsQ.data && (
              <Pill icon={Eye} label={`${viewsQ.data.toLocaleString('en-IN')} ${viewsQ.data === 1 ? 'view' : 'views'}`} bg={colors.gray100} fg={colors.gray500} />
            )}
          </Row>

          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              {isStore ? <PriceTag item={item} size="lg" /> : <Text style={styles.price}>₹ {Number(item.price).toLocaleString('en-IN')}</Text>}
            </View>
            <Row gap={4}>
              <IconBtn onPress={share} label="Share">
                <Share2 size={20} color={colors.gray500} />
              </IconBtn>
              {!isOwner && (
                <IconBtn onPress={() => toggle(item.id)} label={favorited ? 'Remove from wishlist' : 'Add to wishlist'} disabled={!isReady}>
                  <Heart size={20} color={favorited ? colors.red500 : colors.gray500} fill={favorited ? colors.red500 : 'transparent'} />
                </IconBtn>
              )}
            </Row>
          </Row>
          <AppText variant="subheading" style={{ marginTop: 6 }}>{item.title}</AppText>
          {stockLeft && <Text style={styles.stock}>In stock · {stockLeft}</Text>}
          <Row style={{ justifyContent: 'space-between', marginTop: 10, flexWrap: 'wrap' }}>
            <Row gap={4}>
              <MapPin size={14} color={colors.gray500} />
              <AppText muted>{item.location || 'India'}</AppText>
            </Row>
            <Row gap={4}>
              <Clock size={14} color={colors.gray500} />
              <AppText muted>{productAge(item)}</AppText>
            </Row>
          </Row>

          {outOfStock && !isOwner && (
            <View style={styles.oos}>
              <Text style={{ fontWeight: '700', color: colors.gray500 }}>Out of stock</Text>
              <Text style={{ fontSize: font.xs, color: colors.gray500, marginTop: 2 }}>This item is currently unavailable.</Text>
            </View>
          )}

          {isStore && !isOwner && !outOfStock && (
            <View style={{ gap: 8, marginTop: 16 }}>
              <Button title="Buy now" onPress={buyNow} />
              <Button
                title={justAdded ? 'Added!' : inCart ? 'In cart · View cart' : 'Add to cart'}
                icon={justAdded || inCart ? CheckCircle : ShoppingCart}
                variant="outline"
                onPress={inCart ? () => navigation.navigate('Cart') : handleAddToCart}
                style={inCart ? { borderColor: colors.green500 } : undefined}
              />
            </View>
          )}

          {!isStore && !isOwner && !outOfStock && (
            <View style={{ gap: 8, marginTop: 16 }}>
              <Button title="Chat with seller" icon={MessageCircle} variant="blue" onPress={() => openChat()} />
              {item.isNegotiable &&
                (showOffer ? (
                  <Row>
                    <View style={styles.offerInput}>
                      <Text style={{ color: colors.gray500 }}>₹</Text>
                      <TextInput
                        value={offer}
                        onChangeText={(t) => setOffer(t.replace(/[^\d]/g, ''))}
                        keyboardType="number-pad"
                        placeholder="Your offer"
                        placeholderTextColor={colors.gray400}
                        autoFocus
                        onSubmitEditing={sendOffer}
                        style={{ flex: 1, fontSize: font.md, color: colors.gray900, paddingHorizontal: 6 }}
                      />
                    </View>
                    <Button title="Send" variant="success" onPress={sendOffer} />
                  </Row>
                ) : (
                  <Button
                    title="Make an offer"
                    icon={Handshake}
                    variant="outline"
                    onPress={() => setShowOffer(true)}
                    style={{ borderColor: colors.green600 }}
                  />
                ))}
            </View>
          )}

          <Row style={styles.shareRow}>
            {isStore ? (
              <Pressable style={[styles.shareBtn, { backgroundColor: 'rgba(37,211,102,0.15)' }]} onPress={whatsapp}>
                <MessageCircle size={16} color={colors.whatsapp} />
                <Text style={[styles.shareText, { color: '#25D366' }]}>WhatsApp</Text>
              </Pressable>
            ) : outOfStock && !isOwner ? null : (
              <Pressable style={[styles.shareBtn, { backgroundColor: 'rgba(37,99,235,0.12)' }]} onPress={() => openChat()}>
                <MessageCircle size={16} color={colors.blue600} />
                <Text style={[styles.shareText, { color: colors.blue600 }]}>{isOwner ? 'Chat' : 'Chat with seller'}</Text>
              </Pressable>
            )}
            <Pressable style={[styles.shareBtn, { backgroundColor: colors.gray100 }]} onPress={copyLink}>
              <Link2 size={16} color={colors.gray600} />
              <Text style={[styles.shareText, { color: colors.gray600 }]}>Copy link</Text>
            </Pressable>
          </Row>
        </Card>

        {/* Seller */}
        <Card>
          <Row gap={12}>
            <View style={styles.sellerAvatar}>
              <Text style={{ color: colors.white, fontWeight: '800', fontSize: font.lg }}>{sellerName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="caption">{isStore ? 'Sold by' : 'Posted by'}</AppText>
              <Row gap={4}>
                <AppText variant="subheading" numberOfLines={1}>{sellerName}</AppText>
                {isStore && <Store size={15} color={colors.gold500} />}
              </Row>
              {fromSellerQ.isSuccess && (
                <AppText variant="caption">
                  {fromSeller.length + 1} active {fromSeller.length === 0 ? 'item' : 'items'}
                </AppText>
              )}
            </View>
          </Row>
          {isStore ? (
            <Button
              title="View store"
              icon={Store}
              variant="outline"
              size="sm"
              style={{ marginTop: 14 }}
              onPress={() => navigation.navigate('Store', { sellerId: item.sellerId })}
            />
          ) : (
            !isOwner &&
            !outOfStock && (
              <Button
                title="Chat with seller"
                icon={MessageCircle}
                variant="outline"
                size="sm"
                style={{ marginTop: 14, borderColor: colors.blue600 }}
                onPress={() => openChat()}
              />
            )
          )}
        </Card>

        {/* Details */}
        <Card>
          <AppText variant="heading" style={{ marginBottom: 6 }}>Details</AppText>
          {detailRows.map(([label, value]) => (
            <DetailRow key={label} label={label} value={value} />
          ))}
          <DetailRow label="Type" value={isStore ? 'Store product' : 'Marketplace listing'} />
          {item.isNegotiable && <DetailRow label="Price" value="Negotiable" valueColor={colors.green600} />}
          <DetailRow label="Ad ID" value={String(item.id)} />
          <AppText variant="heading" style={{ marginTop: 16 }}>Description</AppText>
          <AppText style={{ marginTop: 6, color: colors.gray600, lineHeight: 21 }}>
            {item.description || 'No description provided.'}
          </AppText>
        </Card>

        {!isStore && (
          <Card>
            <Row style={{ marginBottom: 10 }}>
              <ShieldCheck size={20} color={colors.green500} />
              <AppText variant="subheading">Stay safe</AppText>
            </Row>
            {SAFETY_TIPS.map(({ icon: Icon, text }) => (
              <Row key={text} style={{ marginBottom: 8, alignItems: 'flex-start' }}>
                <Icon size={16} color={colors.gray400} />
                <AppText style={{ flex: 1, color: colors.gray600, fontSize: font.sm }}>{text}</AppText>
              </Row>
            ))}
          </Card>
        )}

        {!!item.location && (
          <Card>
            <AppText variant="subheading">{isStore ? 'Ships from' : 'Posted in'}</AppText>
            <AppText muted style={{ marginTop: 4 }}>{item.location}</AppText>
            <Button title="Open in Maps" icon={MapPin} variant="ghost" size="sm" style={{ marginTop: 12 }} onPress={openMap} />
          </Card>
        )}

        <Reviews productId={item.id} />
      </View>

      <ProductRow title="Similar products" items={similar} />
      <ProductRow title={`More from ${sellerName}`} items={fromSeller} />
    </ScrollView>
  );
}

// ─── Reviews ──────────────────────────────────────────────────────────────────
function Reviews({ productId }: { productId: number }) {
  const user = useAppSelector((s) => s.auth.user);
  const requireAuth = useRequireAuth();
  const qc = useQueryClient();
  const key = ['reviews', productId];
  const { data: reviews = [], isLoading } = useQuery({ queryKey: key, queryFn: () => reviewsApi.byProduct(productId) });
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  const post = useMutation({
    mutationFn: () => reviewsApi.post({ productFkId: productId, userFkId: user!.nodeId!, rating, comment: comment.trim() }),
    onSuccess: (posted) => {
      // The response isn't always the review, so build it from what we sent, then reload.
      qc.setQueryData<Review[]>(key, (prev = []) => [
        { userReviewPkId: posted?.userReviewPkId, userFkId: user!.nodeId!, userName: user?.name || 'You', rating, comment: comment.trim(), createdAt: new Date().toISOString() },
        ...prev,
      ]);
      qc.invalidateQueries({ queryKey: key });
      setRating(0);
      setComment('');
      toast.show('Review submitted — thank you!');
    },
    onError: () => setError('Failed to submit review. Please try again.'),
  });

  const submit = () =>
    requireAuth(() => {
      if (!rating) return setError('Please select a star rating.');
      if (!comment.trim()) return setError('Please write a comment.');
      setError('');
      post.mutate();
    }, 'Sign in to write a review');

  const ratings = reviews.map((r) => Number(r.rating)).filter((n) => n >= 1 && n <= 5);
  const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <AppText variant="heading">Reviews ({reviews.length})</AppText>
        {ratings.length > 0 && (
          <Row gap={6}>
            <Stars value={Math.round(avg)} size={14} />
            <AppText style={{ fontWeight: '600' }}>{avg.toFixed(1)} / 5</AppText>
          </Row>
        )}
      </Row>

      <View style={styles.reviewForm}>
        <AppText style={{ fontWeight: '600', marginBottom: 8 }}>Write a review</AppText>
        <Stars value={rating} onChange={setRating} size={28} />
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Share your experience with this product..."
          placeholderTextColor={colors.gray400}
          multiline
          style={styles.reviewInput}
        />
        {!!error && <Text style={{ color: colors.red600, fontSize: font.xs, marginTop: 4 }}>{error}</Text>}
        <Button title={post.isPending ? 'Submitting...' : 'Submit review'} size="sm" loading={post.isPending} onPress={submit} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
      </View>

      {isLoading ? (
        <AppText muted style={{ textAlign: 'center', paddingVertical: 12 }}>Loading reviews...</AppText>
      ) : reviews.length === 0 ? (
        <AppText muted style={{ textAlign: 'center', paddingVertical: 12 }}>No reviews yet. Be the first to review!</AppText>
      ) : (
        reviews.map((r, i) => {
          const name = r.userName || r.userId || r.userFkId || 'U';
          const date = r.createdDateTime || r.createdAt;
          return (
            <View key={r.reviewId ?? r.userReviewPkId ?? i} style={styles.review}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row style={{ flex: 1 }}>
                  <View style={styles.reviewAvatar}>
                    <Text style={{ color: colors.white, fontWeight: '700' }}>{name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <AppText style={{ fontWeight: '600', flex: 1 }} numberOfLines={1}>{name}</AppText>
                </Row>
                <Stars value={r.rating} size={14} />
              </Row>
              <AppText style={{ marginLeft: 42, color: colors.gray600, fontSize: font.sm }}>{r.comment}</AppText>
              {date && (
                <AppText variant="caption" style={{ marginLeft: 42, marginTop: 2 }}>
                  {new Date(date).toLocaleDateString('en-IN')}
                </AppText>
              )}
            </View>
          );
        })
      )}
    </Card>
  );
}

// ─── Small pieces ─────────────────────────────────────────────────────────────
function Stars({ value, onChange, size }: { value: number; onChange?: (v: number) => void; size: number }) {
  return (
    <Row gap={2}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Pressable key={s} disabled={!onChange} onPress={() => onChange?.(s)} hitSlop={4} accessibilityLabel={`${s} star`}>
          <Star size={size} color={value >= s ? colors.gold400 : colors.gray300} fill={value >= s ? colors.gold400 : 'transparent'} />
        </Pressable>
      ))}
    </Row>
  );
}

function Pill({ label, bg, fg, icon: Icon }: { label: string; bg: string; fg: string; icon?: typeof Eye }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {Icon && <Icon size={12} color={fg} />}
      <Text style={{ color: fg, fontSize: font.xs, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

function IconBtn({ children, onPress, label, disabled }: { children: React.ReactNode; onPress: () => void; label: string; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityLabel={label} hitSlop={6} style={styles.iconBtn}>
      {children}
    </Pressable>
  );
}

function DetailRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.detailRow}>
      <AppText muted>{label}</AppText>
      <AppText style={{ fontWeight: '600', flex: 1, textAlign: 'right', color: valueColor ?? colors.gray900 }}>{value}</AppText>
    </View>
  );
}

function ProductRow({ title, items }: { title: string; items: Product[] }) {
  if (!items.length) return null;
  return (
    <View style={{ marginTop: 8 }}>
      <AppText variant="heading" style={{ paddingHorizontal: spacing.md, marginBottom: 10 }}>{title}</AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 10 }}>
        {items.map((p) => (
          <View key={p.id} style={{ width: 160 }}>
            <ProductCard item={p} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  price: { fontSize: font.xxxl, fontWeight: '800', color: colors.gold600, flex: 1 },
  stock: { color: colors.green600, fontWeight: '700', fontSize: font.sm, marginTop: 4 },
  oos: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.gray300,
    backgroundColor: colors.gray100,
    alignItems: 'center',
  },
  offerInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    height: 48,
  },
  shareRow: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.gray200 },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.sm + 2,
  },
  shareText: { fontSize: font.xs, fontWeight: '700' },
  sellerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gold500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  reviewForm: {
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  reviewInput: {
    marginTop: 10,
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: radius.sm + 2,
    padding: 10,
    backgroundColor: colors.surface,
    textAlignVertical: 'top',
    color: colors.gray900,
    fontSize: font.sm,
  },
  review: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.gray200 },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gold500,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
