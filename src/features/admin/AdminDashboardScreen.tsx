import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, CheckCircle2, ShieldCheck, Truck, User, UserCheck, Users, UserX, type LucideIcon,
} from 'lucide-react-native';
import { usersApi } from '../../api/users';
import { adminShopOrderApi, paymentAdminApi } from '../../api/payments';
import { errorMessage } from '../../api/client';
import { isAdminUser } from '../../api/types';
import { useAppSelector } from '../../store';
import { ErrorBox } from '../../components/ui';
import { WebsiteVisitorsCard } from './WebsiteVisitorsCard';
import { colors, font, radius, spacing } from '../../theme';

export function AdminDashboardScreen() {
  const navigation = useNavigation();
  const user = useAppSelector((s) => s.auth.user);
  const activeQ = useQuery({ queryKey: ['adminUsers', 'ACTIVE'], queryFn: () => usersApi.list('ACTIVE') });
  const inactiveQ = useQuery({ queryKey: ['adminUsers', 'INACTIVE'], queryFn: () => usersApi.list('INACTIVE') });
  const pendingQ = useQuery({
    queryKey: ['adminPayments', 'PENDING', 0],
    queryFn: () => paymentAdminApi.listPayments({ status: 'PENDING', page: 0, size: 1 }),
  });
  const failedQ = useQuery({
    queryKey: ['adminShipments', 'FAILED', 0],
    queryFn: () => adminShopOrderApi.list({ status: 'PAID', shippingStatus: 'FAILED', page: 0, size: 1 }),
  });

  const active = activeQ.data ?? [];
  const inactive = inactiveQ.data ?? [];
  const all = [...active, ...inactive];
  const total = all.length;
  const admins = all.filter(isAdminUser).length;
  const normal = total - admins;
  const pct = (n: number) => Math.round((n / Math.max(total, 1)) * 100);
  const refreshing = activeQ.isRefetching || inactiveQ.isRefetching;
  const refresh = () => {
    activeQ.refetch();
    inactiveQ.refetch();
    pendingQ.refetch();
    failedQ.refetch();
  };

  const cards: { label: string; value: string | number; sub: string; icon: LucideIcon; color: string; onPress: () => void }[] = [
    { label: 'Pending payments', value: pendingQ.data?.totalElements ?? '…', sub: 'Tap to review', icon: CheckCircle2, color: '#f59e0b', onPress: () => navigation.navigate('AdminTabs', { screen: 'AdminPayments' }) },
    { label: 'Failed shipments', value: failedQ.data?.totalElements ?? '…', sub: 'Fix and retry', icon: Truck, color: colors.red500, onPress: () => navigation.navigate('AdminShipments') },
    { label: 'Total Users', value: total, sub: `Active: ${active.length}`, icon: Users, color: '#eab308', onPress: () => navigation.navigate('AdminUsers') },
    { label: 'Active Users', value: active.length, sub: `Inactive: ${inactive.length}`, icon: UserCheck, color: colors.green500, onPress: () => navigation.navigate('AdminUsers', { status: 'active' }) },
    { label: 'Inactive Users', value: inactive.length, sub: `Total: ${total}`, icon: UserX, color: colors.red500, onPress: () => navigation.navigate('AdminUsers', { status: 'inactive' }) },
    { label: 'Admin Users', value: admins, sub: `Normal: ${normal}`, icon: ShieldCheck, color: '#a78bfa', onPress: () => navigation.navigate('AdminUsers', { role: 'admin' }) },
    { label: 'Normal Users', value: normal, sub: `Admins: ${admins}`, icon: User, color: '#60a5fa', onPress: () => navigation.navigate('AdminUsers', { role: 'normal' }) },
    { label: 'User Listings', value: 'View', sub: 'Moderate posts', icon: Activity, color: '#fb923c', onPress: () => navigation.navigate('AdminListings') },
  ];

  const bars = [
    { label: 'Active Users', value: active.length, color: '#f59e0b' },
    { label: 'Inactive Users', value: inactive.length, color: colors.gray500 },
    { label: 'Admin Users', value: admins, color: '#a78bfa' },
    { label: 'Normal Users', value: normal, color: '#60a5fa' },
  ];

  return (
    <ScrollView
      style={{ backgroundColor: colors.surfaceDeep }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.gold500} />}
    >
      <Text style={styles.h1}>Admin Dashboard</Text>
      <Text style={styles.sub}>Welcome back, {user?.name || 'Admin'} 👋</Text>
      <View style={styles.pills}>
        <View style={[styles.pill, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
          <View style={styles.liveDot} />
          <Text style={{ color: '#86efac', fontSize: 11, fontWeight: '700' }}>Live</Text>
        </View>
        <View style={styles.pill}>
          <Text style={{ color: colors.gray600, fontSize: 11 }}>
            {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>
      </View>
      {activeQ.error ? <ErrorBox message={errorMessage(activeQ.error)} onRetry={refresh} /> : null}

      <View style={styles.grid}>
        {cards.map((c) => (
          <Pressable key={c.label} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={c.onPress}>
            <View style={[styles.cardIcon, { backgroundColor: `${c.color}22` }]}>
              <c.icon size={18} color={c.color} />
            </View>
            <Text style={styles.cardLabel}>{c.label.toUpperCase()}</Text>
            <Text style={styles.cardValue}>{activeQ.isLoading && typeof c.value === 'number' ? '…' : c.value}</Text>
            <Text style={styles.cardSub}>{c.sub}</Text>
          </Pressable>
        ))}
      </View>

      <WebsiteVisitorsCard />

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>User Breakdown</Text>
        {bars.map((b) => (
          <View key={b.label} style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.gray600, fontSize: font.sm }}>{b.label}</Text>
              <Text style={{ color: colors.gray400, fontSize: font.sm }}>
                {b.value} ({pct(b.value)}%)
              </Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct(b.value)}%`, backgroundColor: b.color }]} />
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { color: colors.white, fontSize: font.xxl, fontWeight: '800' },
  sub: { color: colors.gray400, marginTop: 4 },
  pills: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 12 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green500 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    padding: 14,
  },
  cardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { color: colors.gray400, fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginTop: 10 },
  cardValue: { color: colors.white, fontSize: font.xxl, fontWeight: '800', marginTop: 2 },
  cardSub: { color: colors.gray500, fontSize: font.xs, marginTop: 2 },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    padding: 16,
    marginTop: 14,
  },
  panelTitle: { color: colors.white, fontWeight: '700', fontSize: font.md },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, marginTop: 6, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
});
