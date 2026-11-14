import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin } from 'lucide-react-native';
import type { RootScreenProps } from '../../navigation/types';
import { productsApi, mapProduct } from '../../api/products';
import { errorMessage } from '../../api/client';
import { useAppSelector } from '../../store';
import { useAppDispatch } from '../../store';
import { refreshRecentlyViewed } from '../../store/slices/recentlyViewedSlice';
import type { Product } from '../../api/types';
import { AppText, Button, Card, Checkbox, EmptyState, ErrorBox, Input, Loader, Row } from '../../components/ui';
import { ConfirmDialog, Select, type SelectOption } from '../../components/ui/Sheet';
import { toast } from '../../components/ui/Toast';
import { PhotoTiles } from './PhotoTiles';
import { useImageUploads, type UploadTile } from './imageUpload';
import { geocode } from '../../lib/geocode';
import { RIFLE_PURPOSES, WEAPON_CATEGORIES, WEAPON_TYPES } from '../../data/weaponCategories';
import { colors, spacing } from '../../theme';

interface Form {
  title: string;
  description: string;
  weaponCategoryFkId: number | null;
  weaponTypeFkId: number | null;
  weaponSubTypeFkId: number | null;
  caliberFkId: number | null;
  riflePurposeFkId: number | null;
  licenseRequired: boolean;
  price: string;
  isNegotiable: boolean;
  location: string;
  zipCode: string;
  city: string;
  state: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  isStoreProduct: boolean;
}

const EMPTY: Form = {
  title: '', description: '', weaponCategoryFkId: null, weaponTypeFkId: null, weaponSubTypeFkId: null,
  caliberFkId: null, riflePurposeFkId: null, licenseRequired: false, price: '', isNegotiable: false,
  location: '', zipCode: '', city: '', state: '', country: 'India', latitude: null, longitude: null, isStoreProduct: false,
};

const num = (v: unknown) => (v == null || v === '' || Number(v) === 0 ? null : Number(v));

export function SellProductScreen({ route, navigation }: RootScreenProps<'SellProduct'>) {
  const headerHeight = useHeaderHeight();
  const productId = route.params?.productId;
  const isEdit = productId != null;
  const user = useAppSelector((s) => s.auth.user);
  const qc = useQueryClient();
  const dispatch = useAppDispatch();
  const refreshRecent = (list: Product[]) => dispatch(refreshRecentlyViewed(list));

  const rawQ = useQuery({
    queryKey: ['rawProduct', productId],
    queryFn: () => productsApi.rawById(productId!),
    enabled: isEdit,
    staleTime: 0,
  });

  const [form, setForm] = useState<Form>(EMPTY);
  const uploads = useImageUploads(user?.nodeId);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [leave, setLeave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Prefill when editing.
  useEffect(() => {
    const p = rawQ.data;
    if (!p) return;
    setForm({
      title: p.title ?? '',
      description: p.description ?? '',
      weaponCategoryFkId: num(p.weaponCategoryFkId),
      weaponTypeFkId: num(p.weaponTypeFkId),
      weaponSubTypeFkId: num(p.weaponSubTypeFkId),
      caliberFkId: num(p.caliberFkId),
      riflePurposeFkId: num(p.riflePurposeFkId),
      licenseRequired: Boolean(p.isLicenseRequired ?? p.licenseRequired),
      price: p.price != null ? String(p.price) : '',
      isNegotiable: Boolean(p.negotiable ?? p.isNegotiable),
      location: p.location ?? '',
      zipCode: p.zipCode ?? '',
      city: p.city ?? '',
      state: p.state ?? '',
      country: p.country || 'India',
      latitude: num(p.latitude),
      longitude: num(p.longitude),
      isStoreProduct: !!p.isStoreProduct,
    });
    uploads.setTiles(
      (p.productImageList ?? []).map(
        (img): UploadTile => ({
          key: img.productImageId,
          imageId: img.productImageId,
          previewUri: img.profileImageUrl ?? undefined,
          status: 'done',
        }),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawQ.data]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setDirty(true);
    setForm((f) => ({ ...f, [k]: v }));
  };

  // ── Weapon taxonomy (cascading) ──
  const type = WEAPON_TYPES.find((t) => t.id === form.weaponTypeFkId);
  const subTypeHasCalibers = !!type?.subTypes.some((s) => s.caliberGroups?.length);
  const subType = type?.subTypes.find((s) => s.id === form.weaponSubTypeFkId);
  const caliberOptions: SelectOption<number>[] = useMemo(() => {
    const groups = subTypeHasCalibers ? subType?.caliberGroups ?? [] : type?.caliberGroups ?? [];
    return groups.flatMap((g) => g.calibers.map((c) => ({ value: c.id, label: c.name, group: g.name })));
  }, [subTypeHasCalibers, subType, type]);
  const caliberPlaceholder = !type
    ? 'Select a type first'
    : subTypeHasCalibers && !subType
    ? 'Select a sub type first'
    : 'Select Caliber';

  const autofill = async () => {
    setLocating(true);
    try {
      const r = await geocode(form.zipCode || form.location);
      if (!r) return toast.show('Location not found.', 'error');
      setDirty(true);
      setForm((f) => ({
        ...f,
        latitude: r.lat,
        longitude: r.lng,
        location: r.location,
        city: r.city || f.city,
        state: r.state || f.state,
        zipCode: r.zipCode || f.zipCode,
        country: r.country || 'India',
      }));
    } catch {
      toast.show('Error fetching location.', 'error');
    } finally {
      setLocating(false);
    }
  };

  const validate = () => {
    const e: Partial<Record<keyof Form, string>> = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (!form.price || Number(form.price) <= 0) e.price = 'Enter a valid price';
    if (!form.weaponCategoryFkId) e.weaponCategoryFkId = 'Select a weapon category';
    setErrors(e);
    if (Object.keys(e).length) {
      setFormError('Please fill Title, Price and Weapon Category.');
      return false;
    }
    if (uploads.isUploading) {
      setFormError('Please wait for all images to finish uploading.');
      return false;
    }
    if (!user?.nodeId) {
      setFormError('You must be logged in to post an ad.');
      return false;
    }
    setFormError(null);
    return true;
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        description: form.description.trim(),
        weaponCategoryFkId: form.weaponCategoryFkId,
        weaponTypeFkId: form.weaponTypeFkId,
        weaponSubTypeFkId: form.weaponSubTypeFkId,
        caliberFkId: form.caliberFkId,
        riflePurposeFkId: type?.hasPurpose ? form.riflePurposeFkId : null,
        licenseRequired: form.licenseRequired,
        price: Number(form.price),
        isNegotiable: form.isNegotiable,
        productQuantity: 1,
        isStoreProduct: form.isStoreProduct,
        sellerId: user!.nodeId!,
        location: form.location.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        zipCode: form.zipCode.trim(),
        country: form.country.trim() || 'India',
        status: 'LIVE',
        createdAt: '',
        updatedAt: '',
        latitude: form.latitude ?? 0,
        longitude: form.longitude ?? 0,
        productImageList: uploads.productImageList(),
      };
      if (isEdit) {
        await productsApi.update(productId!, body);
        const fresh = await productsApi.rawById(productId!);
        if (fresh) refreshRecent([mapProduct(fresh)]);
        toast.show('Your ad has been updated successfully!');
      } else {
        await productsApi.create(body);
        toast.show('Your ad has been posted successfully!');
      }
      qc.invalidateQueries({ queryKey: ['products'] });
      setConfirm(false);
      setDirty(false);
      setTimeout(() => navigation.goBack(), 0);
    } catch (e) {
      setConfirm(false);
      setFormError(`Something went wrong: ${errorMessage(e)}`);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (!dirty || saving) return;
      e.preventDefault();
      setLeave(true);
      pendingLeave = () => navigation.dispatch(e.data.action);
    });
    return unsub;
  }, [navigation, dirty, saving]);

  if (isEdit && rawQ.isLoading) return <Loader style={{ flex: 1 }} label="Loading ad..." />;
  if (isEdit && (rawQ.error || !rawQ.data))
    return (
      <EmptyState
        emoji="⚠️"
        title={rawQ.error ? 'Could not load this ad. Please try again.' : 'This ad could not be loaded for editing.'}
        action={<Button title="Go back" variant="ghost" onPress={() => navigation.goBack()} />}
      />
    );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={headerHeight}>
      <ScrollView style={{ backgroundColor: colors.gray100 }} contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {formError ? <ErrorBox message={formError} /> : null}

        <Card>
          <Input label="Title *" value={form.title} onChangeText={(t) => set('title', t)} placeholder="Title *" maxLength={120} error={errors.title} />
          <Input label="Description" value={form.description} onChangeText={(t) => set('description', t)} placeholder="Description" multiline maxLength={4000} />
        </Card>

        <Card>
          <AppText variant="heading" style={{ marginBottom: 12 }}>Weapon details</AppText>
          <Select
            label="Weapon Category *"
            placeholder="Select Category *"
            value={form.weaponCategoryFkId}
            options={WEAPON_CATEGORIES.map((c) => ({ value: c.id, label: c.name }))}
            onChange={(v) => set('weaponCategoryFkId', v)}
            error={errors.weaponCategoryFkId}
          />
          <Select
            label="Weapon Type"
            placeholder="Select Weapon Type"
            value={form.weaponTypeFkId}
            options={WEAPON_TYPES.map((t) => ({ value: t.id, label: t.name }))}
            onChange={(v) => {
              setDirty(true);
              setForm((f) => ({ ...f, weaponTypeFkId: v, weaponSubTypeFkId: null, caliberFkId: null, riflePurposeFkId: null }));
            }}
          />
          <Select
            label={type?.hasPurpose ? 'Action' : 'Weapon Sub Type'}
            placeholder={type ? 'Select Sub Type' : 'Select a type first'}
            disabled={!type}
            value={form.weaponSubTypeFkId}
            options={(type?.subTypes ?? []).map((s) => ({ value: s.id, label: s.name }))}
            onChange={(v) => {
              setDirty(true);
              setForm((f) => ({ ...f, weaponSubTypeFkId: v, caliberFkId: subTypeHasCalibers ? null : f.caliberFkId }));
            }}
          />
          <Select
            label="Caliber / Bore"
            placeholder={caliberPlaceholder}
            disabled={caliberOptions.length === 0}
            value={form.caliberFkId}
            options={caliberOptions}
            onChange={(v) => set('caliberFkId', v)}
            searchable
          />
          {type?.hasPurpose && (
            <Select
              label="Rifle Purpose"
              placeholder="Select Purpose"
              value={form.riflePurposeFkId}
              options={RIFLE_PURPOSES.map((p) => ({ value: p.id, label: p.name }))}
              onChange={(v) => set('riflePurposeFkId', v)}
            />
          )}
          <Checkbox checked={form.licenseRequired} onChange={(v) => set('licenseRequired', v)} label="License Required" />
        </Card>

        <Card>
          <Input
            label="Price (₹) *"
            value={form.price}
            onChangeText={(t) => set('price', t.replace(/[^\d.]/g, ''))}
            placeholder="Price *"
            keyboardType="decimal-pad"
            error={errors.price}
          />
          <Checkbox checked={form.isNegotiable} onChange={(v) => set('isNegotiable', v)} label="Negotiable" />
        </Card>

        <Card>
          <AppText variant="heading" style={{ marginBottom: 12 }}>Product Images</AppText>
          <PhotoTiles
            tiles={uploads.tiles}
            onAdd={async (files) => {
              setDirty(true);
              await uploads.upload(files);
            }}
            onRemove={(k) => {
              setDirty(true);
              uploads.remove(k);
            }}
          />
          {uploads.isUploading && <AppText variant="caption" style={{ marginTop: 8 }}>⏳ Uploading image...</AppText>}
        </Card>

        <Card>
          <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <AppText variant="heading">Location</AppText>
            <Pressable onPress={autofill} disabled={locating} hitSlop={8}>
              <Row gap={4}>
                <MapPin size={14} color={colors.blue600} />
                <Text style={{ color: colors.blue600, fontWeight: '700' }}>{locating ? 'Finding…' : 'Auto-fill from PIN / Address'}</Text>
              </Row>
            </Pressable>
          </Row>
          <Input value={form.location} onChangeText={(t) => set('location', t)} placeholder="Address" />
          <Row>
            <Input value={form.zipCode} onChangeText={(t) => set('zipCode', t.replace(/\D/g, ''))} placeholder="PIN Code" keyboardType="number-pad" maxLength={6} containerStyle={{ flex: 1 }} />
            <Input value={form.city} onChangeText={(t) => set('city', t)} placeholder="City" containerStyle={{ flex: 1 }} />
          </Row>
          <Row>
            <Input value={form.state} onChangeText={(t) => set('state', t)} placeholder="State" containerStyle={{ flex: 1 }} />
            <Input value={form.country} onChangeText={(t) => set('country', t)} placeholder="Country" containerStyle={{ flex: 1 }} />
          </Row>
        </Card>

        <Button
          title={saving ? (isEdit ? 'Updating...' : 'Posting...') : isEdit ? 'Update Ad' : 'Post Ad'}
          loading={saving}
          disabled={uploads.isUploading}
          onPress={() => validate() && setConfirm(true)}
        />
      </ScrollView>

      <ConfirmDialog
        visible={confirm}
        title={isEdit ? 'Update Advertisement?' : 'Post Advertisement?'}
        message={isEdit ? 'Are you sure you want to save changes to this ad?' : 'Are you sure you want to post this ad?'}
        confirmLabel={isEdit ? 'Yes, Update' : 'Yes, Post'}
        loading={saving}
        onConfirm={save}
        onCancel={() => setConfirm(false)}
      />
      <ConfirmDialog
        visible={leave}
        title="Cancel Changes?"
        message="Are you sure you want to leave? All unsaved changes will be lost."
        confirmLabel="Leave"
        cancelLabel="Stay"
        destructive
        onConfirm={() => {
          setLeave(false);
          setDirty(false);
          setTimeout(() => pendingLeave?.(), 0);
        }}
        onCancel={() => setLeave(false)}
      />
    </KeyboardAvoidingView>
  );
}

let pendingLeave: (() => void) | null = null;
