import React, { useState } from 'react';
import { FlatList, Image, RefreshControl, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, QrCode } from 'lucide-react-native';
import { paymentAdminApi, type BankAccountInput } from '../../api/payments';
import type { PaymentMethod } from '../../api/types';
import { ApiError, errorMessage } from '../../api/client';
import { AppText, Badge, Button, Card, EmptyState, ErrorBox, Input, KeyValue, Loader, Row } from '../../components/ui';
import { Sheet } from '../../components/ui/Sheet';
import { toast } from '../../components/ui/Toast';
import { AuthImage } from '../payments/components';
import { pickImages } from '../../lib/filePicker';
import { ACCOUNT_NUMBER_PATTERN, IFSC_PATTERN, QR_TYPES, UPI_ID_PATTERN, checkFile, type PickedFile } from '../../lib/validation';
import { colors, spacing } from '../../theme';

const KEY = ['paymentMethods', 'admin'];

export function AdminPaymentMethodsScreen() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: KEY, queryFn: paymentAdminApi.listMethods });
  const [bankEditor, setBankEditor] = useState<PaymentMethod | 'new' | null>(null);
  const [qrEditor, setQrEditor] = useState<PaymentMethod | 'new' | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);

  const replace = (m: PaymentMethod) =>
    qc.setQueryData<PaymentMethod[]>(KEY, (list = []) =>
      list.some((x) => x.id === m.id) ? list.map((x) => (x.id === m.id ? m : x)) : [...list, m],
    );

  const toggle = async (m: PaymentMethod) => {
    setToggling(m.id);
    try {
      const updated = await paymentAdminApi.setActive(m.id, !m.active);
      replace(updated);
      toast.show(updated.active ? `"${m.displayName}" is now visible to customers` : `"${m.displayName}" hidden from customers`, 'info');
    } catch (e) {
      toast.show(errorMessage(e), 'error');
    } finally {
      setToggling(null);
    }
  };

  if (q.isLoading) return <Loader style={{ flex: 1 }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.gray100 }}>
      <FlatList
        data={q.data ?? []}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ padding: spacing.md, gap: 10 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.gold500} />}
        ListHeaderComponent={
          <View style={{ gap: 10 }}>
            <AppText muted>Bank accounts and UPI QR codes customers can pay to. Only active ones are shown at checkout.</AppText>
            {q.error ? <ErrorBox message={errorMessage(q.error)} onRetry={q.refetch} /> : null}
            <Row>
              <Button title="Bank account" icon={Plus} variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => setBankEditor('new')} />
              <Button title="QR code" icon={Plus} size="sm" style={{ flex: 1 }} onPress={() => setQrEditor('new')} />
            </Row>
          </View>
        }
        ListEmptyComponent={<EmptyState icon={Building2} title="No payment methods yet" message="Add a bank account or a QR code so customers can pay." />}
        renderItem={({ item: m }) => (
          <Card style={{ opacity: m.active ? 1 : 0.6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row style={{ flex: 1 }}>
                {m.type === 'QR_CODE' ? <QrCode size={22} color={colors.gold600} /> : <Building2 size={22} color={colors.gold600} />}
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontWeight: '700' }}>{m.displayName}</AppText>
                  <AppText variant="caption">{m.type === 'QR_CODE' ? 'UPI QR code' : 'Bank account'}</AppText>
                </View>
              </Row>
              <Badge label={m.active ? 'Active' : 'Inactive'} bg={m.active ? 'rgba(34,197,94,0.16)' : colors.gray100} fg={m.active ? colors.green700 : colors.gray600} />
            </Row>
            {m.type === 'BANK_ACCOUNT' ? (
              <View style={{ marginTop: 8 }}>
                <KeyValue label="Holder" value={m.accountHolderName} />
                <KeyValue label="Bank" value={m.bankName} />
                <KeyValue label="Account no." value={m.accountNumber} />
                <KeyValue label="IFSC" value={m.ifscCode} />
                <KeyValue label="Branch" value={m.branchName} />
              </View>
            ) : (
              <Row style={{ marginTop: 10, alignItems: 'flex-start' }} gap={12}>
                <AuthImage path={paymentAdminApi.qrImagePath(m.id)} size={112} label={`QR for ${m.displayName}`} />
                <View style={{ flex: 1 }}>
                  <AppText variant="caption">UPI ID</AppText>
                  <AppText style={{ fontWeight: '600' }}>{m.upiId || '—'}</AppText>
                </View>
              </Row>
            )}
            <Row style={{ marginTop: 12 }}>
              <Button title="Edit" size="sm" variant="ghost" onPress={() => (m.type === 'QR_CODE' ? setQrEditor(m) : setBankEditor(m))} />
              <Button
                title={toggling === m.id ? 'Saving…' : m.active ? 'Deactivate' : 'Activate'}
                size="sm"
                variant={m.active ? 'dangerOutline' : 'success'}
                loading={toggling === m.id}
                onPress={() => toggle(m)}
              />
            </Row>
          </Card>
        )}
      />
      {bankEditor && (
        <BankEditor
          method={bankEditor === 'new' ? null : bankEditor}
          onClose={() => setBankEditor(null)}
          onSaved={(m, created) => {
            replace(m);
            setBankEditor(null);
            toast.show(created ? 'Payment option added' : 'Payment option updated');
          }}
        />
      )}
      {qrEditor && (
        <QrEditor
          method={qrEditor === 'new' ? null : qrEditor}
          onClose={() => setQrEditor(null)}
          onSaved={(m, created) => {
            replace(m);
            setQrEditor(null);
            toast.show(created ? 'Payment option added' : 'Payment option updated');
          }}
        />
      )}
    </View>
  );
}

function BankEditor({ method, onClose, onSaved }: { method: PaymentMethod | null; onClose: () => void; onSaved: (m: PaymentMethod, created: boolean) => void }) {
  const [f, setF] = useState<BankAccountInput>({
    displayName: method?.displayName ?? '',
    accountHolderName: method?.accountHolderName ?? '',
    bankName: method?.bankName ?? '',
    accountNumber: method?.accountNumber ?? '',
    ifscCode: method?.ifscCode ?? '',
    branchName: method?.branchName ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof BankAccountInput) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const save = async () => {
    const e: Record<string, string> = {};
    (['displayName', 'accountHolderName', 'bankName', 'accountNumber', 'ifscCode'] as const).forEach((k) => {
      if (!f[k]?.trim()) e[k] = 'Required';
    });
    if (!e.accountNumber && !ACCOUNT_NUMBER_PATTERN.test(f.accountNumber.trim())) e.accountNumber = 'Must be 9–18 digits';
    if (!e.ifscCode && !IFSC_PATTERN.test(f.ifscCode.trim())) e.ifscCode = 'Must be a valid IFSC, e.g. HDFC0001234';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    setFormError(null);
    const body: BankAccountInput = {
      displayName: f.displayName.trim(),
      accountHolderName: f.accountHolderName.trim(),
      bankName: f.bankName.trim(),
      accountNumber: f.accountNumber.trim(),
      ifscCode: f.ifscCode.trim(),
      branchName: f.branchName?.trim() || undefined,
    };
    try {
      const saved = method ? await paymentAdminApi.updateBankAccount(method.id, body) : await paymentAdminApi.createBankAccount(body);
      onSaved(saved, !method);
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={method ? 'Edit bank account' : 'Add bank account'}
      dismissable={!saving}
      footer={
        <>
          <Button title="Cancel" variant="ghost" onPress={onClose} disabled={saving} style={{ flex: 1 }} />
          <Button title={saving ? 'Saving…' : 'Save'} loading={saving} onPress={save} style={{ flex: 1 }} />
        </>
      }
    >
      {formError ? <ErrorBox message={formError} /> : null}
      <Input label="Display name (shown to customers)" value={f.displayName} onChangeText={set('displayName')} placeholder="HDFC Current A/c" maxLength={100} error={errors.displayName} />
      <Input label="Account holder name" value={f.accountHolderName} onChangeText={set('accountHolderName')} maxLength={100} error={errors.accountHolderName} />
      <Input label="Bank name" value={f.bankName} onChangeText={set('bankName')} maxLength={100} error={errors.bankName} />
      <Input label="Account number" value={f.accountNumber} onChangeText={(t) => set('accountNumber')(t.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={18} error={errors.accountNumber} />
      <Input label="IFSC code" value={f.ifscCode} onChangeText={(t) => set('ifscCode')(t.toUpperCase())} autoCapitalize="characters" maxLength={11} placeholder="HDFC0001234" error={errors.ifscCode} />
      <Input label="Branch (optional)" value={f.branchName} onChangeText={set('branchName')} maxLength={100} />
    </Sheet>
  );
}

function QrEditor({ method, onClose, onSaved }: { method: PaymentMethod | null; onClose: () => void; onSaved: (m: PaymentMethod, created: boolean) => void }) {
  const [displayName, setDisplayName] = useState(method?.displayName ?? '');
  const [upiId, setUpiId] = useState(method?.upiId ?? '');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const choose = async () => {
    try {
      const [f] = await pickImages(1);
      if (!f) return;
      const err = checkFile(f, QR_TYPES);
      setErrors((e) => ({ ...e, qrImage: err ?? '' }));
      if (!err) setFile(f);
    } catch (e) {
      toast.show(errorMessage(e), 'error');
    }
  };

  const save = async () => {
    const e: Record<string, string> = {};
    if (!displayName.trim()) e.displayName = 'Required';
    if (upiId.trim() && !UPI_ID_PATTERN.test(upiId.trim())) e.upiId = 'Enter a valid UPI ID, e.g. store@okhdfcbank';
    if (!method || file) {
      const fe = checkFile(file, QR_TYPES);
      if (fe) e.qrImage = fe;
    }
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    setFormError(null);
    try {
      const saved = method
        ? await paymentAdminApi.updateQrCode(method.id, { displayName, upiId, qrImage: file })
        : await paymentAdminApi.createQrCode({ displayName, upiId, qrImage: file! });
      onSaved(saved, !method);
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={method ? 'Edit QR code' : 'Add QR code'}
      dismissable={!saving}
      footer={
        <>
          <Button title="Cancel" variant="ghost" onPress={onClose} disabled={saving} style={{ flex: 1 }} />
          <Button title={saving ? 'Saving…' : 'Save'} loading={saving} onPress={save} style={{ flex: 1 }} />
        </>
      }
    >
      {formError ? <ErrorBox message={formError} /> : null}
      <Input label="Display name" value={displayName} onChangeText={setDisplayName} placeholder="Bandookwale UPI" maxLength={100} error={errors.displayName} />
      <Input label="UPI ID (optional)" value={upiId} onChangeText={setUpiId} placeholder="store@okhdfcbank" autoCapitalize="none" error={errors.upiId} />
      <AppText variant="label" style={{ marginBottom: 6 }}>
        QR code image{method ? ' (leave empty to keep the current one)' : ''}
      </AppText>
      <Row style={{ alignItems: 'flex-start' }} gap={12}>
        {file ? (
          <Image source={{ uri: file.uri }} style={{ width: 112, height: 112, borderRadius: 10 }} />
        ) : method ? (
          <AuthImage path={paymentAdminApi.qrImagePath(method.id)} size={112} />
        ) : null}
        <View style={{ flex: 1 }}>
          <Button title={file ? file.name : 'Choose image'} size="sm" variant="ghost" onPress={choose} />
          <Text style={{ fontSize: 11, color: colors.gray500, marginTop: 6 }}>PNG or JPG · max 5 MB</Text>
          {errors.qrImage ? <Text style={{ fontSize: 11, color: colors.red600, marginTop: 4 }}>{errors.qrImage}</Text> : null}
        </View>
      </Row>
    </Sheet>
  );
}
