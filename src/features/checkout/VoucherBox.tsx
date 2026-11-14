import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ticket, X } from 'lucide-react-native';
import { voucherUserApi, type VoucherQuote } from '../../api/promo';
import { errorMessage } from '../../api/client';
import { colors, font, radius } from '../../theme';

/**
 * Voucher code entry for the cart. The server prices the voucher against the cart
 * (`/api/vouchers/validate`); when the cart changes, an applied voucher is re-checked
 * and removed with a message if it no longer qualifies.
 */
export function VoucherBox({
  items,
  applied,
  onChange,
  disabled,
}: {
  items: { productId: number; quantity: number }[];
  applied: VoucherQuote | null;
  onChange: (q: VoucherQuote | null) => void;
  disabled?: boolean;
}) {
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-validate when the cart contents change.
  const itemsKey = JSON.stringify(items);
  const lastKey = useRef(itemsKey);
  useEffect(() => {
    if (itemsKey === lastKey.current) return;
    lastKey.current = itemsKey;
    if (!applied || items.length === 0) return;
    let cancelled = false;
    voucherUserApi
      .validate(applied.code, items)
      .then((q) => !cancelled && onChange(q))
      .catch((e) => {
        if (cancelled) return;
        onChange(null);
        setError(`${applied.code} was removed: ${errorMessage(e)}`);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  const apply = async () => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setChecking(true);
    setError(null);
    try {
      onChange(await voucherUserApi.validate(c, items));
      setCode('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setChecking(false);
    }
  };

  if (applied) {
    return (
      <View style={styles.applied}>
        <Ticket size={18} color={colors.green700} />
        <View style={{ flex: 1 }}>
          <Text style={styles.appliedCode}>{applied.code}</Text>
          <Text style={styles.appliedDesc} numberOfLines={2}>{applied.description || 'Voucher applied'}</Text>
        </View>
        <Pressable
          onPress={() => {
            onChange(null);
            setError(null);
          }}
          hitSlop={10}
          accessibilityLabel="Remove voucher"
        >
          <X size={18} color={colors.gray500} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 10 }}>
      <View style={styles.row}>
        <TextInput
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          placeholder="Voucher code"
          placeholderTextColor={colors.gray400}
          maxLength={20}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!disabled && !checking}
          onSubmitEditing={apply}
          returnKeyType="done"
          style={styles.input}
          accessibilityLabel="Voucher code"
        />
        <Pressable
          onPress={apply}
          disabled={disabled || checking || !code}
          style={[styles.apply, (disabled || checking || !code) && { opacity: 0.5 }]}
          accessibilityRole="button"
        >
          {checking ? <ActivityIndicator size="small" color={colors.onAccent} /> : <Text style={styles.applyText}>Apply</Text>}
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 12,
    color: colors.white,
    fontFamily: 'Menlo',
    letterSpacing: 1.5,
    fontSize: font.md,
  },
  apply: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    backgroundColor: colors.gold500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: { color: colors.onAccent, fontWeight: '800' },
  error: { color: colors.red700, fontSize: font.xs, marginTop: 6 },
  applied: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.green600,
    backgroundColor: 'rgba(34,197,94,0.1)',
  },
  appliedCode: { color: colors.white, fontFamily: 'Menlo', fontWeight: '800', letterSpacing: 1 },
  appliedDesc: { color: colors.green700, fontSize: font.xs, marginTop: 2 },
});
