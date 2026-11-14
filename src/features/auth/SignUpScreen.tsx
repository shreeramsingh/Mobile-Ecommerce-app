import React, { useState } from 'react';
import {
  KeyboardAvoidingView, Modal, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eye, EyeOff } from 'lucide-react-native';
import type { RootScreenProps } from '../../navigation/types';
import { authApi } from '../../api/auth';
import { saveGeneratedUsername } from '../../store/slices/authSlice';
import { AppText, Button, Checkbox, ErrorBox, InfoBox, Input, Row } from '../../components/ui';
import { Select } from '../../components/ui/Sheet';
import { EMAIL_PATTERN } from '../../lib/validation';
import { SECTIONS, TERMS_LAST_UPDATED } from '../../data/terms';
import { colors, font, radius, spacing } from '../../theme';

const COUNTRIES = ['India', 'USA', 'UK', 'Canada', 'Australia', 'Germany', 'France', 'Japan', 'China', 'Brazil'];
const ID_TYPES = [
  { value: 'Passport', label: 'Passport' },
  { value: 'AadharCard', label: 'Aadhar Card' },
  { value: 'PanCard', label: 'PAN Card' },
  { value: 'DrivingLincense', label: 'Driving Licence' }, // value spelling matches the backend
];

export function SignUpScreen({ navigation }: RootScreenProps<'SignUp'>) {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState({
    name: '', country: 'India', mobile: '', email: '', password: '', confirm: '', nationalIdType: '', nationalId: '',
  });
  const [show, setShow] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [otpMsg, setOtpMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [hasReadTerms, setHasReadTerms] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ message: string; username?: string } | null>(null);

  const set = (k: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (k === 'email') {
      setOtpSent(false);
      setVerified(false);
      setOtp('');
      setOtpMsg(null);
    }
  };

  const sendOtp = async () => {
    if (!EMAIL_PATTERN.test(form.email.trim())) return setOtpMsg({ text: 'Please enter a valid email address', ok: false });
    setSending(true);
    setOtpMsg(null);
    try {
      await authApi.sendEmailOtp(form.email.trim());
      setOtpSent(true);
      setOtpMsg({ text: 'OTP sent to your email. Please enter it to verify.', ok: true });
    } catch {
      setOtpMsg({ text: 'Failed to send OTP. Please try again.', ok: false });
    } finally {
      setSending(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) return setOtpMsg({ text: 'Please enter the OTP', ok: false });
    setVerifying(true);
    try {
      const issued = await authApi.fetchIssuedOtp(form.email.trim());
      if (issued && issued === otp.trim()) {
        setVerified(true);
        setOtpMsg({ text: 'Email verified successfully.', ok: true });
      } else {
        setOtpMsg({ text: 'Invalid OTP. Please try again.', ok: false });
      }
    } catch {
      setOtpMsg({ text: 'Failed to verify OTP. Please try again.', ok: false });
    } finally {
      setVerifying(false);
    }
  };

  const submit = async () => {
    if (!accepted) return setError('You must read and accept the Terms and Conditions');
    if (form.password !== form.confirm) return setError('Passwords do not match');
    const required = [form.name, form.country, form.mobile, form.email, form.password, form.nationalIdType, form.nationalId];
    if (required.some((v) => !v.trim())) return setError('Please fill in all required fields');
    if (!verified) return setError('Please verify your email before registering');
    setError(null);
    setSubmitting(true);
    try {
      const res = await authApi.register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        mobile: form.mobile.trim(),
        country: form.country,
        nationalIdType: form.nationalIdType,
        nationalId: form.nationalId.trim(),
      });
      if (res.success) {
        if (res.username) saveGeneratedUsername(res.username);
        setSuccess({ message: res.message, username: res.username });
      } else {
        setError(res.message || 'Registration failed. Please check your information.');
      }
    } catch {
      setError('An error occurred during registration. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitLabel = submitting
    ? 'Creating account...'
    : !verified
    ? 'Verify Email to Sign Up'
    : !accepted
    ? 'Accept Terms to Sign Up'
    : 'Sign Up';

  const onTermsScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 16) setHasReadTerms(true);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior="padding">
      <ScrollView
        contentContainerStyle={{ padding: spacing.xxl, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <AppText variant="title">Sign Up</AppText>
        <AppText muted style={{ marginTop: 4, marginBottom: 20 }}>Create your Bandookwale account</AppText>

        {success ? (
          <View>
            <InfoBox text={success.message || 'Registration successful!'} tone="success" />
            {success.username ? (
              <View style={styles.credentials}>
                <Text style={{ fontWeight: '800', color: colors.blue700 }}>Your Login Credentials:</Text>
                <Text style={{ color: colors.blue700, marginTop: 6 }} selectable>Username: {success.username}</Text>
                <Text style={{ color: colors.blue700 }}>Password: [The password you entered]</Text>
              </View>
            ) : null}
            <Button title="Continue to Sign In" onPress={() => navigation.replace('SignIn')} style={{ marginTop: 16 }} />
          </View>
        ) : (
          <>
            {error ? <ErrorBox message={error} /> : null}
            <Input label="Name *" value={form.name} onChangeText={set('name')} placeholder="Enter Full Name" autoComplete="name" />
            <Select
              label="Country *"
              value={form.country || null}
              placeholder="Select country"
              options={COUNTRIES.map((c) => ({ value: c, label: c }))}
              onChange={(v) => set('country')(String(v))}
            />
            <Input label="Mobile *" value={form.mobile} onChangeText={set('mobile')} placeholder="Enter Your Mobile" keyboardType="phone-pad" autoComplete="tel" />
            <Input
              label="Email *"
              value={form.email}
              onChangeText={set('email')}
              placeholder="Enter Your Email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              right={
                verified ? (
                  <Text style={{ color: colors.green600, fontWeight: '700', paddingHorizontal: 12 }}>✓ Verified</Text>
                ) : (
                  <Pressable onPress={sendOtp} disabled={sending || !form.email} style={styles.inlineBtn}>
                    <Text style={{ color: colors.onAccent, fontWeight: '700', fontSize: font.xs }}>
                      {sending ? 'Sending...' : otpSent ? 'Resend OTP' : 'Send OTP'}
                    </Text>
                  </Pressable>
                )
              }
            />
            {otpSent && !verified && (
              <Input
                label="Email OTP *"
                value={otp}
                onChangeText={setOtp}
                placeholder="Enter OTP"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                right={
                  <Pressable onPress={verifyOtp} disabled={verifying} style={styles.inlineBtn}>
                    <Text style={{ color: colors.onAccent, fontWeight: '700', fontSize: font.xs }}>{verifying ? 'Verifying...' : 'Verify'}</Text>
                  </Pressable>
                }
              />
            )}
            {otpMsg ? (
              <Text style={{ color: otpMsg.ok ? colors.green600 : colors.red600, fontSize: font.xs, marginTop: -6, marginBottom: 10 }}>
                {otpMsg.text}
              </Text>
            ) : null}
            <Input
              label="Password *"
              value={form.password}
              onChangeText={set('password')}
              placeholder="Enter Your Password"
              secureTextEntry={!show}
              textContentType="newPassword"
              right={
                <Pressable onPress={() => setShow((s) => !s)} hitSlop={10} style={{ paddingHorizontal: 12 }}>
                  {show ? <EyeOff size={20} color={colors.gray500} /> : <Eye size={20} color={colors.gray500} />}
                </Pressable>
              }
            />
            <Input
              label="Confirm Password *"
              value={form.confirm}
              onChangeText={set('confirm')}
              placeholder="Enter Confirm Password"
              secureTextEntry={!show}
              textContentType="newPassword"
            />
            <Select
              label="National ID Type *"
              value={form.nationalIdType || null}
              placeholder="Select ID type"
              options={ID_TYPES}
              onChange={(v) => set('nationalIdType')(String(v))}
            />
            <Input label="National ID *" value={form.nationalId} onChangeText={set('nationalId')} placeholder="Enter National Id" autoCapitalize="characters" />

            <Checkbox
              checked={accepted}
              onChange={(v) => (v && !hasReadTerms ? setTermsOpen(true) : setAccepted(v))}
              label={
                <Text style={{ color: colors.gray700, fontSize: font.sm }}>
                  I have read and agree to the{' '}
                  <Text style={{ color: colors.gold600, fontWeight: '700' }} onPress={() => setTermsOpen(true)}>
                    Terms and Conditions
                  </Text>{' '}
                  and our Privacy Policy*
                </Text>
              }
            />

            <Button title={submitLabel} loading={submitting} disabled={!verified || !accepted} onPress={submit} style={{ marginTop: 14 }} />
          </>
        )}

        <Row style={{ justifyContent: 'center', marginTop: 20 }} gap={0}>
          <AppText muted>Already have an account? </AppText>
          <Pressable onPress={() => navigation.replace('SignIn')}>
            <Text style={{ color: colors.gold600, fontWeight: '700', fontSize: font.md }}>Sign In</Text>
          </Pressable>
        </Row>
      </ScrollView>

      <Modal visible={termsOpen} animationType="slide" onRequestClose={() => setTermsOpen(false)} presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: colors.surface }}>
          <ScrollView contentContainerStyle={{ padding: spacing.xl }} onScroll={onTermsScroll} scrollEventThrottle={100}>
            <AppText variant="title">Bandookwale Terms and Conditions</AppText>
            <AppText variant="caption" style={{ marginTop: 4 }}>Last updated: {TERMS_LAST_UPDATED}</AppText>
            <AppText muted style={{ marginTop: 10 }}>
              These Terms govern your use of bandookwale.com and any purchase made through it.
            </AppText>
            {SECTIONS.map((s) => (
              <View key={s.title} style={{ marginTop: 18 }}>
                <AppText variant="subheading">{s.title}</AppText>
                {s.blocks.map((b, i) =>
                  'p' in b ? (
                    <AppText key={i} style={styles.termsText}>{b.p}</AppText>
                  ) : 'ol' in b ? (
                    <View key={i}>
                      <AppText style={styles.termsText}>{b.lead}</AppText>
                      {b.ol.map((li, j) => (
                        <AppText key={j} style={[styles.termsText, { paddingLeft: 12 }]}>{`${j + 1}. ${li}`}</AppText>
                      ))}
                    </View>
                  ) : (
                    <View key={i}>
                      {b.ul.map((li, j) => (
                        <AppText key={j} style={[styles.termsText, { paddingLeft: 12 }]}>{`• ${li}`}</AppText>
                      ))}
                    </View>
                  ),
                )}
              </View>
            ))}
          </ScrollView>
          <View style={[styles.termsFooter, { paddingBottom: insets.bottom + 12 }]}>
            {!hasReadTerms && <AppText variant="caption" style={{ textAlign: 'center', marginBottom: 8 }}>Scroll to the end to accept.</AppText>}
            <Row>
              <Button
                title="Decline"
                variant="ghost"
                style={{ flex: 1 }}
                onPress={() => {
                  setAccepted(false);
                  setTermsOpen(false);
                }}
              />
              <Button
                title="I Agree"
                style={{ flex: 1 }}
                disabled={!hasReadTerms}
                onPress={() => {
                  setAccepted(true);
                  setTermsOpen(false);
                }}
              />
            </Row>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  inlineBtn: {
    backgroundColor: colors.gold500,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    marginRight: 6,
  },
  credentials: { backgroundColor: colors.blue50, borderRadius: radius.md, padding: spacing.md },
  termsText: { marginTop: 6, color: colors.gray700, fontSize: font.sm, lineHeight: 20 },
  termsFooter: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.gray200 },
});
