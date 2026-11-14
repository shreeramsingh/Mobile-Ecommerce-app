import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, font, radius, spacing, theme } from '../../theme';

// ─── Text ─────────────────────────────────────────────────────────────────────
type TextVariant = 'title' | 'heading' | 'subheading' | 'body' | 'caption' | 'label';
export function AppText({
  variant = 'body',
  style,
  muted,
  ...rest
}: React.ComponentProps<typeof Text> & { variant?: TextVariant; muted?: boolean }) {
  return <Text {...rest} style={[textStyles[variant], muted && { color: theme.textMuted }, style]} />;
}

const textStyles = StyleSheet.create({
  title: { fontSize: font.xxl, fontWeight: '700', color: theme.text },
  heading: { fontSize: font.lg, fontWeight: '700', color: theme.text },
  subheading: { fontSize: font.md, fontWeight: '600', color: theme.text },
  body: { fontSize: font.md, color: theme.text },
  caption: { fontSize: font.xs, color: theme.textMuted },
  label: { fontSize: font.sm, fontWeight: '600', color: colors.gray700 },
});

// ─── Button ───────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'dangerOutline' | 'blue' | 'success';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon: Icon,
  style,
  size = 'md',
  ...rest
}: Omit<PressableProps, 'style'> & {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: LucideIcon;
  style?: StyleProp<ViewStyle>;
  size?: 'sm' | 'md';
}) {
  const v = buttonVariants[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        size === 'sm' && styles.btnSm,
        { backgroundColor: v.bg, borderColor: v.border },
        pressed && { opacity: 0.85 },
        isDisabled && { opacity: 0.5 },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} size="small" />
      ) : (
        Icon && <Icon size={size === 'sm' ? 15 : 18} color={v.fg} />
      )}
      <Text style={[styles.btnText, size === 'sm' && { fontSize: font.sm }, { color: v.fg }]}>{title}</Text>
    </Pressable>
  );
}

const buttonVariants: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.gold500, fg: colors.onAccent, border: colors.gold500 },
  secondary: { bg: colors.surfaceAlt, fg: colors.white, border: colors.gray300 },
  outline: { bg: 'transparent', fg: colors.gold600, border: colors.gold500 },
  ghost: { bg: colors.surfaceAlt, fg: colors.gray700, border: colors.gray200 },
  danger: { bg: colors.red600, fg: colors.white, border: colors.red600 },
  dangerOutline: { bg: 'transparent', fg: colors.red600, border: colors.red500 },
  blue: { bg: colors.blue600, fg: colors.white, border: colors.blue600 },
  success: { bg: colors.green600, fg: colors.white, border: colors.green600 },
};

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ style, children }: { style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// ─── Input ────────────────────────────────────────────────────────────────────
export const Input = React.forwardRef<
  React.ComponentRef<typeof TextInput>,
  TextInputProps & { label?: string; error?: string | null; hint?: string; containerStyle?: StyleProp<ViewStyle>; right?: React.ReactNode }
>(function Input({ label, error, hint, containerStyle, style, right, multiline, ...rest }, ref) {
  return (
    <View style={[{ marginBottom: spacing.md }, containerStyle]}>
      {label ? <AppText variant="label" style={{ marginBottom: 6 }}>{label}</AppText> : null}
      <View style={[styles.inputWrap, !!error && { borderColor: colors.red500 }, multiline && { alignItems: 'flex-start' }]}>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.gray400}
          multiline={multiline}
          style={[styles.input, multiline && { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 }, style]}
          {...rest}
        />
        {right}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
});

// ─── Checkbox ─────────────────────────────────────────────────────────────────
export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      onPress={() => !disabled && onChange(!checked)}
      style={styles.checkRow}
    >
      <View style={[styles.checkBox, checked && { backgroundColor: colors.gold500, borderColor: colors.gold500 }]}>
        {checked && <Text style={{ color: colors.onAccent, fontWeight: '800', fontSize: 13 }}>✓</Text>}
      </View>
      {typeof label === 'string' ? <AppText style={{ flex: 1 }}>{label}</AppText> : <View style={{ flex: 1 }}>{label}</View>}
    </Pressable>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
export function Badge({
  label,
  bg,
  fg,
  icon: Icon,
  style,
}: {
  label: string;
  bg: string;
  fg: string;
  icon?: LucideIcon;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      {Icon && <Icon size={12} color={fg} />}
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

// ─── States ───────────────────────────────────────────────────────────────────
export function Loader({ label, style }: { label?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.center, style]}>
      <ActivityIndicator size="large" color={colors.gold500} />
      {label ? <AppText muted style={{ marginTop: 10 }}>{label}</AppText> : null}
    </View>
  );
}

export function EmptyState({
  icon: Icon,
  emoji,
  title,
  message,
  action,
}: {
  icon?: LucideIcon;
  emoji?: string;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={[styles.center, { paddingVertical: 48, paddingHorizontal: 24 }]}>
      {emoji ? <Text style={{ fontSize: 40, marginBottom: 8 }}>{emoji}</Text> : null}
      {Icon ? (
        <View style={styles.emptyIcon}>
          <Icon size={30} color={colors.gray400} />
        </View>
      ) : null}
      <AppText variant="subheading" style={{ textAlign: 'center' }}>{title}</AppText>
      {message ? <AppText muted style={{ textAlign: 'center', marginTop: 6 }}>{message}</AppText> : null}
      {action ? <View style={{ marginTop: 16, alignSelf: 'stretch', alignItems: 'center' }}>{action}</View> : null}
    </View>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.errorBox}>
      <Text style={{ color: colors.red700, fontSize: font.sm }}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={{ marginTop: 8 }}>
          <Text style={{ color: colors.red700, fontWeight: '700' }}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function InfoBox({ text, tone = 'info', style }: { text: string; tone?: 'info' | 'warning' | 'success'; style?: StyleProp<ViewStyle> }) {
  const t = {
    info: { bg: colors.blue50, fg: colors.blue700 },
    warning: { bg: colors.amber50, fg: colors.amber700 },
    success: { bg: colors.green50, fg: colors.green700 },
  }[tone];
  return (
    <View style={[styles.infoBox, { backgroundColor: t.bg }, style]}>
      <Text style={{ color: t.fg, fontSize: font.sm }}>{text}</Text>
    </View>
  );
}

export function Row({ children, style, gap = 8 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function KeyValue({ label, value, valueStyle }: { label: string; value?: React.ReactNode; valueStyle?: StyleProp<TextStyle> }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <View style={styles.kv}>
      <AppText muted style={{ flexShrink: 0 }}>{label}</AppText>
      {typeof value === 'string' || typeof value === 'number' ? (
        <AppText style={[{ fontWeight: '600', textAlign: 'right', flex: 1 }, valueStyle]}>{value}</AppText>
      ) : (
        value
      )}
    </View>
  );
}

export function SectionTitle({ children, icon: Icon, style }: { children: React.ReactNode; icon?: LucideIcon; style?: StyleProp<ViewStyle> }) {
  return (
    <Row style={[{ marginBottom: spacing.md }, style]}>
      {Icon && <Icon size={18} color={colors.gold500} />}
      <AppText variant="heading">{children}</AppText>
    </Row>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  btnSm: { minHeight: 36, paddingHorizontal: spacing.md },
  btnText: { fontSize: font.md, fontWeight: '700' },
  card: {
    backgroundColor: theme.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.border,
    padding: spacing.lg,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  input: { flex: 1, minHeight: 48, paddingHorizontal: 14, fontSize: font.md, color: theme.text },
  errorText: { color: colors.red600, fontSize: font.xs, marginTop: 4 },
  hintText: { color: colors.gray500, fontSize: font.xs, marginTop: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.gray400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: font.xs, fontWeight: '700' },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  errorBox: { backgroundColor: colors.red50, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  infoBox: { borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  kv: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
});
