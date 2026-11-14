import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BadgeIndianRupee, Headset, Percent, Ticket, Landmark, ListChecks, LogOut, ShieldCheck, ShoppingBag, Truck, User, UserCheck, Users, UserX,
} from 'lucide-react-native';
import { useAppDispatch, useAppSelector } from '../../store';
import { signOut as signOutThunk } from '../../store/slices/authSlice';
import { MenuRow } from '../account/AccountScreen';
import { ConfirmDialog } from '../../components/ui/Sheet';
import { colors, font, radius, spacing } from '../../theme';

/** Admin menu — same groups as the website's admin header. */
export function AdminMoreScreen() {
  const insets = useSafeAreaInsets();
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const signOut = () => dispatch(signOutThunk(undefined));
  const [confirm, setConfirm] = useState(false);

  return (
    <ScrollView style={{ backgroundColor: colors.gray100 }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email} · Admin</Text>
      </View>
      <Group title="Users">
        <MenuRow item={{ label: 'All Users', icon: Users, route: 'AdminUsers' }} />
        <MenuRow item={{ label: 'Active Users', icon: UserCheck, route: 'AdminUsers', params: { status: 'active' } }} />
        <MenuRow item={{ label: 'Inactive Users', icon: UserX, route: 'AdminUsers', params: { status: 'inactive' } }} />
        <MenuRow item={{ label: 'Admin Users', icon: ShieldCheck, route: 'AdminUsers', params: { role: 'admin' } }} />
      </Group>
      <Group title="Manage">
        <MenuRow item={{ label: 'Subscription', icon: BadgeIndianRupee, route: 'AdminSubscription' }} />
        <MenuRow item={{ label: 'User Listings', icon: ListChecks, route: 'AdminListings' }} />
        <MenuRow item={{ label: 'Browse marketplace', icon: ShoppingBag, route: 'Marketplace' }} />
      </Group>
      <Group title="Payments">
        <MenuRow item={{ label: 'Payment Methods', icon: Landmark, route: 'AdminPaymentMethods' }} />
        <MenuRow item={{ label: 'Shipments', icon: Truck, route: 'AdminShipments' }} />
      </Group>
      <Group title="Promotions">
        <MenuRow item={{ label: 'Discounts', icon: Percent, route: 'AdminDiscounts' }} />
        <MenuRow item={{ label: 'Vouchers', icon: Ticket, route: 'AdminVouchers' }} />
      </Group>
      <Group title="Account">
        <MenuRow item={{ label: 'Edit profile', icon: User, route: 'Profile' }} />
        <MenuRow item={{ label: 'Support tickets', icon: Headset, route: 'Support' }} />
        <Pressable style={styles.signOut} onPress={() => setConfirm(true)}>
          <LogOut size={20} color={colors.red600} />
          <Text style={{ color: colors.red600, fontWeight: '600', fontSize: font.md }}>Sign out</Text>
        </Pressable>
      </Group>
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

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.group}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.navy,
    borderBottomWidth: 2,
    borderBottomColor: colors.headerAccent,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  name: { color: colors.white, fontSize: font.lg, fontWeight: '800' },
  email: { color: colors.gray400, marginTop: 2 },
  groupTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: 6,
  },
  group: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    overflow: 'hidden',
  },
  signOut: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: spacing.lg, paddingVertical: 16 },
});
