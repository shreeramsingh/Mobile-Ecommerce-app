import React, { useEffect, useRef, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminShopOrderApi, orderPayable } from '../../api/payments';
import type { ShopOrder } from '../../api/types';
import { ApiError, errorMessage } from '../../api/client';
import { AppText, Badge, Button, ErrorBox, KeyValue, Loader, Row } from '../../components/ui';
import { ShippingStatusBadge } from '../payments/components';
import { formatDateTime, formatInr } from '../../lib/format';
import { colors, font, radius } from '../../theme';

const POLL_MS = 3000;
const POLL_MAX_MS = 60_000;

/** Admin view of a shop order: items, address, Shiprocket state, retry. */
export function OrderShippingPanel({ orderReference, initial }: { orderReference: string; initial?: ShopOrder }) {
  const qc = useQueryClient();
  const key = ['adminShopOrder', orderReference];
  const started = useRef(Date.now());
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: key,
    queryFn: () => adminShopOrderApi.get(orderReference),
    initialData: initial,
    initialDataUpdatedAt: initial ? Date.now() : undefined,
    refetchInterval: (query) => {
      const o = query.state.data as ShopOrder | undefined;
      const inFlight = o?.status === 'PAID' && (o.shipping.status === 'NOT_STARTED' || o.shipping.status === 'PROCESSING');
      return inFlight && Date.now() - started.current < POLL_MAX_MS ? POLL_MS : false;
    },
  });

  useEffect(() => {
    started.current = Date.now();
  }, [orderReference]);

  if (q.isLoading) return <Loader />;
  if (q.error || !q.data) return <ErrorBox message={`Order ${orderReference}: ${errorMessage(q.error)}`} />;

  const o = q.data;
  const s = o.shipping;
  const a = o.shippingAddress;
  const polling = o.status === 'PAID' && (s.status === 'NOT_STARTED' || s.status === 'PROCESSING');
  const canRetry = o.status === 'PAID' && ['FAILED', 'NOT_STARTED', 'ORDER_CREATED', 'AWB_ASSIGNED'].includes(s.status);
  const retryLabel = s.status === 'NOT_STARTED' ? 'Create Shiprocket order now' : s.status === 'FAILED' ? 'Retry Shiprocket' : 'Continue Shiprocket steps';

  const retry = async () => {
    setRetrying(true);
    setRetryError(null);
    try {
      const next = await adminShopOrderApi.ship(orderReference);
      qc.setQueryData(key, next);
      if (next.shipping.status === 'FAILED') setRetryError(next.shipping.error ?? 'Shiprocket failed again.');
      qc.invalidateQueries({ queryKey: ['adminShipments'] });
    } catch (e) {
      setRetryError(errorMessage(e));
      if (e instanceof ApiError && e.status === 409) q.refetch();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <AppText variant="subheading">Order {o.orderReference}</AppText>
        <ShippingStatusBadge status={s.status} />
      </Row>
      {o.items.map((i) => (
        <Row key={i.productId} style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <AppText style={{ fontSize: font.sm }}>
              {i.productName} × {i.units}
            </AppText>
            <Row gap={4} style={{ marginTop: 2 }}>
              {i.licenceRequired && <Badge label="Licence" bg="rgba(249,115,22,0.16)" fg="#FB923C" />}
              {!i.storeProduct && <Badge label="Other seller" bg={colors.gray100} fg={colors.gray600} />}
            </Row>
          </View>
          <AppText style={{ fontWeight: '600', fontSize: font.sm }}>{formatInr(i.unitPrice * i.units)}</AppText>
        </Row>
      ))}
      {(o.voucherDiscount ?? 0) > 0 && (
        <>
          <Row style={{ justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.gray200, paddingTop: 6 }}>
            <AppText muted>Subtotal</AppText>
            <AppText muted>{formatInr(o.subtotal)}</AppText>
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <AppText style={{ color: colors.green600 }}>Voucher {o.voucherCode}</AppText>
            <AppText style={{ color: colors.green600 }}>− {formatInr(o.voucherDiscount ?? 0)}</AppText>
          </Row>
        </>
      )}
      <Row style={{ justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.gray200, paddingTop: 6 }}>
        <AppText style={{ fontWeight: '700' }}>Total</AppText>
        <AppText style={{ fontWeight: '800' }}>{formatInr(orderPayable(o))}</AppText>
      </Row>
      <AppText style={{ fontSize: font.sm, color: colors.gray700 }}>
        {a.fullName} · {a.phone}
        {'\n'}
        {a.addressLine1}
        {a.addressLine2 ? `, ${a.addressLine2}` : ''}, {a.city}, {a.state} {a.pincode}
      </AppText>
      <View>
        <KeyValue label="Shiprocket order" value={s.shiprocketOrderId != null ? String(s.shiprocketOrderId) : '—'} />
        <KeyValue label="Shipment" value={s.shiprocketShipmentId != null ? String(s.shiprocketShipmentId) : '—'} />
        <KeyValue label="Courier" value={s.courierName ?? '—'} />
        <KeyValue
          label="AWB"
          value={
            s.awbCode && s.trackingUrl ? (
              <Text style={{ color: colors.blue600, fontWeight: '700' }} onPress={() => Linking.openURL(s.trackingUrl!)}>
                {s.awbCode}
              </Text>
            ) : (
              s.awbCode ?? '—'
            )
          }
        />
        <KeyValue label="Pickup" value={s.pickupScheduledDate ?? undefined} />
        <KeyValue label="Last attempt" value={s.lastAttemptAt ? `${formatDateTime(s.lastAttemptAt)} (${s.attempts ?? 0})` : undefined} />
      </View>
      {s.error && s.error !== retryError ? (
        <View style={{ padding: 10, borderRadius: radius.md, backgroundColor: s.status === 'MANUAL_REVIEW' ? 'rgba(249,115,22,0.16)' : colors.red50 }}>
          <Text style={{ color: s.status === 'MANUAL_REVIEW' ? '#FB923C' : colors.red700, fontSize: font.sm }}>{s.error}</Text>
        </View>
      ) : null}
      {polling && <AppText variant="caption">Creating the Shiprocket shipment in the background…</AppText>}
      {retryError ? <ErrorBox message={retryError} /> : null}
      {canRetry && <Button title={retryLabel} size="sm" loading={retrying} onPress={retry} />}
    </View>
  );
}
