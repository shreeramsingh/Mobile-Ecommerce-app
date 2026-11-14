import React from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertCircle, ImagePlus, X } from 'lucide-react-native';
import { ProductImage } from '../../components/ProductImage';
import { pickImages, takePhoto } from '../../lib/filePicker';
import { toast } from '../../components/ui/Toast';
import { errorMessage } from '../../api/client';
import type { UploadTile } from './imageUpload';
import type { PickedFile } from '../../lib/validation';
import { colors, font, radius } from '../../theme';

const MAX_PHOTOS = 10;

export function PhotoTiles({
  tiles,
  onAdd,
  onRemove,
  disabled,
}: {
  tiles: UploadTile[];
  onAdd: (files: PickedFile[]) => Promise<void>;
  onRemove: (key: string) => void;
  disabled?: boolean;
}) {
  const remaining = MAX_PHOTOS - tiles.length;

  const add = () => {
    if (remaining <= 0) return toast.show(`You can add up to ${MAX_PHOTOS} photos`, 'info');
    const run = (p: Promise<PickedFile[]>) =>
      p.then((files) => (files.length ? onAdd(files) : undefined)).catch((e) => toast.show(errorMessage(e), 'error'));
    Alert.alert('Add photos', undefined, [
      { text: 'Photo library', onPress: () => run(pickImages(remaining)) },
      { text: 'Take photo', onPress: () => run(takePhoto().then((f) => (f ? [f] : []))) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.grid}>
      {tiles.map((t) => (
        <View key={t.key} style={styles.tile}>
          <ProductImage uri={t.previewUri} style={styles.img} />
          {t.status === 'uploading' && (
            <View style={styles.overlay}>
              <ActivityIndicator color={colors.white} />
              <Text style={styles.overlayText}>uploading...</Text>
            </View>
          )}
          {t.status === 'error' && (
            <View style={[styles.overlay, { backgroundColor: 'rgba(127,29,29,0.75)' }]}>
              <AlertCircle size={18} color={colors.white} />
              <Text style={styles.overlayText} numberOfLines={3}>{t.error}</Text>
            </View>
          )}
          <Pressable
            onPress={() => onRemove(t.key)}
            disabled={t.status === 'uploading'}
            style={styles.remove}
            hitSlop={6}
            accessibilityLabel="Remove photo"
          >
            <X size={14} color={colors.white} />
          </Pressable>
        </View>
      ))}
      {remaining > 0 && (
        <Pressable onPress={add} disabled={disabled} style={[styles.tile, styles.addTile, disabled && { opacity: 0.5 }]}>
          <ImagePlus size={24} color={colors.gray500} />
          <Text style={{ fontSize: font.xs, color: colors.gray500, marginTop: 4 }}>Add photos</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: 96, height: 96, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.gray100 },
  img: { width: '100%', height: '100%' },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  overlayText: { color: colors.white, fontSize: 10, textAlign: 'center', marginTop: 3 },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.red600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.gray300,
    backgroundColor: colors.gray50,
  },
});
