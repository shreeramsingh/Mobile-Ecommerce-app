import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, Input } from '../../../components/ui';
import type { PromoStatus } from '../../../api/promo';
import { colors, font, radius } from '../../../theme';

// Shared pieces for the admin Discounts and Vouchers screens.

const STATUS: Record<PromoStatus, { label: string; bg: string; fg: string }> = {
  ACTIVE: { label: 'Live', bg: 'rgba(34,197,94,0.16)', fg: colors.green700 },
  SCHEDULED: { label: 'Scheduled', bg: 'rgba(59,130,246,0.16)', fg: colors.blue700 },
  EXPIRED: { label: 'Expired', bg: colors.surfaceAlt, fg: colors.gray500 },
  USED_UP: { label: 'Used up', bg: 'rgba(249,115,22,0.16)', fg: '#FB923C' },
  INACTIVE: { label: 'Paused', bg: colors.surfaceAlt, fg: colors.gray500 },
};

export function PromoStatusBadge({ status }: { status: PromoStatus }) {
  const s = STATUS[status];
  return <Badge label={s.label} bg={s.bg} fg={s.fg} />;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.seg}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segItem, active && styles.segActive]}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segText, active && { color: colors.onAccent }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Date-time as local "YYYY-MM-DD HH:mm" text (no native picker dependency) ──
const pad = (n: number) => String(n).padStart(2, '0');

export const toLocalInput = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Local "YYYY-MM-DD HH:mm" → ISO instant; null when empty; undefined when invalid. */
export const fromLocalInput = (v: string): string | null | undefined => {
  const t = v.trim();
  if (!t) return null;
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

export function DateTimeInput({
  label,
  value,
  onChange,
  error,
  optional,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  optional?: boolean;
}) {
  return (
    <Input
      label={label}
      value={value}
      onChangeText={onChange}
      placeholder="YYYY-MM-DD HH:mm"
      keyboardType="numbers-and-punctuation"
      autoCorrect={false}
      maxLength={16}
      error={error}
      right={
        <View style={{ flexDirection: 'row', gap: 4, paddingRight: 8 }}>
          <Chip label="Now" onPress={() => onChange(toLocalInput(new Date().toISOString()))} />
          {optional && value ? <Chip label="Clear" onPress={() => onChange('')} /> : null}
        </View>
      }
    />
  );
}

function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.chip} hitSlop={4}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.gray600 }}>{label}</Text>
    </Pressable>
  );
}

export const MONEY_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;
export const WHOLE_PATTERN = /^[1-9]\d{0,6}$/;

const styles = StyleSheet.create({
  seg: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 3,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.sm + 2 },
  segActive: { backgroundColor: colors.gold500 },
  segText: { color: colors.gray600, fontWeight: '700', fontSize: font.sm },
  chip: { backgroundColor: colors.surface, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
});
