import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Copy, Pause, Pencil, Play, Plus, Shuffle, Ticket, Trash2, Users } from 'lucide-react-native';
import {
  promoStatus,
  valueLabel,
  voucherAdminApi,
  VOUCHER_CODE_PATTERN,
  type PromoValueType,
  type Voucher,
  type VoucherInput,
} from '../../../api/promo';
import { ApiError, errorMessage } from '../../../api/client';
import { AppText, Button, Card, Checkbox, EmptyState, ErrorBox, Input, Loader, Row } from '../../../components/ui';
import { ConfirmDialog, Sheet } from '../../../components/ui/Sheet';
import { toast } from '../../../components/ui/Toast';
import { formatDateTime, formatInr } from '../../../lib/format';
import {
  DateTimeInput,
  fromLocalInput,
  MONEY_PATTERN,
  PromoStatusBadge,
  Segmented,
  toLocalInput,
  WHOLE_PATTERN,
} from './shared';
import { colors, font, radius, spacing } from '../../../theme';

const KEY = ['adminVouchers'];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode = () => Array.from({ length: 8 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

/** Coupon codes buyers enter in the cart. One voucher per order, applied after sale discounts. */
export function AdminVouchersScreen() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: KEY, queryFn: voucherAdminApi.list });
  const [editing, setEditing] = useState<Voucher | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Voucher | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const replace = (v: Voucher) =>
    qc.setQueryData<Voucher[]>(KEY, (list = []) =>
      list.some((x) => x.id === v.id) ? list.map((x) => (x.id === v.id ? v : x)) : [v, ...list],
    );

  const toggle = async (v: Voucher) => {
    setBusyId(v.id);
    try {
      const updated = await voucherAdminApi.setActive(v.id, !v.active);
      replace(updated);
      toast.show(updated.active ? `${v.code} can be used again` : `${v.code} paused`, 'info');
    } catch (e) {
      toast.show(errorMessage(e), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      await voucherAdminApi.remove(deleting.id);
      qc.setQueryData<Voucher[]>(KEY, (list = []) => list.filter((x) => x.id !== deleting.id));
      toast.show(`${deleting.code} deleted`);
      setDeleting(null);
    } catch (e) {
      toast.show(errorMessage(e), 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (q.isLoading) return <Loader style={{ flex: 1 }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.gray100 }}>
      <FlatList
        data={q.data ?? []}
        keyExtractor={(v) => String(v.id)}
        contentContainerStyle={{ padding: spacing.md, gap: 10 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.gold500} />}
        ListHeaderComponent={
          <View style={{ gap: 10 }}>
            <AppText muted>Coupon codes buyers enter in the cart. One voucher per order, applied after any sale discounts.</AppText>
            {q.error ? <ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} /> : null}
            <Button title="New voucher" icon={Plus} onPress={() => setEditing('new')} />
          </View>
        }
        ListEmptyComponent={<EmptyState icon={Ticket} title="No vouchers yet" message="Create a code like WELCOME10 and share it with buyers." />}
        renderItem={({ item: v }) => {
          const status = promoStatus(v);
          const rules = [
            v.minOrderAmount != null ? `Min. order ${formatInr(v.minOrderAmount)}` : null,
            v.valueType === 'PERCENTAGE' && v.maxDiscountAmount != null ? `Up to ${formatInr(v.maxDiscountAmount)} off` : null,
            v.perUserLimit != null ? `${v.perUserLimit}× per buyer` : null,
          ].filter(Boolean) as string[];
          return (
            <Card style={[{ padding: 14 }, !(status === 'ACTIVE' || status === 'SCHEDULED') && { opacity: 0.7 }]}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Pressable
                  style={styles.code}
                  onPress={() => {
                    Clipboard.setString(v.code);
                    toast.show(`Copied ${v.code}`, 'info');
                  }}
                  accessibilityLabel="Copy code"
                >
                  <Text style={styles.codeText}>{v.code}</Text>
                  <Copy size={14} color={colors.gold500} />
                </Pressable>
                <PromoStatusBadge status={status} />
              </Row>
              <Text style={styles.value}>{valueLabel(v.valueType, v.value)}</Text>
              {v.description ? <AppText muted numberOfLines={2} style={{ fontSize: font.sm }}>{v.description}</AppText> : null}
              {rules.length > 0 && (
                <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 8 }}>
                  {rules.map((r) => (
                    <View key={r} style={styles.rule}>
                      <Text style={styles.ruleText}>{r}</Text>
                    </View>
                  ))}
                </Row>
              )}
              <Row gap={6} style={{ marginTop: 8 }}>
                <Users size={13} color={colors.gray500} />
                <AppText muted style={{ fontSize: font.sm }}>
                  {v.usageLimit != null ? `Used ${v.usedCount} of ${v.usageLimit}` : `Used ${v.usedCount} times`}
                </AppText>
              </Row>
              <Row gap={6} style={{ marginTop: 4 }}>
                <CalendarClock size={13} color={colors.gray500} />
                <AppText muted style={{ fontSize: font.sm }}>
                  {formatDateTime(v.startsAt)} → {v.endsAt ? formatDateTime(v.endsAt) : 'no end date'}
                </AppText>
              </Row>
              <Row style={{ marginTop: 12 }}>
                <Button title="Edit" icon={Pencil} size="sm" variant="ghost" onPress={() => setEditing(v)} />
                <Button
                  title={busyId === v.id ? 'Saving…' : v.active ? 'Pause' : 'Resume'}
                  icon={v.active ? Pause : Play}
                  size="sm"
                  variant="ghost"
                  disabled={busyId === v.id}
                  onPress={() => toggle(v)}
                />
                <View style={{ flex: 1 }} />
                <Button title="Delete" icon={Trash2} size="sm" variant="dangerOutline" onPress={() => setDeleting(v)} />
              </Row>
            </Card>
          );
        }}
      />
      {editing && (
        <VoucherEditor
          voucher={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(v, created) => {
            replace(v);
            setEditing(null);
            toast.show(created ? `Voucher ${v.code} created` : 'Voucher updated');
          }}
        />
      )}
      <ConfirmDialog
        visible={!!deleting}
        title={`Delete voucher ${deleting?.code}?`}
        message="Buyers won't be able to use it any more. Orders that already used it keep their discount. To stop it temporarily, use Pause instead."
        confirmLabel="Delete"
        destructive
        loading={busyId === deleting?.id}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </View>
  );
}

function VoucherEditor({
  voucher,
  onClose,
  onSaved,
}: {
  voucher: Voucher | null;
  onClose: () => void;
  onSaved: (v: Voucher, created: boolean) => void;
}) {
  const str = (n: number | null | undefined) => (n == null ? '' : String(n));
  const [code, setCode] = useState(voucher?.code ?? '');
  const [description, setDescription] = useState(voucher?.description ?? '');
  const [valueType, setValueType] = useState<PromoValueType>(voucher?.valueType ?? 'PERCENTAGE');
  const [value, setValue] = useState(str(voucher?.value));
  const [maxDiscount, setMaxDiscount] = useState(str(voucher?.maxDiscountAmount));
  const [minOrder, setMinOrder] = useState(str(voucher?.minOrderAmount));
  const [usageLimit, setUsageLimit] = useState(str(voucher?.usageLimit));
  const [perUser, setPerUser] = useState(voucher ? str(voucher.perUserLimit) : '1');
  const [startsAt, setStartsAt] = useState(toLocalInput(voucher?.startsAt ?? new Date().toISOString()));
  const [endsAt, setEndsAt] = useState(toLocalInput(voucher?.endsAt));
  const [active, setActive] = useState(voucher?.active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const e: Record<string, string> = {};
    const v = Number(value);
    if (!VOUCHER_CODE_PATTERN.test(code)) e.code = '4–20 letters or digits, no spaces.';
    if (!value || Number.isNaN(v) || v <= 0 || !MONEY_PATTERN.test(value)) e.value = 'Enter an amount above 0 (max 2 decimals).';
    else if (valueType === 'PERCENTAGE' && v >= 100) e.value = 'Percentage must be below 100.';
    if (valueType === 'PERCENTAGE' && maxDiscount && !MONEY_PATTERN.test(maxDiscount)) e.maxDiscountAmount = 'Enter a rupee amount.';
    if (minOrder && !MONEY_PATTERN.test(minOrder)) e.minOrderAmount = 'Enter a rupee amount.';
    else if (valueType === 'FLAT' && minOrder && !e.value && Number(minOrder) < v) e.minOrderAmount = 'Should be at least the voucher amount.';
    if (usageLimit && !WHOLE_PATTERN.test(usageLimit)) e.usageLimit = 'Whole number, 1 or more.';
    if (perUser && !WHOLE_PATTERN.test(perUser)) e.perUserLimit = 'Whole number, 1 or more.';
    const start = fromLocalInput(startsAt);
    const end = fromLocalInput(endsAt);
    if (!start) e.startsAt = start === undefined ? 'Use the format YYYY-MM-DD HH:mm.' : 'Choose when the voucher starts.';
    if (end === undefined) e.endsAt = 'Use the format YYYY-MM-DD HH:mm.';
    else if (start && end && new Date(end) <= new Date(start)) e.endsAt = 'End must be after the start.';
    setErrors(e);
    if (Object.keys(e).length) return;

    const num = (s: string) => (s ? Number(s) : null);
    const body: VoucherInput = {
      code,
      description: description.trim() || null,
      valueType,
      value: v,
      maxDiscountAmount: valueType === 'PERCENTAGE' ? num(maxDiscount) : null,
      minOrderAmount: num(minOrder),
      usageLimit: num(usageLimit),
      perUserLimit: num(perUser),
      startsAt: start!,
      endsAt: end ?? null,
      active,
    };
    setSaving(true);
    setFormError(null);
    try {
      const saved = voucher ? await voucherAdminApi.update(voucher.id, body) : await voucherAdminApi.create(body);
      onSaved(saved, !voucher);
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={voucher ? `Edit ${voucher.code}` : 'New voucher'}
      dismissable={!saving}
      footer={
        <>
          <Button title="Cancel" variant="ghost" onPress={onClose} disabled={saving} style={{ flex: 1 }} />
          <Button title={saving ? 'Saving…' : 'Save'} loading={saving} onPress={save} style={{ flex: 1 }} />
        </>
      }
    >
      <Input
        label="Code"
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        placeholder="WELCOME10"
        maxLength={20}
        autoCapitalize="characters"
        autoCorrect={false}
        style={{ fontFamily: 'Menlo', letterSpacing: 1.5 }}
        error={errors.code}
        right={
          <Pressable onPress={() => setCode(randomCode())} style={styles.gen} accessibilityLabel="Generate a random code">
            <Shuffle size={14} color={colors.gold500} />
            <Text style={{ color: colors.gold500, fontWeight: '700', fontSize: 12 }}>Generate</Text>
          </Pressable>
        }
      />
      <Input
        label="Description (optional, shown to the buyer)"
        value={description}
        onChangeText={setDescription}
        placeholder="10% off your first order"
        maxLength={200}
      />
      <AppText variant="label" style={{ marginBottom: 6 }}>Discount type</AppText>
      <Segmented
        value={valueType}
        onChange={setValueType}
        options={[
          { value: 'PERCENTAGE', label: '% off' },
          { value: 'FLAT', label: '₹ off' },
        ]}
      />
      <Input
        label={valueType === 'PERCENTAGE' ? 'Percent off the order' : 'Rupees off the order'}
        value={value}
        onChangeText={setValue}
        keyboardType="decimal-pad"
        error={errors.value}
      />
      {valueType === 'PERCENTAGE' && (
        <Input label="Max discount ₹ (optional)" value={maxDiscount} onChangeText={setMaxDiscount} placeholder="No cap" keyboardType="decimal-pad" error={errors.maxDiscountAmount} />
      )}
      <Input label="Minimum order ₹ (optional)" value={minOrder} onChangeText={setMinOrder} placeholder="No minimum" keyboardType="decimal-pad" error={errors.minOrderAmount} />
      <Row>
        <Input label="Total uses (optional)" value={usageLimit} onChangeText={setUsageLimit} placeholder="Unlimited" keyboardType="number-pad" error={errors.usageLimit} containerStyle={{ flex: 1 }} />
        <Input label="Uses per buyer (optional)" value={perUser} onChangeText={setPerUser} placeholder="Unlimited" keyboardType="number-pad" error={errors.perUserLimit} containerStyle={{ flex: 1 }} />
      </Row>
      <DateTimeInput label="Starts" value={startsAt} onChange={setStartsAt} error={errors.startsAt} />
      <DateTimeInput label="Ends (optional)" value={endsAt} onChange={setEndsAt} error={errors.endsAt} optional />
      <Checkbox checked={active} onChange={setActive} label="Enabled (uncheck to save it paused)" />
      {formError ? <ErrorBox message={formError} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  code: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.gold500,
    borderRadius: radius.sm + 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  codeText: { color: colors.white, fontFamily: 'Menlo', fontWeight: '800', letterSpacing: 1.5 },
  value: { color: colors.gold500, fontWeight: '800', fontSize: font.xl, marginTop: 8 },
  rule: { backgroundColor: colors.surfaceAlt, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  ruleText: { color: colors.gray600, fontSize: 11, fontWeight: '600' },
  gen: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10 },
});
