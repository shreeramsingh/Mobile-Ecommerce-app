import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react-native';
import type { RootScreenProps } from '../../navigation/types';
import { productsApi } from '../../api/products';
import { errorMessage } from '../../api/client';
import { useAppSelector } from '../../store';
import { useAppDispatch } from '../../store';
import { removeRecentlyViewed } from '../../store/slices/recentlyViewedSlice';
import { AppText, Button, Card, ErrorBox, InfoBox, Input, Loader } from '../../components/ui';
import { ConfirmDialog, Select, type SelectOption } from '../../components/ui/Sheet';
import { toast } from '../../components/ui/Toast';
import { PhotoTiles } from '../sell/PhotoTiles';
import { useImageUploads, type UploadTile } from '../sell/imageUpload';
import { SHOOTING_CATEGORIES } from '../../data/shootingCategories';
import { colors, spacing } from '../../theme';

/** Admin form for store products (cart-enabled), using the shop's category tree. */
export function StoreProductFormScreen({ route, navigation }: RootScreenProps<'StoreProductForm'>) {
  const headerHeight = useHeaderHeight();
  const editId = route.params?.product?.id;
  const isEdit = editId != null;
  const user = useAppSelector((s) => s.auth.user);
  const qc = useQueryClient();
  const dispatch = useAppDispatch();
  const removeRecent = (id: number) => dispatch(removeRecentlyViewed(id));

  const rawQ = useQuery({ queryKey: ['rawProduct', editId], queryFn: () => productsApi.rawById(editId!), enabled: isEdit, staleTime: 0 });
  const uploads = useImageUploads(user?.nodeId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(null);
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Edit Store Product' : 'Post Store Product' });
  }, [navigation, isEdit]);

  useEffect(() => {
    const p = rawQ.data;
    if (!p) return;
    setTitle(p.title ?? '');
    setDescription(p.description ?? '');
    setCategoryId(p.categoryId ?? null);
    setSubcategoryId(p.subcategoryId ?? null);
    setPrice(p.price != null ? String(p.price) : '');
    setQuantity(p.productQuantity != null ? String(p.productQuantity) : '1');
    uploads.setTiles(
      (p.productImageList ?? []).map(
        (img): UploadTile => ({ key: img.productImageId, imageId: img.productImageId, previewUri: img.profileImageUrl ?? undefined, status: 'done' }),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawQ.data]);

  const group = SHOOTING_CATEGORIES.find((g) => g.id === categoryId);
  const subOptions: SelectOption<number>[] = useMemo(
    () =>
      (group?.categories ?? []).flatMap((c) => [
        { value: c.id, label: c.name },
        ...(c.subcategories ?? []).map((s) => ({ value: s.id, label: s.name, indent: true })),
      ]),
    [group],
  );

  const validate = () => {
    if (!title.trim() || !price || Number(price) <= 0 || !categoryId) {
      setError('Please fill all required fields: Title, Price and Category.');
      return false;
    }
    if (!/^[1-9]\d*$/.test(quantity)) {
      setError('Product quantity must be a whole number of at least 1.');
      return false;
    }
    if (uploads.isUploading) {
      setError('Some images are still uploading. Please wait.');
      return false;
    }
    setError(null);
    return true;
  };

  const save = async () => {
    setBusy(true);
    const raw = rawQ.data;
    try {
      const body = {
        title: title.trim(),
        description: description.trim(),
        categoryId,
        subcategoryId,
        price: Number(price),
        isNegotiable: false,
        productQuantity: Number(quantity),
        isStoreProduct: true,
        sellerId: user!.nodeId!,
        location: raw?.location ?? '',
        city: raw?.city ?? '',
        state: raw?.state ?? '',
        zipCode: raw?.zipCode ?? '',
        country: raw?.country || 'India',
        status: 'LIVE',
        createdAt: '',
        updatedAt: '',
        latitude: Number(raw?.latitude ?? 0),
        longitude: Number(raw?.longitude ?? 0),
        productImageList: uploads.productImageList(),
      };
      if (isEdit) await productsApi.update(editId!, body);
      else await productsApi.create(body);
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.show(isEdit ? 'Product updated successfully!' : 'Product posted successfully!');
      setConfirm(false);
      navigation.goBack();
    } catch (e) {
      setConfirm(false);
      setError(`Something went wrong: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await productsApi.remove(editId!);
      removeRecent(editId!);
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.show('Product deleted');
      setConfirmDelete(false);
      navigation.goBack();
    } catch (e) {
      setConfirmDelete(false);
      setError(`Failed to delete: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  if (isEdit && rawQ.isLoading) return <Loader style={{ flex: 1 }} />;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={headerHeight}>
      <ScrollView style={{ backgroundColor: colors.gray100 }} contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <InfoBox text="🛒 This product will be listed as a Store Product — buyers can add to cart and checkout." tone="warning" />
        {error ? <ErrorBox message={error} /> : null}
        <Card>
          <Input label="Title *" value={title} onChangeText={setTitle} placeholder="Title *" maxLength={120} />
          <Input label="Description" value={description} onChangeText={setDescription} placeholder="Description" multiline maxLength={4000} />
          <Select
            label="Category *"
            placeholder="Select Category *"
            value={categoryId}
            options={SHOOTING_CATEGORIES.map((g) => ({ value: g.id, label: g.name }))}
            onChange={(v) => {
              setCategoryId(v);
              setSubcategoryId(null);
            }}
          />
          <Select
            label="Subcategory"
            placeholder={!group ? 'Select a category first' : subOptions.length ? 'Select Subcategory' : 'No subcategories available'}
            disabled={!group || subOptions.length === 0}
            value={subcategoryId}
            options={subOptions}
            onChange={setSubcategoryId}
            searchable
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Input label="Price (₹) *" value={price} onChangeText={(t) => setPrice(t.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholder="Price *" containerStyle={{ flex: 1 }} />
            <Input
              label="Product Quantity *"
              value={quantity}
              onChangeText={(t) => setQuantity(t.replace(/\D/g, ''))}
              keyboardType="number-pad"
              placeholder="Number of items available"
              containerStyle={{ flex: 1 }}
            />
          </View>
        </Card>
        <Card>
          <AppText variant="heading" style={{ marginBottom: 12 }}>Product Images</AppText>
          <PhotoTiles tiles={uploads.tiles} onAdd={uploads.upload} onRemove={uploads.remove} />
        </Card>
        <Button
          title={isEdit ? 'Update Product' : 'Post Store Product'}
          loading={busy && confirm}
          disabled={uploads.isUploading || busy}
          onPress={() => validate() && setConfirm(true)}
        />
        {isEdit && (
          <Button title="Delete" icon={Trash2} variant="dangerOutline" onPress={() => setConfirmDelete(true)} disabled={busy} />
        )}
        <Text style={{ textAlign: 'center', color: colors.gray400, fontSize: 11 }}>Store products are shipped via Shiprocket after payment approval.</Text>
      </ScrollView>
      <ConfirmDialog
        visible={confirm}
        title={isEdit ? 'Update Product?' : 'Post Product?'}
        confirmLabel="Yes"
        loading={busy}
        onConfirm={save}
        onCancel={() => setConfirm(false)}
      />
      <ConfirmDialog
        visible={confirmDelete}
        title="Delete Product?"
        message="This action cannot be undone. The product will be permanently removed."
        confirmLabel={busy ? 'Deleting...' : 'Yes, Delete'}
        destructive
        loading={busy}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </KeyboardAvoidingView>
  );
}
