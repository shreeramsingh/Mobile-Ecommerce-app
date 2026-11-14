import React, { useState } from 'react';
import { FlatList, RefreshControl, Share, StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, FileText, QrCode, ReceiptText } from 'lucide-react-native';
import type { RootScreenProps } from '../../navigation/types';
import type { PaymentSubmission } from '../../api/types';
import { paymentUserApi, shopOrderApi } from '../../api/payments';
import { errorMessage } from '../../api/client';
import { AppText, Button, Card, EmptyState, ErrorBox, KeyValue, Loader, Row } from '../../components/ui';
import { Sheet } from '../../components/ui/Sheet';
import { AuthImage, PaymentStatusBadge } from './components';
import { ManualPaymentSheet } from '../checkout/ManualPaymentSheet';
import { toast } from '../../components/ui/Toast';
import { formatDateTime, formatInr } from '../../lib/format';
import { colors, font, radius, spacing } from '../../theme';

export function PaymentsScreen(_: RootScreenProps<'Payments'>) {
  const qc = useQueryClient();
  // refetchOnWindowFocus maps to "app came back to the foreground" (see queryClient).
  const q = useQuery({ queryKey: ['myPayments'], queryFn: paymentUserApi.myPayments, staleTime: 0, refetchOnWindowFocus: true });
  const [receiptFor, setReceiptFor] = useState<number | null>(null);
  const [invoiceFor, setInvoiceFor] = useState<PaymentSubmission | null>(null);
  const [retryFor, setRetryFor] = useState<PaymentSubmission | null>(null);

  const payments = [...(q.data ?? [])].sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
  if (q.isLoading) return <Loader style={{ flex: 1 }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.gray100 }}>
      <FlatList
        data={payments}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={{ padding: spacing.md, gap: 10, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.gold500} />}
        ListHeaderComponent={q.error ? <ErrorBox message={errorMessage(q.error)} onRetry={q.refetch} /> : undefined}
        ListEmptyComponent={
          <EmptyState icon={ReceiptText} title="No payments yet" message="Payments you make by bank transfer or UPI will appear here." />
        }
        renderItem={({ item: p }) => {
          const Icon = p.paymentMethodType === 'QR_CODE' ? QrCode : Building2;
          const isPdf = /\.pdf$/i.test(p.receiptFileName ?? '');
          return (
            <Card>
              <Row style={{ alignItems: 'flex-start' }} gap={12}>
                <View style={styles.icon}>
                  <Icon size={20} color={colors.gold600} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.amount}>{formatInr(p.amount)}</Text>
                  <AppText variant="caption">
                    via {p.paymentMethodName} · submitted {formatDateTime(p.submittedAt)}
                  </AppText>
                  <View style={{ marginTop: 8 }}>
                    <PaymentStatusBadge status={p.status} />
                  </View>
                </View>
              </Row>
              <View style={{ marginTop: 10 }}>
                <KeyValue label="Reference no." value={p.transactionReference} />
                <KeyValue label="Paid on" value={p.paymentDate} />
                <KeyValue label="Order" value={p.orderReference ?? undefined} />
              </View>
              {p.status === 'REJECTED' && p.rejectionReason ? (
                <View style={styles.reject}>
                  <Text style={{ color: colors.red700, fontWeight: '700', fontSize: font.sm }}>Reason for rejection</Text>
                  <Text style={{ color: colors.red700, marginTop: 4 }}>{p.rejectionReason}</Text>
                </View>
              ) : null}
              {p.status === 'PENDING' && (
                <AppText variant="caption" style={{ marginTop: 10 }}>
                  We're verifying this payment. This usually takes a few hours.
                </AppText>
              )}
              <Row style={{ marginTop: 12, flexWrap: 'wrap' }}>
                <Button
                  title={receiptFor === p.id ? 'Hide receipt' : 'View receipt'}
                  size="sm"
                  variant="ghost"
                  onPress={() => setReceiptFor((r) => (r === p.id ? null : p.id))}
                />
                {p.status === 'APPROVED' && (
                  <Button title="View invoice" size="sm" variant="outline" icon={FileText} onPress={() => setInvoiceFor(p)} />
                )}
                {p.status === 'REJECTED' && <Button title="Submit again" size="sm" onPress={() => setRetryFor(p)} />}
              </Row>
              {receiptFor === p.id && (
                <View style={{ marginTop: 12, alignItems: 'center' }}>
                  {isPdf ? (
                    <AppText muted>PDF receipt "{p.receiptFileName}" — we have it on file.</AppText>
                  ) : (
                    <AuthImage path={p.receiptUrl} size={280} label="Payment receipt" />
                  )}
                </View>
              )}
            </Card>
          );
        }}
      />

      <InvoiceSheet payment={invoiceFor} onClose={() => setInvoiceFor(null)} />
      <ManualPaymentSheet
        visible={!!retryFor}
        onClose={() => setRetryFor(null)}
        amount={retryFor?.amount}
        orderReference={retryFor?.orderReference ?? undefined}
        onSubmitted={() => {
          setRetryFor(null);
          toast.show('Payment submitted for verification');
          qc.invalidateQueries({ queryKey: ['myOrders'] });
          q.refetch();
        }}
      />
    </View>
  );
}

// ─── Invoice (approved payments) ──────────────────────────────────────────────
function InvoiceSheet({ payment, onClose }: { payment: PaymentSubmission | null; onClose: () => void }) {
  const orderQ = useQuery({
    queryKey: ['shopOrder', payment?.orderReference],
    queryFn: () => shopOrderApi.get(payment!.orderReference!),
    enabled: !!payment?.orderReference,
  });
  if (!payment) return null;
  const order = orderQ.data;
  const invoiceNo = `INV-${String(payment.id).padStart(6, '0')}`;
  const issued = payment.reviewedAt || payment.submittedAt;
  const lines = order?.items?.length
    ? order.items.map((i) => ({ name: i.productName, units: i.units, unitPrice: i.unitPrice }))
    : [{ name: payment.orderReference ? `Order ${payment.orderReference}` : 'Payment', units: 1, unitPrice: payment.amount }];
  const a = order?.shippingAddress;

  const shareInvoice = () => {
    const text = [
      `Bandookwale — Invoice ${invoiceNo}`,
      `Date: ${formatDateTime(issued)}`,
      payment.orderReference ? `Order: ${payment.orderReference}` : '',
      `Payment: ${payment.paymentMethodName} · ref ${payment.transactionReference}`,
      '',
      ...lines.map((l) => `${l.name} × ${l.units} — ${formatInr(l.unitPrice * l.units)}`),
      '',
      `Total paid: ${formatInr(payment.amount)}`,
    ]
      .filter((x) => x !== null)
      .join('\n');
    Share.share({ title: invoiceNo, message: text }).catch(() => {});
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={`Invoice ${invoiceNo}`}
      footer={
        <>
          <Button title="Close" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
          <Button title="Share" onPress={shareInvoice} style={{ flex: 1 }} disabled={orderQ.isLoading} />
        </>
      }
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <AppText variant="title">INVOICE</AppText>
        <View style={styles.paidPill}>
          <Text style={{ color: colors.white, fontWeight: '800', fontSize: 11 }}>PAYMENT SUCCESSFUL</Text>
        </View>
      </Row>
      <View style={{ marginTop: 12 }}>
        <KeyValue label="Invoice no." value={invoiceNo} />
        <KeyValue label="Date & time" value={formatDateTime(issued)} />
        <KeyValue label="Order" value={payment.orderReference ?? '—'} />
        <KeyValue label="Payment method" value={payment.paymentMethodName} />
        <KeyValue label="Transaction ref." value={payment.transactionReference} />
        <KeyValue label="Paid on" value={payment.paymentDate} />
      </View>
      {a && (
        <View style={{ marginTop: 14 }}>
          <AppText variant="subheading">Bill to</AppText>
          <AppText style={{ marginTop: 4, color: colors.gray700 }}>
            {a.fullName}
            {'\n'}
            {a.addressLine1}
            {a.addressLine2 ? `, ${a.addressLine2}` : ''}
            {'\n'}
            {a.city}, {a.state} - {a.pincode}
            {'\n'}
            Phone: {a.phone}
            {a.email ? ` · ${a.email}` : ''}
          </AppText>
        </View>
      )}
      <View style={styles.tableHead}>
        <Text style={[styles.th, { flex: 1 }]}>Product</Text>
        <Text style={[styles.th, { width: 40, textAlign: 'right' }]}>Qty</Text>
        <Text style={[styles.th, { width: 90, textAlign: 'right' }]}>Amount</Text>
      </View>
      {lines.map((l, i) => (
        <View key={i} style={styles.tr}>
          <Text style={{ flex: 1, color: colors.gray800 }}>{l.name}</Text>
          <Text style={{ width: 40, textAlign: 'right', color: colors.gray800 }}>{l.units}</Text>
          <Text style={{ width: 90, textAlign: 'right', color: colors.gray800 }}>{formatInr(l.unitPrice * l.units)}</Text>
        </View>
      ))}
      <Row style={{ justifyContent: 'space-between', marginTop: 12 }}>
        <AppText variant="subheading">Total paid</AppText>
        <AppText variant="heading">{formatInr(payment.amount)}</AppText>
      </Row>
      <AppText variant="caption" style={{ marginTop: 16, textAlign: 'center' }}>
        This is a computer-generated invoice and does not require a signature.
      </AppText>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(245,179,1,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  amount: { fontSize: font.xl, fontWeight: '800', color: colors.gray900 },
  reject: { marginTop: 10, padding: 10, borderRadius: radius.md, backgroundColor: colors.red50 },
  paidPill: { backgroundColor: colors.green600, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: colors.navy,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 16,
  },
  th: { color: colors.white, fontWeight: '700', fontSize: font.xs },
  tr: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
});
