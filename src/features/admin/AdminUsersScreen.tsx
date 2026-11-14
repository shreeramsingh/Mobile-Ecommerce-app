import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react-native';
import type { RootScreenProps } from '../../navigation/types';
import { usersApi } from '../../api/users';
import { errorMessage } from '../../api/client';
import { isAdminUser, type User } from '../../api/types';
import { AppText, Badge, Button, Card, EmptyState, ErrorBox, Loader, Row } from '../../components/ui';
import { ConfirmDialog } from '../../components/ui/Sheet';
import { toast } from '../../components/ui/Toast';
import { colors, radius, spacing } from '../../theme';

export function AdminUsersScreen({ route, navigation }: RootScreenProps<'AdminUsers'>) {
  const status = route.params?.status;
  const role = route.params?.role;
  const apiStatus = status === 'inactive' ? 'INACTIVE' : 'ACTIVE';
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['adminUsers', apiStatus], queryFn: () => usersApi.list(apiStatus) });
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState<User | null>(null);

  const title =
    status === 'active' ? 'Active Users' : status === 'inactive' ? 'Inactive Users' : role === 'admin' ? 'Admin Users' : role === 'normal' ? 'Normal Users' : 'All Users';
  useEffect(() => navigation.setOptions({ title }), [navigation, title]);

  const users = useMemo(() => {
    let list = q.data ?? [];
    if (role === 'admin') list = list.filter(isAdminUser);
    if (role === 'normal') list = list.filter((u) => !isAdminUser(u));
    const s = search.trim().toLowerCase();
    if (s) list = list.filter((u) => [u.name, u.email, u.nodeId].some((x) => x?.toLowerCase().includes(s)));
    return list;
  }, [q.data, role, search]);

  const toggle = useMutation({
    mutationFn: (u: User) => usersApi.updateStatus(u.userPkId!, u.activeStateCodeFkId === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'),
    onSuccess: (_, u) => {
      toast.show(u.activeStateCodeFkId === 'ACTIVE' ? `${u.name} deactivated` : `${u.name} activated`);
      qc.invalidateQueries({ queryKey: ['adminUsers'] });
      setConfirm(null);
    },
    onError: (e) => {
      toast.show(errorMessage(e), 'error');
      setConfirm(null);
    },
  });

  if (q.isLoading) return <Loader style={{ flex: 1 }} label="Loading users..." />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.gray100 }}>
      <FlatList
        data={users}
        keyExtractor={(u) => String(u.userPkId ?? u.nodeId)}
        contentContainerStyle={{ padding: spacing.md, gap: 8 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.gold500} />}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 4 }}>
            {q.error ? <ErrorBox message={errorMessage(q.error)} onRetry={q.refetch} /> : null}
            <Row style={styles.search}>
              <Search size={16} color={colors.gray400} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search by name, email, node ID..."
                placeholderTextColor={colors.gray400}
                style={{ flex: 1, height: 42, color: colors.gray900 }}
                autoCapitalize="none"
              />
            </Row>
            <AppText muted>{users.length} users</AppText>
          </View>
        }
        ListEmptyComponent={<EmptyState emoji="👥" title="No users found." />}
        renderItem={({ item: u }) => {
          const active = u.activeStateCodeFkId === 'ACTIVE';
          return (
            <Card style={{ padding: 14 }}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontWeight: '700' }}>{u.name}</AppText>
                  <AppText variant="caption">{u.email}</AppText>
                  <AppText variant="caption">
                    #{u.userPkId} · {u.nodeId}
                    {isAdminUser(u) ? ' · Admin' : ''}
                  </AppText>
                </View>
                <Badge label={active ? 'Active' : 'Inactive'} bg={active ? 'rgba(34,197,94,0.16)' : 'rgba(239,68,68,0.16)'} fg={active ? colors.green700 : colors.red700} />
              </Row>
              <Button
                title={active ? 'Deactivate' : 'Activate'}
                size="sm"
                variant={active ? 'dangerOutline' : 'success'}
                style={{ marginTop: 10, alignSelf: 'flex-start' }}
                onPress={() => setConfirm(u)}
              />
            </Card>
          );
        }}
      />
      <ConfirmDialog
        visible={!!confirm}
        title={confirm?.activeStateCodeFkId === 'ACTIVE' ? 'Deactivate user?' : 'Activate user?'}
        message={confirm ? `${confirm.name} (${confirm.email})` : undefined}
        confirmLabel={confirm?.activeStateCodeFkId === 'ACTIVE' ? 'Deactivate' : 'Activate'}
        destructive={confirm?.activeStateCodeFkId === 'ACTIVE'}
        loading={toggle.isPending}
        onConfirm={() => confirm && toggle.mutate(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingHorizontal: 12,
  },
});
