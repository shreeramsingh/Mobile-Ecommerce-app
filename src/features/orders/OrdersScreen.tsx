import React, { useState } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, CreditCard, MapPin, Package, Truck } from 'lucide-react-native';
import type { RootScreenProps } from '../../navigation/types';
import type { ShopOrder } from '../../api/types';
import { orderPayable, shopOrderApi } from '../../api/payments';
import { errorMessage } from '../../api/client';
import { AppText, Badge, Button, Card, EmptyState, ErrorBox, Loader, Row } from '../../components/ui';
import { ShippingStatusBadge } from '../payments/components';
import { ManualPaymentSheet } from '../checkout/ManualPaymentSheet';
import { toast } from '../../components/ui/Toast';
import { formatDateTime, formatInr } from '../../lib/format';
import { colors, font, radius, spacing } from '../../theme';

export function OrdersScreen({ navigation }: RootScreenProps<'Orders'>) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['myOrders'], queryFn: shopOrderApi.myOrders, staleTime: 15_000 });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [payFor, setPayFor] = useState<ShopOrder | null>(null);

  const orders = [...(q.data ?? [])].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  if (q.isLoading) return <Loader style={{ flex: 1 }} label="Loading orders..." />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.gray100 }}>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.orderReference}
        contentContainerStyle={{ padding: spacing.md, gap: 10, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.gold500} />}
        ListHeaderComponent={q.error ? <ErrorBox message={errorMessage(q.error)} onRetry={q.refetch} /> : undefined}
        ListEmptyComponent={
          <EmptyState
            icon={Package}
            title="No orders yet"
            message="Items you purchase will appear here."
            action={<Button title="Start Shopping" onPress={() => navigation.popToTop()} />}
          />
        }
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            expanded={expanded === item.orderReference}
            onToggle={() => setExpanded((e) => (e === item.orderReference ? null : item.orderReference))}
            onPay={() => setPayFor(item)}
          />
        )}
      />
      <ManualPaymentSheet
        visible={!!payFor}
        onClose={() => setPayFor(null)}
        amount={payFor ? orderPayable(payFor) : undefined}
        orderReference={payFor?.orderReference}
        productIds={payFor ? [...new Set(payFor.items.map((i) => i.productId))] : undefined}
        onSubmitted={() => {
          setPayFor(null);
          toast.show('Payment submitted for verification');
          qc.invalidateQueries({ queryKey: ['myPayments'] });
          q.refetch();
        }}
      />
    </View>
  );
}

function OrderCard({
  order,
  expanded,
  onToggle,
  onPay,
}: {
  order: ShopOrder;
  expanded: boolean;
  onToggle: () => void;
  onPay: () => void;
}) {
  const s = order.shipping;
  const a = order.shippingAddress;
  const summary = order.items.map((i) => (i.units > 1 ? `${i.productName} × ${i.units}` : i.productName)).join(', ');

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <Pressable onPress={onToggle} style={{ padding: spacing.lg }} accessibilityRole="button" accessibilityState={{ expanded }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.ref}>{order.orderReference}</Text>
            <AppText variant="caption">{formatDateTime(order.createdAt)}</AppText>
          </View>
          {order.status === 'PENDING_PAYMENT' ? (
            <Badge label="⏳ Verifying payment" bg="rgba(234,179,8,0.16)" fg="#FACC15" />
          ) : order.status === 'CANCELLED' ? (
            <Badge label="🚫 Cancelled" bg={colors.gray100} fg={colors.gray600} />
          ) : s.status === 'NOT_STARTED' ? (
            <Badge label="✅ Paid" bg="rgba(34,197,94,0.16)" fg={colors.green700} />
          ) : (
            <ShippingStatusBadge status={s.status} audience="buyer" />
          )}
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: 10 }}>
          <AppText style={{ flex: 1, color: colors.gray700 }} numberOfLines={expanded ? undefined : 1}>{summary}</AppText>
          <AppText style={{ fontWeight: '800' }}>{formatInr(orderPayable(order))}</AppText>
        </Row>
        <Row gap={4} style={{ marginTop: 6 }}>
          <MapPin size={12} color={colors.gray400} />
          <AppText variant="caption" numberOfLines={1} style={{ flex: 1 }}>
            {a.addressLine1}, {a.city} {a.pincode}
          </AppText>
          {expanded ? <ChevronUp size={18} color={colors.gray400} /> : <ChevronDown size={18} color={colors.gray400} />}
        </Row>
        {s.awbCode ? (
          <Row gap={6} style={{ marginTop: 8 }}>
            <Truck size={14} color={colors.blue600} />
            <AppText style={{ fontSize: font.sm, flex: 1 }}>
              {s.courierName ?? 'Courier'} · AWB {s.awbCode}
            </AppText>
            {s.trackingUrl ? (
              <Pressable onPress={() => Linking.openURL(s.trackingUrl!)}>
                <Text style={{ color: colors.blue600, fontWeight: '700' }}>Track shipment</Text>
              </Pressable>
            ) : null}
          </Row>
        ) : null}
      </Pressable>

      {expanded && (
        <View style={styles.expanded}>
          <AppText variant="subheading" style={{ marginBottom: 6 }}>Items ({order.items.length})</AppText>
          {order.items.map((i) => (
            <Row key={`${i.productId}`} style={styles.itemRow}>
              <AppText style={{ flex: 1 }} numberOfLines={2}>
                {i.productName}
                {i.units > 1 ? <Text style={{ color: colors.gray500 }}>  × {i.units}</Text> : null}
              </AppText>
              <View style={{ alignItems: 'flex-end' }}>
                <AppText style={{ fontWeight: '600' }}>{formatInr(i.unitPrice * i.units)}</AppText>
                {i.originalUnitPrice && i.originalUnitPrice > i.unitPrice ? (
                  <Text style={{ color: colors.gray400, fontSize: font.xs, textDecorationLine: 'line-through' }}>
                    {formatInr(i.originalUnitPrice * i.units)}
                  </Text>
                ) : null}
              </View>
            </Row>
          ))}
          {(order.voucherDiscount ?? 0) > 0 && (
            <Row style={styles.itemRow}>
              <AppText style={{ color: colors.green600 }}>Voucher {order.voucherCode}</AppText>
              <AppText style={{ color: colors.green600, fontWeight: '600' }}>− {formatInr(order.voucherDiscount ?? 0)}</AppText>
            </Row>
          )}
          <Row style={styles.itemRow}>
            <AppText muted>Delivery</AppText>
            <AppText style={{ color: colors.green600, fontWeight: '600' }}>Free</AppText>
          </Row>
          <Row style={[styles.itemRow, { borderBottomWidth: 0 }]}>
            <AppText variant="subheading">{order.status === 'PAID' ? 'Total paid' : 'Total'}</AppText>
            <AppText variant="subheading">{formatInr(orderPayable(order))}</AppText>
          </Row>
          <AppText variant="subheading" style={{ marginTop: 10 }}>Delivery address</AppText>
          <AppText style={{ marginTop: 4, color: colors.gray700 }}>
            {a.fullName} · {a.phone}
            {'\n'}
            {a.addressLine1}
            {a.addressLine2 ? `, ${a.addressLine2}` : ''}, {a.city}, {a.state} {a.pincode}
          </AppText>
          {order.status === 'PENDING_PAYMENT' && (
            <View style={{ marginTop: 14, gap: 6 }}>
              <AppText variant="caption">
                Already paid? We're verifying it — see My Payments. Haven't paid yet? Pay now and upload your receipt.
              </AppText>
              <Button title="Pay now" icon={CreditCard} size="sm" onPress={onPay} />
            </View>
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  ref: { fontFamily: 'Menlo', fontWeight: '700', color: colors.gray900, fontSize: font.sm },
  expanded: {
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    padding: spacing.lg,
    backgroundColor: colors.gray50,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  itemRow: {
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
});
