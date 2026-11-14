import React, { useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react-native';
import { subscriptionApi } from '../../api/users';
import { errorMessage } from '../../api/client';
import type { SubscriptionDefinition } from '../../api/types';
import { AppText, Button, Card, EmptyState, ErrorBox, Input, Loader, Row } from '../../components/ui';
import { ConfirmDialog, Select, Sheet } from '../../components/ui/Sheet';
import { toast } from '../../components/ui/Toast';
import { formatDate, formatInr } from '../../lib/format';
import { colors, spacing } from '../../theme';

const NAMES = ['PREMIUM_MEMBERSHIP_CHARGE', 'REGISTRATION_CHARGE'];
const EMOJI: Record<string, string> = { PREMIUM_MEMBERSHIP_CHARGE: '💎', REGISTRATION_CHARGE: '📝' };

export function AdminSubscriptionScreen() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['subscriptions'], queryFn: subscriptionApi.list });
  const [editing, setEditing] = useState<SubscriptionDefinition | 'new' | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SubscriptionDefinition | null>(null);

  const open = (s: SubscriptionDefinition | 'new') => {
    setEditing(s);
    setName(s === 'new' ? null : s.subscriptionName);
    setAmount(s === 'new' ? '' : String(s.subscriptionAmount));
    setFormError(null);
  };

  const save = useMutation({
    mutationFn: () =>
      editing === 'new'
        ? subscriptionApi.add(name!, Number(amount))
        : subscriptionApi.update(editing!.subscriptionDefinitionPkId, name!, Number(amount)),
    onSuccess: () => {
      toast.show(editing === 'new' ? 'Subscription added' : 'Subscription updated');
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
    },
    onError: (e) => setFormError(errorMessage(e) || 'Failed to save subscription'),
  });

  const remove = useMutation({
    mutationFn: (s: SubscriptionDefinition) => subscriptionApi.remove(s.subscriptionDefinitionPkId),
    onSuccess: () => {
      toast.show('Subscription deleted');
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
    },
    onError: () => {
      setDeleting(null);
      toast.show('Failed to delete subscription type. Please try again.', 'error');
    },
  });

  const submit = () => {
    if (!name) return setFormError('Subscription Name is required');
    if (amount === '') return setFormError('Subscription Amount is required');
    if (Number.isNaN(Number(amount)) || Number(amount) < 0) return setFormError('Subscription Amount must be a valid number');
    setFormError(null);
    save.mutate();
  };

  if (q.isLoading) return <Loader style={{ flex: 1 }} label="Loading subscription types..." />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.gray100 }}>
      <FlatList
        data={q.data ?? []}
        keyExtractor={(s) => String(s.subscriptionDefinitionPkId)}
        contentContainerStyle={{ padding: spacing.md, gap: 8 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.gold500} />}
        ListHeaderComponent={
          <View style={{ marginBottom: 6 }}>
            {q.error ? <ErrorBox message={errorMessage(q.error)} onRetry={q.refetch} /> : null}
            <Button title="Add Subscription" icon={Plus} onPress={() => open('new')} />
          </View>
        }
        ListEmptyComponent={<EmptyState emoji="💰" title="No Subscription types found" />}
        renderItem={({ item: s }) => (
          <Card style={{ padding: 14 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <AppText style={{ fontWeight: '700' }}>
                  {EMOJI[s.subscriptionName] ?? '💰'} {s.subscriptionName}
                </AppText>
                <AppText variant="caption">Created {formatDate(s.createdDatetime)}</AppText>
              </View>
              <AppText variant="heading">{formatInr(s.subscriptionAmount)}</AppText>
            </Row>
            <Row style={{ marginTop: 10 }}>
              <Button title="Edit" icon={Pencil} size="sm" variant="ghost" onPress={() => open(s)} />
              <Button title="Delete" icon={Trash2} size="sm" variant="dangerOutline" onPress={() => setDeleting(s)} />
            </Row>
          </Card>
        )}
      />
      <Sheet
        visible={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add New Subscription Type' : 'Edit Subscription Type'}
        dismissable={!save.isPending}
        footer={
          <>
            <Button title="Cancel" variant="ghost" onPress={() => setEditing(null)} disabled={save.isPending} style={{ flex: 1 }} />
            <Button title={save.isPending ? 'Saving...' : 'Save'} loading={save.isPending} onPress={submit} style={{ flex: 1 }} />
          </>
        }
      >
        {formError ? <ErrorBox message={formError} /> : null}
        <Select
          label="Subscription Name *"
          placeholder="Select Subscription Name"
          value={name}
          options={NAMES.map((n) => ({ value: n, label: n }))}
          onChange={(v) => setName(String(v))}
        />
        <Input label="Subscription Amount (₹) *" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Subscription Amount" />
      </Sheet>
      <ConfirmDialog
        visible={!!deleting}
        title="Delete Subscription Type"
        message={`Are you sure you want to delete the subscription type ${deleting?.subscriptionName}?`}
        confirmLabel={remove.isPending ? 'Deleting...' : 'Delete'}
        destructive
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onCancel={() => setDeleting(null)}
      />
    </View>
  );
}
