import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { shopOrderApi } from '../../api/payments';
import type { ShippingAddressInput, ShopOrder } from '../../api/types';
import { ApiError, errorMessage } from '../../api/client';
import { Sheet, Select } from '../../components/ui/Sheet';
import { AppText, Button, ErrorBox, Input, Row } from '../../components/ui';
import { useAppSelector } from '../../store';
import { readJson, writeJson } from '../../lib/storage';
import { formatInr } from '../../lib/format';
import { EMAIL_PATTERN, PHONE_PATTERN, PINCODE_PATTERN } from '../../lib/validation';
import { INDIAN_STATES } from '../../data/indianStates';
import { colors } from '../../theme';

const LAST_ADDRESS_KEY = 'checkout.lastShippingAddress';
type Errors = Partial<Record<keyof ShippingAddressInput, string>>;

const EMPTY: ShippingAddressInput = {
  fullName: '', phone: '', email: '', addressLine1: '', addressLine2: '', city: '', state: '', pincode: '',
};

function validate(a: ShippingAddressInput): Errors {
  const e: Errors = {};
  if (!a.fullName.trim()) e.fullName = "Enter the recipient's name.";
  if (!PHONE_PATTERN.test(a.phone.trim())) e.phone = 'Enter a valid 10-digit mobile number.';
  if (a.email?.trim() && !EMAIL_PATTERN.test(a.email.trim())) e.email = 'Enter a valid email.';
  if (a.addressLine1.trim().length < 5) e.addressLine1 = 'Enter house / flat number and street.';
  if (!a.city.trim()) e.city = 'Enter the city.';
  if (!a.state) e.state = 'Choose the state.';
  if (!PINCODE_PATTERN.test(a.pincode.trim())) e.pincode = 'Enter a valid 6-digit PIN code.';
  return e;
}

export function AddressSheet({
  visible,
  onClose,
  items,
  cartTotal,
  voucherCode,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  items: { productId: number; quantity: number }[];
  cartTotal: number;
  voucherCode?: string | null;
  onCreated: (order: ShopOrder) => void;
}) {
  const user = useAppSelector((s) => s.auth.user);
  const [address, setAddress] = useState<ShippingAddressInput>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const saved = readJson<ShippingAddressInput | null>(LAST_ADDRESS_KEY, null);
    setAddress(
      saved
        ? { ...EMPTY, ...saved }
        : { ...EMPTY, fullName: user?.name ?? '', email: user?.email ?? '', phone: user?.mobile ?? '' },
    );
    setErrors({});
    setFormError(null);
  }, [visible, user]);

  const set = (k: keyof ShippingAddressInput) => (v: string) => setAddress((a) => ({ ...a, [k]: v }));

  const submit = async () => {
    const e = validate(address);
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    setFormError(null);
    const trimmed = Object.fromEntries(
      Object.entries(address).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]),
    ) as unknown as ShippingAddressInput;
    try {
      const order = await shopOrderApi.create(items, trimmed, voucherCode);
      writeJson(LAST_ADDRESS_KEY, trimmed);
      onCreated(order);
    } catch (err) {
      if (err instanceof ApiError) {
        const fe: Errors = {};
        Object.entries(err.fieldErrors).forEach(([k, msg]) => {
          fe[k.replace(/^shipping\./, '') as keyof ShippingAddressInput] = msg;
        });
        setErrors(fe);
      }
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Delivery address"
      dismissable={!saving}
      footer={
        <>
          <Button title="Cancel" variant="ghost" onPress={onClose} disabled={saving} style={{ flex: 1 }} />
          <Button
            title={saving ? 'Saving…' : 'Continue to payment'}
            loading={saving}
            onPress={submit}
            style={{ flex: 2 }}
          />
        </>
      }
    >
      <Row style={{ marginBottom: 14, alignItems: 'flex-start' }}>
        <MapPin size={18} color={colors.gold500} />
        <AppText muted style={{ flex: 1 }}>
          We'll ship your order here once your payment is verified. Total {formatInr(cartTotal)}.
        </AppText>
      </Row>
      {formError ? <ErrorBox message={formError} /> : null}
      <Input label="Full name" value={address.fullName} onChangeText={set('fullName')} maxLength={100} error={errors.fullName} autoComplete="name" />
      <Input
        label="Mobile number"
        value={address.phone}
        onChangeText={set('phone')}
        maxLength={14}
        keyboardType="phone-pad"
        placeholder="98765 43210"
        error={errors.phone}
        autoComplete="tel"
      />
      <Input
        label="Email (optional)"
        value={address.email}
        onChangeText={set('email')}
        maxLength={150}
        keyboardType="email-address"
        autoCapitalize="none"
        error={errors.email}
      />
      <Input label="House / flat, street" value={address.addressLine1} onChangeText={set('addressLine1')} maxLength={200} error={errors.addressLine1} />
      <Input label="Area, landmark (optional)" value={address.addressLine2} onChangeText={set('addressLine2')} maxLength={200} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Input label="City" value={address.city} onChangeText={set('city')} maxLength={80} error={errors.city} containerStyle={{ flex: 1 }} />
        <Input
          label="PIN code"
          value={address.pincode}
          onChangeText={(t) => set('pincode')(t.replace(/\D/g, ''))}
          maxLength={6}
          keyboardType="number-pad"
          error={errors.pincode}
          containerStyle={{ flex: 1 }}
        />
      </View>
      <Select
        label="State"
        value={address.state || null}
        placeholder="Choose state"
        options={INDIAN_STATES.map((s) => ({ value: s, label: s }))}
        onChange={(v) => set('state')(String(v))}
        error={errors.state}
        searchable
      />
    </Sheet>
  );
}
