import { useHeaderHeight } from '@react-navigation/elements';
import React, { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supportApi } from '../../api/users';
import { request, errorMessage } from '../../api/client';
import type { SupportTicket } from '../../api/types';
import { useAppSelector } from '../../store';
import { AppText, Badge, Button, Card, EmptyState, ErrorBox, InfoBox, Input, Loader, Row } from '../../components/ui';
import { Select } from '../../components/ui/Sheet';
import { toast } from '../../components/ui/Toast';
import { formatDate } from '../../lib/format';
import { colors, spacing } from '../../theme';

const CATEGORIES = [
  { value: 'technical', label: 'Technical Support', api: 'OTHERS' },
  { value: 'account', label: 'Account Issues', api: 'OTHERS' },
  { value: 'payment', label: 'Payment Problems', api: 'DEPOSIT' },
  { value: 'withdrawal', label: 'Withdrawal Issues', api: 'WITHDRAWAL' },
  { value: 'general', label: 'General Inquiry', api: 'OTHERS' },
  { value: 'other', label: 'Other', api: 'OTHERS' },
];
const PRIORITIES = [
  { value: 'NORMAL', label: 'Normal/Minor impact' },
  { value: 'URGENT', label: 'Urgent' },
  { value: 'HIGH', label: 'High' },
  { value: 'LOW', label: 'Low/Informational' },
];
const CATEGORY_LABEL: Record<string, string> = { DEPOSIT: 'Payment', WITHDRAWAL: 'Withdrawal', CLOSING: 'Closing', OTHERS: 'Other' };
const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  OPEN: { label: 'Open', bg: 'rgba(59,130,246,0.16)', fg: colors.blue700 },
  IN_PROGRESS: { label: 'In Progress', bg: 'rgba(234,179,8,0.16)', fg: '#FACC15' },
  CLOSED: { label: 'Closed', bg: colors.gray100, fg: colors.gray600 },
};

export function SupportScreen() {
  const headerHeight = useHeaderHeight();
  const user = useAppSelector((s) => s.auth.user);
  const isAdmin = useAppSelector((s) => s.auth.isAdmin);
  const qc = useQueryClient();
  // Users see their own tickets; admins see everyone's.
  const scope = isAdmin ? null : user?.nodeId ?? null;
  const key = ['supportTickets', scope];
  const q = useQuery({ queryKey: key, queryFn: () => supportApi.list(scope) });

  const [category, setCategory] = useState<string | null>(null);
  const [priority, setPriority] = useState('NORMAL');
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      supportApi.add({
        category: CATEGORIES.find((c) => c.value === category)!.api,
        priority,
        userNodeId: user!.nodeId!,
        message: message.trim(),
        status: 'OPEN',
      }),
    onSuccess: () => {
      toast.show('Support ticket created! We will respond within 24 hours.');
      setCategory(null);
      setPriority('NORMAL');
      setMessage('');
      qc.invalidateQueries({ queryKey: ['supportTickets'] });
    },
    onError: (e) => setFormError(errorMessage(e)),
  });

  const close = useMutation({
    mutationFn: (t: SupportTicket) =>
      request(`/api/users/updateSupportTicket/${t.supportTicketPkId}`, {
        method: 'PUT',
        body: { ...t, status: 'CLOSED', updatedAtDateTime: new Date().toISOString() },
      }),
    onSuccess: () => {
      toast.show('Ticket closed');
      qc.invalidateQueries({ queryKey: ['supportTickets'] });
    },
    onError: (e) => toast.show(errorMessage(e), 'error'),
  });

  const submit = () => {
    if (!category) return setFormError('Please select a category');
    if (!message.trim()) return setFormError('Please enter your message');
    if (!user?.nodeId) return setFormError('User node ID not found. Please login again.');
    setFormError(null);
    create.mutate();
  };

  const tickets = [...(q.data ?? [])].sort((a, b) => (b.supportTicketPkId ?? 0) - (a.supportTicketPkId ?? 0));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={headerHeight}>
      <ScrollView style={{ backgroundColor: colors.gray100 }} contentContainerStyle={{ padding: spacing.md, gap: spacing.md }} keyboardShouldPersistTaps="handled">
        <View>
          <AppText variant="title">Support Centre</AppText>
          <AppText muted style={{ marginTop: 4 }}>Raise a ticket and our team will get back to you within 24 hours.</AppText>
        </View>

        {!isAdmin && (
          <Card>
            <AppText variant="heading">Raise a Ticket</AppText>
            <AppText muted style={{ marginBottom: 12 }}>Fill in the details below</AppText>
            {formError ? <ErrorBox message={formError} /> : null}
            <Select label="Category" placeholder="Select Category" value={category} options={CATEGORIES} onChange={(v) => setCategory(String(v))} />
            <Select label="Priority" value={priority} options={PRIORITIES} onChange={(v) => setPriority(String(v))} />
            <Input label="Message" value={message} onChangeText={setMessage} placeholder="Describe your issue..." multiline maxLength={2000} />
            <Button title={create.isPending ? 'Submitting...' : 'Submit Ticket'} loading={create.isPending} onPress={submit} />
          </Card>
        )}

        <Card>
          <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <AppText variant="heading">{isAdmin ? 'All Tickets' : 'My Tickets'}</AppText>
            <AppText muted>{tickets.length} total</AppText>
          </Row>
          {q.isLoading ? (
            <Loader label="Loading tickets..." />
          ) : q.error ? (
            <ErrorBox message={errorMessage(q.error)} onRetry={q.refetch} />
          ) : tickets.length === 0 ? (
            <EmptyState emoji="🎫" title="No tickets found." message={isAdmin ? undefined : 'Submit one to get started.'} />
          ) : (
            tickets.map((t) => {
              const s = STATUS[t.status] ?? { label: t.status, bg: colors.gray100, fg: colors.gray600 };
              const updated = t.updatedAtDateTime || (t as any).lastModifiedDateTime || t.createdDatetime;
              return (
                <View key={t.supportTicketPkId ?? t.message} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.gray100 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <AppText style={{ fontWeight: '700' }}>
                      #{t.supportTicketPkId} · {CATEGORY_LABEL[t.category] ?? t.category}
                    </AppText>
                    <Badge label={s.label} bg={s.bg} fg={s.fg} />
                  </Row>
                  <AppText style={{ marginTop: 6, color: colors.gray700 }}>{t.message}</AppText>
                  <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
                    <AppText variant="caption">
                      {t.priority} · {updated ? formatDate(updated) : 'N/A'}
                      {isAdmin ? ` · ${t.userName || t.userNodeId}` : ''}
                    </AppText>
                    {t.status !== 'CLOSED' && (
                      <Button title="Close" size="sm" variant="ghost" loading={close.isPending && close.variables === t} onPress={() => close.mutate(t)} />
                    )}
                  </Row>
                </View>
              );
            })
          )}
        </Card>
        {!isAdmin && <InfoBox text="For order or payment issues, include your order reference (e.g. BW2026…) in the message." />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
