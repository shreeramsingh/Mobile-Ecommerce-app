import React, { useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  AlertTriangle, Check, CheckCircle2, Clock, ImageOff, Loader2, PackageCheck,
  ShieldAlert, Smartphone, Truck, XCircle, Copy,
} from 'lucide-react-native';
import type { PaymentMethod, PaymentStatus, ShippingStatus } from '../../api/types';
import { getAuthToken } from '../../api/client';
import { API_BASE_URL } from '../../config/env';
import { Badge } from '../../components/ui';
import { colors, font, radius } from '../../theme';

// ─── Status badges ────────────────────────────────────────────────────────────
const PAYMENT_STATUS: Record<PaymentStatus, { label: string; bg: string; fg: string; icon: typeof Clock }> = {
  PENDING: { label: 'Pending verification', bg: 'rgba(234,179,8,0.16)', fg: '#FACC15', icon: Clock },
  APPROVED: { label: 'Approved', bg: 'rgba(34,197,94,0.16)', fg: colors.green700, icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', bg: 'rgba(239,68,68,0.16)', fg: colors.red700, icon: XCircle },
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const s = PAYMENT_STATUS[status] ?? PAYMENT_STATUS.PENDING;
  return <Badge label={s.label} bg={s.bg} fg={s.fg} icon={s.icon} />;
}

const SHIPPING: Record<ShippingStatus, { admin: string; buyer: string; bg: string; fg: string; icon: typeof Clock }> = {
  NOT_STARTED: { admin: 'Not shipped', buyer: 'Awaiting payment', bg: colors.gray100, fg: colors.gray700, icon: Clock },
  MANUAL_REVIEW: { admin: 'Manual handling', buyer: 'Seller will arrange delivery', bg: 'rgba(249,115,22,0.16)', fg: '#FB923C', icon: ShieldAlert },
  PROCESSING: { admin: 'Creating shipment…', buyer: 'Preparing shipment', bg: 'rgba(59,130,246,0.16)', fg: colors.blue700, icon: Loader2 },
  ORDER_CREATED: { admin: 'Shiprocket order created', buyer: 'Preparing shipment', bg: 'rgba(59,130,246,0.16)', fg: colors.blue700, icon: PackageCheck },
  AWB_ASSIGNED: { admin: 'Courier assigned', buyer: 'Courier assigned', bg: 'rgba(99,102,241,0.2)', fg: '#A5B4FC', icon: Truck },
  PICKUP_SCHEDULED: { admin: 'Pickup scheduled', buyer: 'Ready for pickup', bg: 'rgba(34,197,94,0.16)', fg: colors.green700, icon: CheckCircle2 },
  FAILED: { admin: 'Shiprocket failed', buyer: 'Preparing shipment', bg: 'rgba(239,68,68,0.16)', fg: colors.red700, icon: AlertTriangle },
};

export function ShippingStatusBadge({ status, audience = 'admin' }: { status: ShippingStatus; audience?: 'admin' | 'buyer' }) {
  // Buyers never see "failed" — it reads as "Preparing shipment".
  const key = audience === 'buyer' && status === 'FAILED' ? 'PROCESSING' : status;
  const s = SHIPPING[key] ?? SHIPPING.NOT_STARTED;
  return <Badge label={audience === 'buyer' ? s.buyer : s.admin} bg={s.bg} fg={s.fg} icon={s.icon} />;
}

// ─── Authenticated image (QR codes / receipts need the bearer token) ─────────
export function AuthImage({ path, size = 220, label }: { path: string; size?: number; label?: string }) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const token = getAuthToken();
  const uri = path.startsWith('http') ? path : API_BASE_URL + path;
  return (
    <View style={[styles.authImg, { width: size, height: size }]}>
      {state !== 'error' && (
        <Image
          source={{ uri, headers: token ? { Authorization: `Bearer ${token}` } : undefined }}
          style={{ width: size, height: size }}
          resizeMode="contain"
          onLoad={() => setState('ok')}
          onError={() => setState('error')}
          accessibilityLabel={label}
        />
      )}
      {state === 'loading' && <ActivityIndicator style={StyleSheet.absoluteFill} color={colors.gold500} />}
      {state === 'error' && (
        <View style={{ alignItems: 'center', gap: 6 }}>
          <ImageOff size={28} color={colors.gray400} />
          <Text style={{ color: colors.gray500, fontSize: font.xs }}>Image unavailable</Text>
        </View>
      )}
    </View>
  );
}

// ─── Copy field ───────────────────────────────────────────────────────────────
export function CopyField({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <View style={styles.copyRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.copyLabel}>{label}</Text>
        <Text style={[styles.copyValue, mono && { fontFamily: 'Menlo' }]} selectable>
          {value}
        </Text>
      </View>
      <Pressable
        onPress={() => {
          Clipboard.setString(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        style={styles.copyBtn}
        accessibilityLabel={`Copy ${label}`}
      >
        {copied ? <Check size={14} color={colors.green600} /> : <Copy size={14} color={colors.gray600} />}
        <Text style={{ fontSize: font.xs, fontWeight: '700', color: copied ? colors.green600 : colors.gray600 }}>
          {copied ? 'Copied' : 'Copy'}
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Payment method details ───────────────────────────────────────────────────
export function PaymentMethodDetails({ method, amount }: { method: PaymentMethod; amount?: number }) {
  if (method.type === 'BANK_ACCOUNT') {
    return (
      <View style={styles.details}>
        <CopyField label="Account holder" value={method.accountHolderName} />
        <CopyField label="Bank" value={method.bankName} />
        <CopyField label="Account number" value={method.accountNumber} mono />
        <CopyField label="IFSC code" value={method.ifscCode} mono />
        <CopyField label="Branch" value={method.branchName} />
      </View>
    );
  }

  const upiLink = method.upiId
    ? `upi://pay?pa=${encodeURIComponent(method.upiId)}&pn=${encodeURIComponent(method.displayName)}${
        amount ? `&am=${amount.toFixed(2)}` : ''
      }&cu=INR`
    : null;

  return (
    <View style={[styles.details, { alignItems: 'center' }]}>
      {method.qrImageUrl ? <AuthImage path={method.qrImageUrl} label={`QR code for ${method.displayName}`} /> : null}
      <Text style={{ color: colors.gray500, fontSize: font.xs, marginTop: 8, textAlign: 'center' }}>
        Scan with any UPI app (GPay, PhonePe, Paytm, BHIM)
      </Text>
      <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
        <CopyField label="UPI ID" value={method.upiId} />
      </View>
      {upiLink && (
        <Pressable
          style={styles.upiBtn}
          onPress={() => Linking.openURL(upiLink).catch(() => {})}
          accessibilityRole="button"
        >
          <Smartphone size={18} color={colors.white} />
          <Text style={{ color: colors.white, fontWeight: '700' }}>Pay with UPI app</Text>
        </Pressable>
      )}
      {upiLink && !!amount && (
        <Text style={{ color: colors.gray500, fontSize: font.xs, marginTop: 6 }}>
          Amount ₹{amount.toFixed(2)} will be filled in automatically
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  authImg: {
    // White behind QR codes so they scan reliably.
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  copyLabel: { fontSize: font.xs, color: colors.gray500 },
  copyValue: { fontSize: font.md, fontWeight: '600', color: colors.gray900, marginTop: 2 },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.gray100,
  },
  details: {
    marginTop: 12,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  upiBtn: {
    marginTop: 12,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.green600,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
});
