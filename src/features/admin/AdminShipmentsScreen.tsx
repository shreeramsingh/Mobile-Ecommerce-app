import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { adminShopOrderApi, orderPayable } from '../../api/payments';
import type { ShippingStatus, ShopOrder } from '../../api/types';
import { errorMessage } from '../../api/client';
import { AppText, Card, EmptyState, ErrorBox, Loader, Row } from '../../components/ui';
import { Sheet } from '../../components/ui/Sheet';
import { ShippingStatusBadge } from '../payments/components';
import { OrderShippingPanel } from './OrderShippingPanel';
import { adminStyles } from './AdminListingsScreen';
import { formatDateTime, formatInr } from '../../lib/format';
import { colors, font, radius, spacing } from '../../theme';

type Tab = ShippingStatus | 'ALL';
const TABS: { key: Tab; label: string }[] = [
  { key: 'FAILED', label: 'Failed' },
  { key: 'MANUAL_REVIEW', label: 'Manual handling' },
  { key: 'PICKUP_SCHEDULED', label: 'Pickup scheduled' },
  { key: 'ALL', label: 'All paid orders' },
];

export function AdminShipmentsScreen() {
  const [tab, setTab] = useState<Tab>('FAILED');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<ShopOrder | null>(null);

  const q = useQuery({
    queryKey: ['adminShipments', tab, page],
    queryFn: () => adminShopOrderApi.list({ status: 'PAID', shippingStatus: tab === 'ALL' ? undefined : tab, page, size: 20 }),
    placeholderData: keepPreviousData,
  });
  const data = q.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.gray100 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6, padding: spacing.md, paddingBottom: 0 }}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => {
              setTab(t.key);
              setPage(0);
            }}
            style={[styles.tab, tab === t.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t.key && { color: colors.white }]}>
              {t.label}
              {tab === t.key && data ? ` (${data.totalElements})` : ''}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {q.isLoading ? (
        <Loader style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={data?.content ?? []}
          keyExtractor={(o) => o.orderReference}
          contentContainerStyle={{ padding: spacing.md, gap: 8 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.gold500} />}
          ListHeaderComponent={
            <View>
              <AppText muted style={{ marginBottom: 8 }}>
                Paid bank / UPI orders are sent to Shiprocket automatically. Fix and retry the ones that failed here.
              </AppText>
              {q.error ? <ErrorBox message={errorMessage(q.error)} onRetry={q.refetch} /> : null}
            </View>
          }
          ListEmptyComponent={<EmptyState emoji={tab === 'FAILED' ? '🎉' : '📦'} title={tab === 'FAILED' ? 'No failed shipments. 🎉' : 'No orders here.'} />}
          renderItem={({ item: o }) => (
            <Pressable onPress={() => setSelected(o)}>
              <Card style={{ padding: 14 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: 'Menlo', fontWeight: '700', color: colors.gray900, fontSize: font.sm }}>{o.orderReference}</Text>
                  <ShippingStatusBadge status={o.shipping.status} />
                </Row>
                <AppText style={{ marginTop: 6 }}>
                  {o.shippingAddress.fullName} · {o.shippingAddress.city} {o.shippingAddress.pincode}
                </AppText>
                <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
                  <AppText variant="caption">Paid {formatDateTime(o.paidAt)} · AWB {o.shipping.awbCode ?? '—'}</AppText>
                  <AppText style={{ fontWeight: '800' }}>{formatInr(orderPayable(o))}</AppText>
                </Row>
                <Text style={{ color: colors.gold600, fontWeight: '700', marginTop: 8 }}>
                  {o.shipping.status === 'FAILED' ? 'Fix / retry →' : 'View →'}
                </Text>
              </Card>
            </Pressable>
          )}
          ListFooterComponent={
            data && data.totalPages > 1 ? (
              <Row style={{ justifyContent: 'center', marginTop: 8 }} gap={16}>
                <Pressable disabled={page === 0} onPress={() => setPage((x) => x - 1)} style={[adminStyles.pageBtn, page === 0 && { opacity: 0.4 }]}>
                  <ChevronLeft size={18} color={colors.gray700} />
                </Pressable>
                <AppText>
                  Page {data.page + 1} of {data.totalPages}
                </AppText>
                <Pressable
                  disabled={page + 1 >= data.totalPages}
                  onPress={() => setPage((x) => x + 1)}
                  style={[adminStyles.pageBtn, page + 1 >= data.totalPages && { opacity: 0.4 }]}
                >
                  <ChevronRight size={18} color={colors.gray700} />
                </Pressable>
              </Row>
            ) : undefined
          }
        />
      )}
      {selected && (
        <Sheet
          visible
          title="Shipment"
          onClose={() => {
            setSelected(null);
            q.refetch();
          }}
        >
          <OrderShippingPanel orderReference={selected.orderReference} initial={selected} />
        </Sheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  tabActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  tabText: { fontSize: font.xs, fontWeight: '700', color: colors.gray600 },
});
