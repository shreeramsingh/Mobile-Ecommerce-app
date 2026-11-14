import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Pause, Pencil, Play, Plus, Tag, Trash2 } from 'lucide-react-native';
import {
  discountAdminApi,
  promoStatus,
  valueLabel,
  type Discount,
  type DiscountInput,
  type DiscountScope,
  type PromoValueType,
} from '../../../api/promo';
import { productsApi } from '../../../api/products';
import { ApiError, errorMessage } from '../../../api/client';
import { AppText, Button, Card, Checkbox, EmptyState, ErrorBox, Input, Loader, Row } from '../../../components/ui';
import { ConfirmDialog, Sheet } from '../../../components/ui/Sheet';
import { toast } from '../../../components/ui/Toast';
import { formatDateTime, formatInr } from '../../../lib/format';
import { DateTimeInput, fromLocalInput, MONEY_PATTERN, PromoStatusBadge, Segmented, toLocalInput } from './shared';
import { colors, font, radius, spacing } from '../../../theme';

const KEY = ['adminDiscounts'];
type StoreProduct = { id: number; title: string; price: number };

/** Automatic sales on store products — buyers see the reduced price, no code needed. */
export function AdminDiscountsScreen() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: KEY, queryFn: discountAdminApi.list });
  const productsQ = useQuery({
    queryKey: ['adminDiscounts', 'storeProducts'],
    queryFn: () =>
      productsApi
        .list({ page: 0, size: 500, isStoreProduct: true })
        .then((r) => r.items.map((p) => ({ id: p.id, title: p.title, price: Number(p.price) })))
        .catch(() => [] as StoreProduct[]),
  });
  const products = productsQ.data ?? [];
  const nameOf = (id: number) => products.find((p) => p.id === id)?.title ?? `Product #${id}`;

  const [editing, setEditing] = useState<Discount | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Discount | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const replace = (d: Discount) =>
    qc.setQueryData<Discount[]>(KEY, (list = []) =>
      list.some((x) => x.id === d.id) ? list.map((x) => (x.id === d.id ? d : x)) : [d, ...list],
    );

  const toggle = async (d: Discount) => {
    setBusyId(d.id);
    try {
      const updated = await discountAdminApi.setActive(d.id, !d.active);
      replace(updated);
      toast.show(updated.active ? `"${d.name}" resumed` : `"${d.name}" paused`, 'info');
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
      await discountAdminApi.remove(deleting.id);
      qc.setQueryData<Discount[]>(KEY, (list = []) => list.filter((x) => x.id !== deleting.id));
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.show(`"${deleting.name}" deleted`);
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
        keyExtractor={(d) => String(d.id)}
        contentContainerStyle={{ padding: spacing.md, gap: 10 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.gold500} />}
        ListHeaderComponent={
          <View style={{ gap: 10 }}>
            <AppText muted>
              Automatic sales on store products — buyers see the reduced price, no code needed. If several apply, the biggest one wins.
            </AppText>
            {q.error ? <ErrorBox message={errorMessage(q.error)} onRetry={() => q.refetch()} /> : null}
            <Button title="New discount" icon={Plus} onPress={() => setEditing('new')} />
          </View>
        }
        ListEmptyComponent={<EmptyState icon={Tag} title="No discounts yet" message="Run a sale on selected products or the whole store." />}
        renderItem={({ item: d }) => {
          const status = promoStatus(d);
          return (
            <Card style={[{ padding: 14 }, !(status === 'ACTIVE' || status === 'SCHEDULED') && { opacity: 0.7 }]}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontWeight: '700' }}>{d.name}</AppText>
                  <Text style={styles.value}>{valueLabel(d.valueType, d.value)}</Text>
                </View>
                <PromoStatusBadge status={status} />
              </Row>
              <Row gap={6} style={{ marginTop: 8, alignItems: 'flex-start' }}>
                <Tag size={13} color={colors.gray500} style={{ marginTop: 2 }} />
                <AppText muted style={{ flex: 1, fontSize: font.sm }} numberOfLines={2}>
                  {d.scope === 'ALL_STORE_PRODUCTS'
                    ? 'All store products'
                    : `${d.productIds.length} product${d.productIds.length === 1 ? '' : 's'}: ${d.productIds.map(nameOf).join(', ')}`}
                </AppText>
              </Row>
              <Row gap={6} style={{ marginTop: 4 }}>
                <CalendarClock size={13} color={colors.gray500} />
                <AppText muted style={{ fontSize: font.sm }}>
                  {formatDateTime(d.startsAt)} → {d.endsAt ? formatDateTime(d.endsAt) : 'no end date'}
                </AppText>
              </Row>
              <Row style={{ marginTop: 12 }}>
                <Button title="Edit" icon={Pencil} size="sm" variant="ghost" onPress={() => setEditing(d)} />
                <Button
                  title={busyId === d.id ? 'Saving…' : d.active ? 'Pause' : 'Resume'}
                  icon={d.active ? Pause : Play}
                  size="sm"
                  variant="ghost"
                  disabled={busyId === d.id}
                  onPress={() => toggle(d)}
                />
                <View style={{ flex: 1 }} />
                <Button title="Delete" icon={Trash2} size="sm" variant="dangerOutline" onPress={() => setDeleting(d)} />
              </Row>
            </Card>
          );
        }}
      />
      {editing && (
        <DiscountEditor
          discount={editing === 'new' ? null : editing}
          products={products}
          onClose={() => setEditing(null)}
          onSaved={(d, created) => {
            replace(d);
            qc.invalidateQueries({ queryKey: ['products'] });
            setEditing(null);
            toast.show(created ? 'Discount created' : 'Discount updated');
          }}
        />
      )}
      <ConfirmDialog
        visible={!!deleting}
        title={`Delete "${deleting?.name}"?`}
        message="Prices go back to normal right away. Orders already placed keep the price they were charged. To stop it temporarily, use Pause instead."
        confirmLabel="Delete"
        destructive
        loading={busyId === deleting?.id}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </View>
  );
}

function DiscountEditor({
  discount,
  products,
  onClose,
  onSaved,
}: {
  discount: Discount | null;
  products: StoreProduct[];
  onClose: () => void;
  onSaved: (d: Discount, created: boolean) => void;
}) {
  const [name, setName] = useState(discount?.name ?? '');
  const [valueType, setValueType] = useState<PromoValueType>(discount?.valueType ?? 'PERCENTAGE');
  const [value, setValue] = useState(discount ? String(discount.value) : '');
  const [scope, setScope] = useState<DiscountScope>(discount?.scope ?? 'SELECTED_PRODUCTS');
  const [selected, setSelected] = useState<Set<number>>(new Set(discount?.productIds ?? []));
  const [startsAt, setStartsAt] = useState(toLocalInput(discount?.startsAt ?? new Date().toISOString()));
  const [endsAt, setEndsAt] = useState(toLocalInput(discount?.endsAt));
  const [active, setActive] = useState(discount?.active ?? true);
  const [search, setSearch] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const v = Number(value);
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return s ? products.filter((p) => p.title.toLowerCase().includes(s) || String(p.id) === s) : products;
  }, [products, search]);
  const preview = (price: number) =>
    Math.max(0, valueType === 'PERCENTAGE' ? price - (price * v) / 100 : price - v);

  const save = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Give the sale a name, e.g. Diwali Sale.';
    if (!value || Number.isNaN(v) || v <= 0) e.value = 'Enter an amount above 0.';
    else if (valueType === 'PERCENTAGE' && v >= 100) e.value = 'Percentage must be below 100.';
    else if (!MONEY_PATTERN.test(value)) e.value = 'Use up to 2 decimal places.';
    if (scope === 'SELECTED_PRODUCTS' && selected.size === 0) e.productIds = 'Pick at least one product.';
    const start = fromLocalInput(startsAt);
    const end = fromLocalInput(endsAt);
    if (!start) e.startsAt = start === undefined ? 'Use the format YYYY-MM-DD HH:mm.' : 'Choose when the sale starts.';
    if (end === undefined) e.endsAt = 'Use the format YYYY-MM-DD HH:mm.';
    else if (start && end && new Date(end) <= new Date(start)) e.endsAt = 'End must be after the start.';
    setErrors(e);
    if (Object.keys(e).length) return;

    const body: DiscountInput = {
      name: name.trim(),
      valueType,
      value: v,
      scope,
      productIds: scope === 'ALL_STORE_PRODUCTS' ? [] : [...selected],
      startsAt: start!,
      endsAt: end ?? null,
      active,
    };
    setSaving(true);
    setFormError(null);
    try {
      const saved = discount ? await discountAdminApi.update(discount.id, body) : await discountAdminApi.create(body);
      onSaved(saved, !discount);
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
      title={discount ? 'Edit discount' : 'New discount'}
      dismissable={!saving}
      footer={
        <>
          <Button title="Cancel" variant="ghost" onPress={onClose} disabled={saving} style={{ flex: 1 }} />
          <Button title={saving ? 'Saving…' : 'Save'} loading={saving} onPress={save} style={{ flex: 1 }} />
        </>
      }
    >
      <Input label="Sale name (shown to buyers)" value={name} onChangeText={setName} placeholder="Diwali Sale" maxLength={100} error={errors.name} />
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
        label={valueType === 'PERCENTAGE' ? 'Percent off' : 'Rupees off each item'}
        value={value}
        onChangeText={setValue}
        placeholder={valueType === 'PERCENTAGE' ? '10' : '500'}
        keyboardType="decimal-pad"
        error={errors.value}
      />
      <AppText variant="label" style={{ marginBottom: 6 }}>Applies to</AppText>
      <Segmented
        value={scope}
        onChange={setScope}
        options={[
          { value: 'SELECTED_PRODUCTS', label: 'Selected products' },
          { value: 'ALL_STORE_PRODUCTS', label: 'Whole store' },
        ]}
      />
      {scope === 'SELECTED_PRODUCTS' && (
        <View style={{ marginBottom: 12 }}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search store products"
            placeholderTextColor={colors.gray400}
            style={styles.search}
          />
          <ScrollView style={styles.pickList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {filtered.length === 0 ? (
              <AppText muted style={{ padding: 12, textAlign: 'center' }}>
                {products.length ? 'No products match your search.' : 'No store products found.'}
              </AppText>
            ) : (
              filtered.map((p) => {
                const checked = selected.has(p.id);
                return (
                  <Pressable
                    key={p.id}
                    style={styles.pickRow}
                    onPress={() =>
                      setSelected((s) => {
                        const next = new Set(s);
                        checked ? next.delete(p.id) : next.add(p.id);
                        return next;
                      })
                    }
                  >
                    <View style={[styles.box, checked && { backgroundColor: colors.gold500, borderColor: colors.gold500 }]}>
                      {checked && <Text style={{ color: colors.onAccent, fontWeight: '800', fontSize: 12 }}>✓</Text>}
                    </View>
                    <AppText style={{ flex: 1, fontSize: font.sm }} numberOfLines={1}>{p.title}</AppText>
                    {checked && v > 0 ? (
                      <Row gap={4}>
                        <Text style={styles.strike}>{formatInr(p.price)}</Text>
                        <Text style={{ color: colors.green600, fontWeight: '700', fontSize: font.xs }}>{formatInr(preview(p.price))}</Text>
                      </Row>
                    ) : (
                      <AppText muted style={{ fontSize: font.xs }}>{formatInr(p.price)}</AppText>
                    )}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
          <AppText variant="caption" style={{ marginTop: 4 }}>{selected.size} selected</AppText>
          {errors.productIds ? <Text style={styles.err}>{errors.productIds}</Text> : null}
        </View>
      )}
      <DateTimeInput label="Starts" value={startsAt} onChange={setStartsAt} error={errors.startsAt} />
      <DateTimeInput label="Ends (optional)" value={endsAt} onChange={setEndsAt} error={errors.endsAt} optional />
      <Checkbox checked={active} onChange={setActive} label="Enabled (uncheck to save it paused)" />
      {formError ? <ErrorBox message={formError} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  value: { color: colors.gold500, fontWeight: '800', fontSize: font.xl, marginTop: 2 },
  search: {
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 12,
    height: 42,
    color: colors.white,
    marginBottom: 6,
  },
  pickList: { maxHeight: 240, borderWidth: 1, borderColor: colors.gray200, borderRadius: radius.md, overflow: 'hidden' },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.gray400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strike: { color: colors.gray400, fontSize: font.xs, textDecorationLine: 'line-through' },
  err: { color: colors.red600, fontSize: font.xs, marginTop: 4 },
});
