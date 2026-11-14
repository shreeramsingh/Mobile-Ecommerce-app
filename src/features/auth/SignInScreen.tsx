import React, { useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eye, EyeOff } from 'lucide-react-native';
import type { RootScreenProps } from '../../navigation/types';
import { useAppDispatch, useAppSelector } from '../../store';
import { clearNotice, signIn, takeGeneratedUsername } from '../../store/slices/authSlice';
import { AppText, Button, Checkbox, ErrorBox, InfoBox, Input } from '../../components/ui';
import { colors, font, radius, spacing } from '../../theme';

const LOGO = require('../../assets/images/logo-white.png');

export function SignInScreen({ navigation }: RootScreenProps<'SignIn'>) {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const notice = useAppSelector((s) => s.auth.notice);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [keep, setKeep] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    const generated = takeGeneratedUsername();
    if (generated) setUsername(generated);
  }, []);

  const submit = async () => {
    if (!username.trim() || !password) return setError('Please enter both username and password.');
    setError(null);
    dispatch(clearNotice());
    setLoading(true);
    const res = await dispatch(signIn({ username, password, keepLoggedIn: keep }));
    setLoading(false);
    // On success the root navigator swaps to the signed-in screens automatically.
    if (signIn.rejected.match(res)) setError(res.payload ?? 'Login failed.');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.navy }} behavior="padding">
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 24 }} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <View style={styles.logoBox}>
            <Image source={LOGO} style={{ width: '86%', height: '86%' }} resizeMode="contain" />
          </View>
          <Text style={styles.brandText}>
            Bandook<Text style={{ color: colors.gold400 }}>wale</Text>
          </Text>
        </View>

        <View style={[styles.card, { paddingBottom: insets.bottom + 24 }]}>
          <AppText variant="title">Sign In</AppText>
          <AppText muted style={{ marginTop: 4, marginBottom: 20 }}>Access the product using your userId and passcode!</AppText>
          {notice ? <InfoBox text={notice} tone="warning" /> : null}
          {error ? <ErrorBox message={error} /> : null}
          <Input
            label="Username *"
            value={username}
            onChangeText={setUsername}
            placeholder="Enter your username"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <Input
            ref={passwordRef}
            label="Password *"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            secureTextEntry={!show}
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            right={
              <Pressable onPress={() => setShow((s) => !s)} hitSlop={10} style={{ paddingHorizontal: 12 }} accessibilityLabel={show ? 'Hide password' : 'Show password'}>
                {show ? <EyeOff size={20} color={colors.gray500} /> : <Eye size={20} color={colors.gray500} />}
              </Pressable>
            }
          />
          <Checkbox checked={keep} onChange={setKeep} label="Keep me logged in" />
          <Button title={loading ? 'Signing in...' : 'Sign in'} loading={loading} onPress={submit} style={{ marginTop: 12 }} />
          <View style={styles.footer}>
            <AppText muted>Don't have an account? </AppText>
            <Pressable onPress={() => navigation.replace('SignUp')}>
              <Text style={{ color: colors.gold600, fontWeight: '700', fontSize: font.md }}>Sign Up</Text>
            </Pressable>
          </View>
          {navigation.canGoBack() && (
            <Pressable onPress={() => navigation.goBack()} style={{ alignSelf: 'center', marginTop: 16 }}>
              <Text style={{ color: colors.gray500 }}>Continue browsing</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', paddingBottom: 28 },
  logoBox: {
    width: 84,
    height: 84,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { color: colors.white, fontSize: font.xxl, fontWeight: '800', marginTop: 12 },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.xxl,
  },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
});

export const authStyles = styles;
export { radius };
