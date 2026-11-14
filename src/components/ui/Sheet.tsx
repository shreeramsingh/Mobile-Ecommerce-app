import React, { useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronDown, X } from 'lucide-react-native';
import { AppText, Button } from './index';
import { colors, font, radius, spacing } from '../../theme';

// ─── Bottom sheet modal ───────────────────────────────────────────────────────
export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
  dismissable = true,
  scroll = true,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** false while a request is in flight so it can't be closed mid-save. */
  dismissable?: boolean;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const close = () => {
    if (dismissable) onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.handle} />
          {title ? (
            <View style={styles.header}>
              <AppText variant="heading" style={{ flex: 1 }}>{title}</AppText>
              {dismissable && (
                <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
                  <X size={22} color={colors.gray500} />
                </Pressable>
              )}
            </View>
          ) : null}
          {scroll ? (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg }}>
              {children}
            </ScrollView>
          ) : (
            <View style={{ flexShrink: 1 }}>{children}</View>
          )}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  loading,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {
      if (!loading) onCancel();
    }}>
      <View style={styles.dialogBackdrop}>
        <View style={styles.dialog}>
          <AppText variant="heading" style={{ textAlign: 'center' }}>{title}</AppText>
          {message ? <AppText muted style={{ textAlign: 'center', marginTop: 8 }}>{message}</AppText> : null}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
            <Button title={cancelLabel} variant="ghost" onPress={onCancel} disabled={loading} style={{ flex: 1 }} />
            <Button
              title={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              onPress={onConfirm}
              loading={loading}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Select (picker in a sheet, with optional search and groups) ──────────────
export interface SelectOption<T extends string | number = string | number> {
  value: T;
  label: string;
  group?: string;
  indent?: boolean;
}

export function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select',
  disabled,
  error,
  searchable,
}: {
  label?: string;
  value: T | null | undefined;
  options: SelectOption<T>[];
  onChange: (v: T) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string | null;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(
    () => (q.trim() ? options.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase())) : options),
    [q, options],
  );

  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? <AppText variant="label" style={{ marginBottom: 6 }}>{label}</AppText> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ?? placeholder}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.selectBtn, disabled && { opacity: 0.5 }, !!error && { borderColor: colors.red500 }]}
      >
        <Text style={[styles.selectText, !selected && { color: colors.gray400 }]} numberOfLines={1}>
          {selected ? selected.label.trim() : placeholder}
        </Text>
        <ChevronDown size={18} color={colors.gray500} />
      </Pressable>
      {error ? <Text style={{ color: colors.red600, fontSize: font.xs, marginTop: 4 }}>{error}</Text> : null}

      <Sheet visible={open} onClose={() => { setOpen(false); setQ(''); }} title={label ?? placeholder} scroll={false}>
        {searchable && (
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search..."
            placeholderTextColor={colors.gray400}
            style={styles.search}
            autoCorrect={false}
          />
        )}
        <FlatList
          data={filtered}
          keyExtractor={(o) => String(o.value)}
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 460 }}
          ListEmptyComponent={<AppText muted style={{ padding: 20, textAlign: 'center' }}>No options</AppText>}
          renderItem={({ item, index }) => {
            const showGroup = item.group && item.group !== filtered[index - 1]?.group;
            const active = item.value === value;
            return (
              <View>
                {showGroup ? <Text style={styles.group}>{item.group}</Text> : null}
                <Pressable
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                    setQ('');
                  }}
                  style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.gray50 }]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      item.indent && { paddingLeft: 16, color: colors.gray600 },
                      active && { color: colors.gold600, fontWeight: '700' },
                    ]}
                  >
                    {item.label.trim()}
                  </Text>
                  {active && <Check size={18} color={colors.gold500} />}
                </Pressable>
              </View>
            );
          }}
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '92%',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.gray300, marginTop: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray200,
  },
  dialogBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    backgroundColor: colors.surfaceAlt,
  },
  selectText: { flex: 1, fontSize: font.md, color: colors.gray900 },
  search: {
    margin: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    minHeight: 44,
    fontSize: font.md,
    color: colors.gray900,
  },
  group: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 4,
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  optionText: { fontSize: font.md, color: colors.gray900, flex: 1 },
});
