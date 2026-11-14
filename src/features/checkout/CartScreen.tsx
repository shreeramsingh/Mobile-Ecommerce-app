import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Clock, Landmark, MapPin, Package, ShoppingCart, Trash2 } from 'lucide-react-native';
import type { RootScreenProps } from '../../navigation/types';
import type { PaymentSubmission, ShopOrder } from '../../api/types';
import { useAppDispatch, useAppSelector } from '../../store';
import { clearCart, removeFromCart, selectCartCount, selectCartItems, selectCartTotal } from '../../store/slices/cartSlice';
import { AppText, Button, Card, EmptyState, ErrorBox, Row } from '../../components/ui';
import { ConfirmDialog } from '../../components/ui/Sheet';
import { ProductImage } from '../../components/ProductImage';
import { AddressSheet } from './AddressSheet';
import { VoucherBox } from './VoucherBox';
import type { VoucherQuote } from '../../api/promo';
import { orderPayable } from '../../api/payments';
import { ManualPaymentSheet } from './ManualPaymentSheet';
import { readJson, storage, writeJson } from '../../lib/storage';
import { formatInr } from '../../lib/format';
import { colors, font, radius, spacing } from '../../theme';

// An order created at the address step but not yet paid for. Re-used if the buyer
// closes the payment sheet and tries again, so we don't create duplicate orders.
const PENDING_ORDER_KEY = 'checkout.pendingOrder';
interface PendingOrder {
  signature: string;
  order: ShopOrder;
}

export function CartScreen({ navigation }: RootScreenProps<'Cart'>) {
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectCartItems);
  const count = useAppSelector(selectCartCount);
  const total = useAppSelector(selectCartTotal);
  const remove = (id: string) => dispatch(removeFromCart(id));
  const clear = () => dispatch(clearCart());
  const qc = useQueryClient();

  const [addressOpen, setAddressOpen] = useState(false);
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [submitted, setSubmitted] = useState<PaymentSubmission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [voucher, setVoucher] = useState<VoucherQuote | null>(null);

  const lines = useMemo(() => items.map((i) => ({ productId: Number(i.id), quantity: i.quantity })), [items]);
  // Identifies cart contents + voucher, so an unpaid order is only reused for the same checkout.
  const signature = useMemo(
    () => `${lines.map((l) => `${l.productId}x${l.quantity}`).sort().join(',')}|${voucher?.code ?? ''}`,
    [lines, voucher],
  );
  const listTotal = items.reduce((n, i) => n + (i.originalPrice ?? i.price) * i.quantity, 0);
  const saleSavings = Math.max(0, listTotal - total);
  const voucherDiscount = voucher?.discountAmount ?? 0;
  const payableTotal = voucher ? voucher.total : total;
  const orderable = lines.every((l) => Number.isInteger(l.productId) && l.productId > 0);

  const startCheckout = () => {
    if (!items.length) return;
    if (!orderable) {
      setError("Some items in your cart can't be ordered online. Remove them and add them again from the product page.");
      return;
    }
    setError(null);
    const pending = readJson<PendingOrder | null>(PENDING_ORDER_KEY, null);
    if (pending?.signature === signature && pending.order.status === 'PENDING_PAYMENT') {
      setOrder(pending.order);
      setPaymentOpen(true);
    } else {
      setAddressOpen(true);
    }
  };

  const onOrderCreated = (o: ShopOrder) => {
    writeJson(PENDING_ORDER_KEY, { signature, order: o } satisfies PendingOrder);
    setOrder(o);
    setAddressOpen(false);
    // Let the first sheet finish closing before presenting the next (iOS can't stack them).
    setTimeout(() => setPaymentOpen(true), 400);
  };

  const onSubmitted = (p: PaymentSubmission) => {
    storage.remove(PENDING_ORDER_KEY);
    setPaymentOpen(false);
    clear();
    setVoucher(null);
    setSubmitted(p);
    qc.invalidateQueries({ queryKey: ['myOrders'] });
    qc.invalidateQueries({ queryKey: ['myPayments'] });
  };

  if (submitted) {
    return (
      <View style={styles.page}>
        <Card style={{ margin: spacing.lg, alignItems: 'center', paddingVertical: 32 }}>
          <View style={styles.successIcon}>
            <Clock size={34} color="#FACC15" />
          </View>
          <AppText variant="title" style={{ textAlign: 'center' }}>Payment submitted</AppText>
          <AppText muted style={{ textAlign: 'center', marginTop: 10 }}>
            We've received your receipt for {formatInr(submitted.amount)} (ref. {submitted.transactionReference}).
          </AppText>
          <AppText muted style={{ textAlign: 'center', marginTop: 8 }}>
            Order {submitted.orderReference} will be confirmed and shipped once we verify the payment. You'll get a
            tracking number under My Orders.
          </AppText>
          <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 24 }}>
            <Button title="Track Payment Status" onPress={() => navigation.replace('Payments')} />
            <Button title="Continue Shopping" variant="ghost" onPress={() => navigation.popToTop()} />
          </View>
        </Card>
      </View>
    );
  }

  if (!items.length) {
    return (
      <View style={styles.page}>
        <EmptyState
          icon={ShoppingCart}
          title="Your cart is empty"
          message="Browse listings and add items to your cart."
          action={
            <View style={{ gap: 10, alignSelf: 'stretch' }}>
              <Button title="Browse Listings" onPress={() => navigation.popToTop()} />
              <Button title="View My Orders" icon={Package} variant="ghost" onPress={() => navigation.navigate('Orders')} />
            </View>
          }
        />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.md, gap: 10 }}
        ListHeaderComponent={
          <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
            <AppText variant="heading">
              My Cart <Text style={{ color: colors.gray400, fontWeight: '400' }}>({count} {count === 1 ? 'item' : 'items'})</Text>
            </AppText>
            <Pressable onPress={() => navigation.navigate('Orders')}>
              <Text style={{ color: colors.blue600, fontWeight: '600' }}>My Orders</Text>
            </Pressable>
          </Row>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => Number(item.id) > 0 && navigation.navigate('ProductDetails', { id: Number(item.id) })}
          >
            <ProductImage uri={item.image} style={styles.thumb} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
              <Row gap={4} style={{ marginTop: 4 }}>
                <MapPin size={12} color={colors.gray400} />
                <Text style={styles.meta} numberOfLines={1}>{item.location || 'India'}</Text>
              </Row>
              <Row gap={6}>
                <Text style={styles.price}>{formatInr(item.price * item.quantity)}</Text>
                {item.originalPrice && item.originalPrice > item.price ? (
                  <Text style={styles.was}>{formatInr(item.originalPrice * item.quantity)}</Text>
                ) : null}
              </Row>
              {item.quantity > 1 && (
                <Text style={styles.meta}>
                  {formatInr(item.price)} × {item.quantity}
                </Text>
              )}
            </View>
            <Pressable onPress={() => remove(item.id)} hitSlop={10} accessibilityLabel={`Remove ${item.title}`} style={{ padding: 6 }}>
              <Trash2 size={20} color={colors.red500} />
            </Pressable>
          </Pressable>
        )}
        ListFooterComponent={
          <Card style={{ marginTop: 6 }}>
            <AppText variant="heading" style={{ marginBottom: 10 }}>Order Summary</AppText>
            <Row style={styles.sumRow}>
              <AppText muted>Items ({count})</AppText>
              <AppText>{formatInr(listTotal)}</AppText>
            </Row>
            {saleSavings > 0 && (
              <Row style={styles.sumRow}>
                <AppText muted>Sale discount</AppText>
                <AppText style={styles.saving}>− {formatInr(saleSavings)}</AppText>
              </Row>
            )}
            {voucher && voucherDiscount > 0 && (
              <Row style={styles.sumRow}>
                <AppText muted>Voucher ({voucher.code})</AppText>
                <AppText style={styles.saving}>− {formatInr(voucherDiscount)}</AppText>
              </Row>
            )}
            <Row style={styles.sumRow}>
              <AppText muted>Delivery</AppText>
              <AppText style={{ color: colors.green600, fontWeight: '600' }}>Free</AppText>
            </Row>
            <VoucherBox
              items={lines}
              applied={voucher}
              onChange={setVoucher}
              disabled={!orderable || addressOpen || paymentOpen}
            />
            <View style={styles.divider} />
            <Row style={styles.sumRow}>
              <AppText variant="subheading">Total</AppText>
              <AppText variant="heading">{formatInr(payableTotal)}</AppText>
            </Row>
            {saleSavings + voucherDiscount > 0 && (
              <AppText style={[styles.saving, { textAlign: 'right', fontSize: font.xs }]}>
                You save {formatInr(saleSavings + voucherDiscount)}
              </AppText>
            )}
            <Button title="Pay via Bank Transfer / UPI" icon={Landmark} onPress={startCheckout} style={{ marginTop: 14 }} />
            <AppText variant="caption" style={{ textAlign: 'center', marginTop: 8 }}>
              Pay directly and upload your receipt — we'll verify it and ship your order.
            </AppText>
            {error ? <ErrorBox message={error} /> : null}
            <Button title="Clear Cart" variant="dangerOutline" size="sm" onPress={() => setConfirmClear(true)} style={{ marginTop: 12 }} />
          </Card>
        }
      />

      <AddressSheet
        visible={addressOpen}
        onClose={() => setAddressOpen(false)}
        items={lines}
        cartTotal={payableTotal}
        voucherCode={voucher?.code ?? null}
        onCreated={onOrderCreated}
      />
      <ManualPaymentSheet
        visible={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        amount={order ? orderPayable(order) : undefined}
        orderReference={order?.orderReference}
        productIds={order ? [...new Set(order.items.map((i) => i.productId))] : undefined}
        onSubmitted={onSubmitted}
      />
      <ConfirmDialog
        visible={confirmClear}
        title="Clear cart?"
        message="All items will be removed from your cart."
        confirmLabel="Clear"
        destructive
        onConfirm={() => {
          clear();
          setVoucher(null);
          storage.remove(PENDING_ORDER_KEY);
          setConfirmClear(false);
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.gray100 },
  row: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: 'center',
  },
  thumb: { width: 76, height: 76, borderRadius: radius.md },
  title: { fontSize: font.md, fontWeight: '600', color: colors.gray900 },
  meta: { fontSize: font.xs, color: colors.gray500 },
  price: { fontSize: font.md, fontWeight: '800', color: colors.gold600, marginTop: 4 },
  sumRow: { justifyContent: 'space-between', paddingVertical: 4 },
  divider: { height: 1, backgroundColor: colors.gray200, marginVertical: 8 },
  saving: { color: colors.green600, fontWeight: '600' },
  was: { color: colors.gray400, fontSize: font.xs, textDecorationLine: 'line-through', marginTop: 4 },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(234,179,8,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
});
