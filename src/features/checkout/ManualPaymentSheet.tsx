import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Building2, FileText, QrCode, Upload, X } from 'lucide-react-native';
import { paymentUserApi, shopOrderApi } from '../../api/payments';
import type { PaymentSubmission } from '../../api/types';
import { ApiError, errorMessage } from '../../api/client';
import { Sheet } from '../../components/ui/Sheet';
import { AppText, Button, ErrorBox, Input, Row } from '../../components/ui';
import { PaymentMethodDetails } from '../payments/components';
import { pickReceipt } from '../../lib/filePicker';
import { checkFile, RECEIPT_TYPES, TXN_REF_PATTERN, type PickedFile } from '../../lib/validation';
import { formatInr, todayIso } from '../../lib/format';
import { colors, font, radius } from '../../theme';

type Field = 'method' | 'amount' | 'txnRef' | 'paymentDate' | 'remarks' | 'receipt';

const yesterdayIso = () => {
  const d = new Date(Date.now() - 86_400_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function ManualPaymentSheet({
  visible,
  onClose,
  amount,
  orderReference,
  productIds,
  onSubmitted,
}: {
  visible: boolean;
  onClose: () => void;
  amount?: number;
  orderReference?: string;
  productIds?: number[];
  onSubmitted: (p: PaymentSubmission) => void;
}) {
  const methodsQ = useQuery({
    queryKey: ['paymentMethods', 'user'],
    queryFn: paymentUserApi.listMethods,
    enabled: visible,
    staleTime: 0,
  });
  const methods = useMemo(() => methodsQ.data ?? [], [methodsQ.data]);

  const [methodId, setMethodId] = useState<number | null>(null);
  const [amountText, setAmountText] = useState('');
  const [txnRef, setTxnRef] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [remarks, setRemarks] = useState('');
  const [receipt, setReceipt] = useState<PickedFile | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Field | string, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setMethodId(null);
    setAmountText(amount != null ? amount.toFixed(2) : '');
    setTxnRef('');
    setPaymentDate(todayIso());
    setRemarks('');
    setReceipt(null);
    setErrors({});
    setFormError(null);
  }, [visible, amount]);

  // Auto-select when there's only one way to pay.
  useEffect(() => {
    if (methods.length === 1 && methodId == null) setMethodId(methods[0].id);
  }, [methods, methodId]);

  const selected = methods.find((m) => m.id === methodId);
  const amountNumber = Number(amountText);

  const chooseReceipt = async () => {
    try {
      const f = await pickReceipt();
      if (!f) return;
      const err = checkFile(f, RECEIPT_TYPES);
      setErrors((e) => ({ ...e, receipt: err ?? undefined }));
      setReceipt(err ? null : f);
    } catch (e) {
      setErrors((x) => ({ ...x, receipt: errorMessage(e) }));
    }
  };

  const validate = () => {
    const e: Partial<Record<Field, string>> = {};
    if (!selected) e.method = 'Choose how you paid.';
    if (!amountText || Number.isNaN(amountNumber) || amountNumber < 1) e.amount = 'Enter an amount of at least ₹1.';
    else if (!/^\d{1,10}(\.\d{1,2})?$/.test(amountText)) e.amount = 'Use up to 2 decimal places.';
    const ref = txnRef.trim();
    if (!ref) e.txnRef = 'Enter the UTR / UPI reference number.';
    else if (ref.length > 50) e.txnRef = 'Maximum 50 characters.';
    else if (!TXN_REF_PATTERN.test(ref)) e.txnRef = 'Only letters, digits and hyphens.';
    if (!paymentDate) e.paymentDate = 'Choose the payment date.';
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate) || Number.isNaN(Date.parse(paymentDate))) e.paymentDate = 'Use the format YYYY-MM-DD.';
    else if (paymentDate > todayIso()) e.paymentDate = "Date can't be in the future.";
    if (remarks.length > 500) e.remarks = 'Maximum 500 characters.';
    if (!receipt) e.receipt = 'Upload a screenshot or PDF of the payment.';
    else {
      const fe = checkFile(receipt, RECEIPT_TYPES);
      if (fe) e.receipt = fe;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate() || !selected || !receipt) return;
    setSubmitting(true);
    setFormError(null);
    try {
      let ids = productIds;
      if (!ids && orderReference) {
        const order = await shopOrderApi.get(orderReference);
        ids = [...new Set(order.items.map((i) => i.productId))];
      }
      const payment = await paymentUserApi.submitPayment({
        paymentMethodId: selected.id,
        amount: amountNumber.toFixed(2),
        transactionReference: txnRef.trim(),
        paymentDate,
        remarks,
        orderReference,
        productIds: ids,
        receipt,
      });
      onSubmitted(payment);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors({ ...err.fieldErrors });
        if (err.status === 400 && /not available/i.test(err.message)) {
          setMethodId(null);
          methodsQ.refetch();
        }
      }
      setFormError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Pay by bank transfer or UPI"
      dismissable={!submitting}
      footer={
        <>
          <Button title="Cancel" variant="ghost" onPress={onClose} disabled={submitting} style={{ flex: 1 }} />
          <Button
            title={submitting ? 'Submitting…' : 'Submit payment'}
            loading={submitting}
            disabled={methods.length === 0}
            onPress={submit}
            style={{ flex: 2 }}
          />
        </>
      }
    >
      <AppText muted>
        Pay using one of the options below, then upload your receipt. We'll confirm your order once the payment is verified.
      </AppText>
      {amount != null && (
        <View style={styles.amountBox}>
          <Text style={{ color: colors.amber700, fontSize: font.sm }}>Amount to pay</Text>
          <Text style={{ color: colors.gray900, fontSize: font.xxl, fontWeight: '800' }}>{formatInr(amount)}</Text>
        </View>
      )}
      {formError ? <ErrorBox message={formError} /> : null}

      <AppText variant="subheading" style={styles.step}>1. Choose a payment option</AppText>
      {methodsQ.isLoading ? (
        <ActivityIndicator color={colors.gold500} style={{ marginVertical: 16 }} />
      ) : methodsQ.error ? (
        <ErrorBox message={errorMessage(methodsQ.error)} onRetry={() => methodsQ.refetch()} />
      ) : methods.length === 0 ? (
        <AppText muted>No payment options are available right now. Please contact support.</AppText>
      ) : (
        <View style={styles.methodGrid}>
          {methods.map((m) => {
            const active = m.id === methodId;
            const Icon = m.type === 'QR_CODE' ? QrCode : Building2;
            return (
              <Pressable
                key={m.id}
                onPress={() => setMethodId(m.id)}
                style={[styles.method, active && styles.methodActive]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
              >
                <Icon size={20} color={active ? colors.gold600 : colors.gray500} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodName} numberOfLines={1}>{m.displayName}</Text>
                  <Text style={styles.methodSub} numberOfLines={1}>
                    {m.type === 'QR_CODE' ? 'UPI / QR code' : `Bank transfer · ${m.bankName ?? ''}`}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
      {errors.method ? <Text style={styles.err}>{errors.method}</Text> : null}
      {selected && <PaymentMethodDetails method={selected} amount={amount} />}

      <AppText variant="subheading" style={styles.step}>2. Enter payment details</AppText>
      {amount == null && (
        <Input
          label="Amount paid (₹)"
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
          error={errors.amount}
        />
      )}
      <Input
        label="UTR / UPI reference no."
        value={txnRef}
        onChangeText={setTxnRef}
        placeholder="e.g. 429815673412"
        maxLength={50}
        autoCapitalize="characters"
        autoCorrect={false}
        error={errors.txnRef ?? errors.transactionReference}
      />
      <Input
        label="Payment date"
        value={paymentDate}
        onChangeText={setPaymentDate}
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        error={errors.paymentDate}
        right={
          <Row gap={4} style={{ paddingRight: 8 }}>
            <Chip label="Today" onPress={() => setPaymentDate(todayIso())} />
            <Chip label="Yesterday" onPress={() => setPaymentDate(yesterdayIso())} />
          </Row>
        }
      />

      <AppText variant="label" style={{ marginBottom: 6 }}>Payment receipt / screenshot</AppText>
      {receipt ? (
        <View style={styles.fileRow}>
          <FileText size={18} color={colors.gray600} />
          <Text style={{ flex: 1, color: colors.gray800 }} numberOfLines={1}>{receipt.name}</Text>
          <Pressable onPress={() => setReceipt(null)} hitSlop={8} accessibilityLabel="Remove file">
            <X size={18} color={colors.gray500} />
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.drop} onPress={chooseReceipt} accessibilityRole="button">
          <Upload size={22} color={colors.gray500} />
          <Text style={{ fontWeight: '700', color: colors.gray700, marginTop: 6 }}>Tap to upload</Text>
          <Text style={{ fontSize: font.xs, color: colors.gray500, marginTop: 2 }}>PNG, JPG or PDF · max 5 MB</Text>
        </Pressable>
      )}
      {errors.receipt ? <Text style={styles.err}>{errors.receipt}</Text> : null}

      <Input
        label="Note (optional)"
        value={remarks}
        onChangeText={setRemarks}
        multiline
        maxLength={500}
        error={errors.remarks}
        containerStyle={{ marginTop: 12 }}
      />
    </Sheet>
  );
}

function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.chip} hitSlop={4}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.gray600 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  amountBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.amber50,
    borderWidth: 1,
    borderColor: 'rgba(245,179,1,0.3)',
  },
  step: { marginTop: 18, marginBottom: 10 },
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  method: {
    flexGrow: 1,
    flexBasis: '46%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.gray200,
  },
  methodActive: { borderColor: colors.gold500, backgroundColor: 'rgba(245,179,1,0.06)' },
  methodName: { fontWeight: '700', color: colors.gray900, fontSize: font.sm },
  methodSub: { color: colors.gray500, fontSize: font.xs, marginTop: 2 },
  err: { color: colors.red600, fontSize: font.xs, marginTop: 4 },
  drop: {
    alignItems: 'center',
    padding: 20,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.gray300,
    backgroundColor: colors.gray50,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.gray50,
  },
  chip: { backgroundColor: colors.gray100, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
});
