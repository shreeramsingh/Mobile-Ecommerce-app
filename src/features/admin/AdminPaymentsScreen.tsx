import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { adminShopOrderApi, paymentAdminApi } from '../../api/payments';
import type { PaymentStatus, PaymentSubmission } from '../../api/types';
import { ApiError, errorMessage } from '../../api/client';
import { AppText, Button, Card, EmptyState, ErrorBox, KeyValue, Loader, Row } from '../../components/ui';
import { Sheet } from '../../components/ui/Sheet';
import { toast } from '../../components/ui/Toast';
import { AuthImage, PaymentStatusBadge } from '../payments/components';
import { OrderShippingPanel } from './OrderShippingPanel';
import { adminStyles } from './AdminListingsScreen';
import { formatDateTime, formatInr } from '../../lib/format';
import { colors, font, radius, spacing } from '../../theme';

type Tab = PaymentStatus | 'ALL';
const TABS: { key: Tab; label: string }[] = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'ALL', label: 'All' },
];
const QUICK_REASONS = [
  'Amount in the receipt does not match the amount entered.',
  'Payment not received in our account for this reference number.',
  'Receipt is unclear or unreadable. Please upload a clearer screenshot.',
];

export function AdminPaymentsScreen() {
  const [tab, setTab] = useState<Tab>('PENDING');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<PaymentSubmission | null>(null);

  const q = useQuery({
    queryKey: ['adminPayments', tab, page],
    queryFn: () =>
      paymentAdminApi.listPayments({
        status: tab === 'ALL' ? undefined : tab,
        page,
        size: 20,
        sort: tab === 'PENDING' ? 'createdAt,asc' : 'createdAt,desc',
      }),
    placeholderData: keepPreviousData,
  });
  const data = q.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.gray100 }}>
      <View style={styles.tabs}>
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
      </View>
      {q.isLoading ? (
        <Loader style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={data?.content ?? []}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={{ padding: spacing.md, gap: 8 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.gold500} />}
          ListHeaderComponent={
            <View>
              <AppText muted style={{ marginBottom: 8 }}>Check each receipt against your bank statement, then approve or reject.</AppText>
              {q.error ? <ErrorBox message={errorMessage(q.error)} onRetry={q.refetch} /> : null}
            </View>
          }
          ListEmptyComponent={<EmptyState emoji="✅" title={tab === 'PENDING' ? 'No payments waiting for review.' : 'No payments here.'} />}
          renderItem={({ item: p }) => (
            <Pressable onPress={() => setSelected(p)}>
              <Card style={{ padding: 14 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <AppText variant="heading">{formatInr(p.amount)}</AppText>
                  <PaymentStatusBadge status={p.status} />
                </Row>
                <AppText variant="caption" style={{ marginTop: 4 }}>
                  {formatDateTime(p.submittedAt)} · {p.paymentMethodName}
                </AppText>
                <AppText style={{ fontSize: font.sm, marginTop: 4 }}>
                  Ref <Text style={{ fontFamily: 'Menlo' }}>{p.transactionReference}</Text> · Order {p.orderReference ?? '—'}
                </AppText>
                <AppText variant="caption">Customer {p.userId}</AppText>
                <Text style={{ color: colors.gold600, fontWeight: '700', marginTop: 8 }}>{p.status === 'PENDING' ? 'Review →' : 'View →'}</Text>
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
      {selected && <ReviewSheet payment={selected} onClose={() => setSelected(null)} onChanged={setSelected} />}
    </View>
  );
}

function ReviewSheet({
  payment,
  onClose,
  onChanged,
}: {
  payment: PaymentSubmission;
  onClose: () => void;
  onChanged: (p: PaymentSubmission) => void;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'view' | 'reject'>('view');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPdf = /\.pdf$/i.test(payment.receiptFileName ?? '');

  const orderQ = useQuery({
    queryKey: ['adminShopOrder', payment.orderReference],
    queryFn: () => adminShopOrderApi.get(payment.orderReference!),
    enabled: !!payment.orderReference,
  });
  const productIds = orderQ.data ? [...new Set(orderQ.data.items.map((i) => i.productId))] : [];
  const idsReady = !payment.orderReference || !orderQ.isLoading;

  useEffect(() => {
    setMode('view');
    setReason('');
    setError(null);
  }, [payment.id]);

  const refreshLists = () => {
    qc.invalidateQueries({ queryKey: ['adminPayments'] });
    qc.invalidateQueries({ queryKey: ['adminShipments'] });
  };

  const handleError = (e: unknown) => {
    if (e instanceof ApiError && e.status === 409) {
      toast.show('This payment was already reviewed — list refreshed', 'info');
      refreshLists();
      onClose();
      return;
    }
    setError((e instanceof ApiError && e.fieldErrors.reason) || errorMessage(e));
  };

  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await paymentAdminApi.approve(payment.id, productIds);
      refreshLists();
      if (updated.orderReference) {
        onChanged(updated);
        qc.invalidateQueries({ queryKey: ['adminShopOrder', updated.orderReference] });
        toast.show('Payment approved — placing the Shiprocket order');
      } else {
        toast.show('Payment approved');
        onClose();
      }
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    setBusy(true);
    setError(null);
    try {
      await paymentAdminApi.reject(payment.id, reason, productIds);
      refreshLists();
      toast.show('Payment rejected', 'info');
      onClose();
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  };

  const pending = payment.status === 'PENDING';
  const len = reason.trim().length;

  return (
    <Sheet
      visible
      onClose={onClose}
      title={`Payment #${payment.id}`}
      dismissable={!busy}
      footer={
        pending ? (
          mode === 'view' ? (
            <>
              <Button title="Reject" variant="dangerOutline" onPress={() => setMode('reject')} disabled={busy || !idsReady} style={{ flex: 1 }} />
              <Button title="Approve" variant="success" onPress={approve} loading={busy} disabled={!idsReady} style={{ flex: 1 }} />
            </>
          ) : (
            <>
              <Button title="Back" variant="ghost" onPress={() => setMode('view')} disabled={busy} style={{ flex: 1 }} />
              <Button title="Confirm rejection" variant="danger" onPress={reject} loading={busy} disabled={len < 10} style={{ flex: 1.4 }} />
            </>
          )
        ) : (
          <Button title="Close" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
        )
      }
    >
      <PaymentStatusBadge status={payment.status} />
      {error ? <ErrorBox message={error} /> : null}
      {mode === 'reject' ? (
        <View style={{ marginTop: 12 }}>
          <AppText variant="label">Reason for rejection (the customer will see this)</AppText>
          <View style={{ gap: 6, marginTop: 8 }}>
            {QUICK_REASONS.map((r) => (
              <Pressable key={r} onPress={() => setReason(r)} style={styles.reasonChip}>
                <Text style={{ fontSize: font.xs, color: colors.gray700 }}>{r}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={500}
            autoFocus
            style={styles.reasonInput}
            placeholderTextColor={colors.gray400}
            placeholder="Explain what's wrong…"
          />
          <Text style={{ fontSize: font.xs, color: len > 0 && len < 10 ? colors.red600 : colors.gray500, marginTop: 4 }}>
            {len < 10 ? 'At least 10 characters' : `${reason.length}/500`}
          </Text>
        </View>
      ) : (
        <View style={{ marginTop: 10 }}>
          <AppText style={{ fontSize: font.xxl, fontWeight: '800' }}>{formatInr(payment.amount)}</AppText>
          <KeyValue label="Customer" value={payment.userId} />
          <KeyValue label="Method" value={payment.paymentMethodName} />
          <KeyValue label="UTR / reference" value={payment.transactionReference} />
          <KeyValue label="Paid on" value={payment.paymentDate} />
          <KeyValue label="Order" value={payment.orderReference ?? '—'} />
          <KeyValue label="Submitted" value={formatDateTime(payment.submittedAt)} />
          <KeyValue label="Customer note" value={payment.remarks ?? undefined} />
          <KeyValue label="Reviewed" value={payment.reviewedBy ? `${payment.reviewedBy} · ${formatDateTime(payment.reviewedAt)}` : undefined} />
          <KeyValue label="Rejection reason" value={payment.rejectionReason ?? undefined} valueStyle={{ color: colors.red600 }} />

          <AppText variant="subheading" style={{ marginTop: 16, marginBottom: 8 }}>Receipt</AppText>
          <View style={{ alignItems: 'center' }}>
            {isPdf ? (
              <AppText muted>PDF receipt "{payment.receiptFileName}" — open the admin website to view PDFs.</AppText>
            ) : (
              <ScrollView maximumZoomScale={3} minimumZoomScale={1} style={{ maxHeight: 360 }} centerContent>
                <AuthImage
                  path={productIds.length ? `${payment.receiptUrl}?productIds=${productIds.join(',')}` : payment.receiptUrl}
                  size={300}
                  label="Payment receipt"
                />
              </ScrollView>
            )}
          </View>

          {payment.orderReference && (
            <View style={{ marginTop: 16 }}>
              <AppText variant="subheading" style={{ marginBottom: 8 }}>
                Order & shipping{pending ? ' — approving places this order with Shiprocket automatically' : ''}
              </AppText>
              <OrderShippingPanel key={`${payment.orderReference}-${payment.status}`} orderReference={payment.orderReference} />
            </View>
          )}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: 6,
    padding: spacing.md,
    paddingBottom: 0,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  tabActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  tabText: { fontSize: font.xs, fontWeight: '700', color: colors.gray600 },
  reasonChip: { padding: 10, borderRadius: radius.md, backgroundColor: colors.gray100 },
  reasonInput: {
    marginTop: 10,
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: radius.md,
    padding: 12,
    textAlignVertical: 'top',
    color: colors.gray900,
  },
});
