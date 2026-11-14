import { useHeaderHeight } from '@react-navigation/elements';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Camera } from 'lucide-react-native';
import { useAppDispatch, useAppSelector } from '../../store';
import { refreshUser as refreshUserThunk, updateUser as updateUserAction } from '../../store/slices/authSlice';
import type { User } from '../../api/types';
import { usersApi } from '../../api/users';
import { errorMessage } from '../../api/client';
import { pickImages } from '../../lib/filePicker';
import { AppText, Button, Card, ErrorBox, Input, KeyValue } from '../../components/ui';
import { toast } from '../../components/ui/Toast';
import { EMAIL_PATTERN } from '../../lib/validation';
import { initials } from '../../lib/format';
import { colors, font, spacing } from '../../theme';

export function ProfileScreen() {
  const headerHeight = useHeaderHeight();
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const updateUser = (patch: Partial<User>) => dispatch(updateUserAction(patch));
  const refreshUser = useCallback(() => dispatch(refreshUserThunk()), [dispatch]);
  const [form, setForm] = useState({ name: '', email: '', country: '', mobile: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name && user.name !== user.email ? user.name : '',
      email: user.email ?? '',
      country: user.country ?? '',
      mobile: user.mobile ?? '',
    });
  }, [user]);

  if (!user) return null;
  const image = user.profileImageUrl || user.imageUrl;

  const changePhoto = async () => {
    try {
      const [file] = await pickImages(1);
      if (!file) return;
      if (!user.nodeId) return toast.show('User node ID not found. Please sign in again.', 'error');
      setUploading(true);
      const res = await usersApi.uploadProfileImage(user.nodeId, file);
      const url =
        res?.data?.profileImageUrl || res?.data?.imageUrl || res?.profileImageUrl || res?.imageUrl || res?.data?.message || res?.message;
      if (url && /^https?:/.test(String(url))) {
        updateUser({ profileImageUrl: url, imageUrl: url });
        toast.show('Image uploaded successfully!');
      } else {
        toast.show('Image uploaded. It will appear shortly.', 'info');
        refreshUser();
      }
    } catch (e: any) {
      toast.show(
        e?.status === 413
          ? 'Image file is too large. Please select a smaller image.'
          : e?.status === 400
          ? 'Invalid image file. Please select a JPG or PNG.'
          : `Failed to upload image: ${errorMessage(e)}`,
        'error',
      );
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (form.email.trim() && !EMAIL_PATTERN.test(form.email.trim())) return setError('Enter a valid email.');
    setError(null);
    setSaving(true);
    try {
      const res: any = await usersApi.updateProfile({
        userName: form.name.trim() || user.name || null,
        email: form.email.trim() || user.email || null,
        country: form.country.trim() || user.country || null,
        mobile: form.mobile.trim() || user.mobile || null,
        userNodeId: user.nodeId ?? null,
      });
      updateUser({
        name: res?.userName || form.name.trim() || user.name,
        email: res?.email || form.email.trim() || user.email,
        country: res?.country || form.country.trim() || user.country,
        mobile: res?.mobile || form.mobile.trim() || user.mobile,
      });
      toast.show('Profile updated successfully!');
    } catch (e) {
      setError(`Failed to update profile. ${errorMessage(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={headerHeight}>
      <ScrollView style={{ backgroundColor: colors.gray100 }} contentContainerStyle={{ padding: spacing.md, gap: spacing.md }} keyboardShouldPersistTaps="handled">
        <Card style={{ alignItems: 'center' }}>
          <Pressable onPress={changePhoto} disabled={uploading} accessibilityLabel="Change profile photo">
            {image ? (
              <Image source={{ uri: image }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={{ color: colors.white, fontSize: 34, fontWeight: '800' }}>{initials(user.name)}</Text>
              </View>
            )}
            <View style={styles.cameraBadge}>
              <Camera size={16} color={colors.white} />
            </View>
          </Pressable>
          <AppText variant="heading" style={{ marginTop: 12 }}>{user.name}</AppText>
          <AppText muted>{uploading ? 'Uploading photo…' : 'Tap the photo to change it'}</AppText>
          <View style={{ alignSelf: 'stretch', marginTop: 12 }}>
            <KeyValue label="Username" value={user.username} />
            <KeyValue label="Member ID" value={user.nodeId} />
          </View>
        </Card>

        <Card>
          <AppText variant="heading" style={{ marginBottom: 12 }}>Personal information</AppText>
          {error ? <ErrorBox message={error} /> : null}
          <Input label="Name" value={form.name} onChangeText={(t) => setForm((f) => ({ ...f, name: t }))} placeholder="Enter your name" />
          <Input
            label="Email"
            value={form.email}
            onChangeText={(t) => setForm((f) => ({ ...f, email: t }))}
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input label="Country" value={form.country} onChangeText={(t) => setForm((f) => ({ ...f, country: t }))} placeholder="Country" />
          <Input
            label="Mobile"
            value={form.mobile}
            onChangeText={(t) => setForm((f) => ({ ...f, mobile: t }))}
            placeholder="Enter your mobile number"
            keyboardType="phone-pad"
          />
          <Button title={saving ? 'Updating...' : 'Update'} loading={saving} onPress={save} />
        </Card>
        <Text style={{ textAlign: 'center', color: colors.gray400, fontSize: font.xs }}>Signed in as {user.email}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 104, height: 104, borderRadius: 52 },
  avatarFallback: { backgroundColor: colors.gold500, alignItems: 'center', justifyContent: 'center' },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.navy,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
