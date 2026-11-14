import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronRight, Headset, LogOut, Package, ReceiptText, Store, Truck, User, Heart, ShoppingCart,
  type LucideIcon,
} from 'lucide-react-native';
import { useAppDispatch, useAppSelector } from '../../store';
import { signOut as signOutThunk } from '../../store/slices/authSlice';
import { Button } from '../../components/ui';
import { ConfirmDialog } from '../../components/ui/Sheet';
import { initials } from '../../lib/format';
import { colors, font, radius, spacing } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type MenuItem = { label: string; icon: LucideIcon; route: keyof RootStackParamList; params?: object };

export const USER_MENU: MenuItem[] = [
  { label: 'Edit profile', icon: User, route: 'Profile' },
  { label: 'My Orders', icon: Package, route: 'Orders' },
  { label: 'My Payments', icon: ReceiptText, route: 'Payments' },
  { label: 'Cart', icon: ShoppingCart, route: 'Cart' },
  { label: 'Track order', icon: Truck, route: 'Track' },
  { label: 'Store', icon: Store, route: 'Store' },
  { label: 'Support', icon: Headset, route: 'Support' },
];

export function AccountScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const signOut = () => dispatch(signOutThunk(undefined));
  const [confirm, setConfirm] = React.useState(false);

  if (!user) {
    return (
      <View style={[styles.guest, { paddingTop: insets.top + 40 }]}>
        <View style={styles.guestIcon}>
          <User size={36} color={colors.gold500} />
        </View>
        <Text style={styles.guestTitle}>Welcome to Bandookwale</Text>
        <Text style={styles.guestText}>Sign in to buy, sell, chat with sellers and track your orders.</Text>
        <Button title="Sign In" onPress={() => navigation.navigate('SignIn')} style={{ alignSelf: 'stretch', marginTop: 24 }} />
        <Button title="Create account" variant="outline" onPress={() => navigation.navigate('SignUp')} style={{ alignSelf: 'stretch', marginTop: 10 }} />
        <View style={{ alignSelf: 'stretch', marginTop: 24 }}>
          <MenuRow item={{ label: 'Track order', icon: Truck, route: 'Track' }} />
          <MenuRow item={{ label: 'Wishlist', icon: Heart, route: 'UserTabs', params: { screen: 'Wishlist' } }} />
        </View>
      </View>
    );
  }

  const image = user.profileImageUrl || user.imageUrl;
  return (
    <ScrollView style={{ backgroundColor: colors.gray100 }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        {image ? (
          <Image source={{ uri: image }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={{ color: colors.white, fontWeight: '800', fontSize: font.xl }}>{initials(user.name)}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{user.name || user.username || 'User'}</Text>
          <Text style={styles.email} numberOfLines={1}>{user.email}</Text>
        </View>
      </View>
      <View style={styles.menu}>
        {USER_MENU.map((m) => (
          <MenuRow key={m.label} item={m} />
        ))}
      </View>
      <View style={styles.menu}>
        <Pressable style={styles.row} onPress={() => setConfirm(true)}>
          <LogOut size={20} color={colors.red600} />
          <Text style={[styles.rowText, { color: colors.red600 }]}>Sign out</Text>
        </Pressable>
      </View>
      <ConfirmDialog
        visible={confirm}
        title="Sign out?"
        confirmLabel="Sign out"
        destructive
        onConfirm={() => {
          setConfirm(false);
          signOut();
        }}
        onCancel={() => setConfirm(false)}
      />
    </ScrollView>
  );
}

export function MenuRow({ item }: { item: MenuItem }) {
  const navigation = useNavigation<any>();
  const Icon = item.icon;
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.gray50 }]}
      onPress={() => navigation.navigate(item.route, item.params)}
      accessibilityRole="button"
    >
      <Icon size={20} color={colors.gray600} />
      <Text style={styles.rowText}>{item.label}</Text>
      <ChevronRight size={18} color={colors.gray600} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.navy,
    borderBottomWidth: 2,
    borderBottomColor: colors.headerAccent,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  avatarFallback: { backgroundColor: colors.gold500, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.white, fontSize: font.lg, fontWeight: '800' },
  email: { color: colors.gray400, fontSize: font.sm, marginTop: 2 },
  menu: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
    backgroundColor: colors.surface,
  },
  rowText: { flex: 1, fontSize: font.md, fontWeight: '600', color: colors.gray800 },
  guest: { flex: 1, alignItems: 'center', backgroundColor: colors.gray100, paddingHorizontal: spacing.xxl },
  guestIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(245,179,1,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestTitle: { fontSize: font.xl, fontWeight: '800', color: colors.gray900, marginTop: 16 },
  guestText: { fontSize: font.md, color: colors.gray500, textAlign: 'center', marginTop: 8 },
});
