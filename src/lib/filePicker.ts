import { Alert } from 'react-native';
import { launchCamera, launchImageLibrary, type Asset } from 'react-native-image-picker';
import { pick, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import type { PickedFile } from './validation';

const fromAsset = (a: Asset): PickedFile => ({
  uri: a.uri!,
  name: a.fileName || `photo-${Date.now()}.jpg`,
  type: a.type || 'image/jpeg',
  size: a.fileSize,
});

/** Picks one or more photos, resized on-device so uploads stay small (max ~1600px, 80% JPEG). */
export async function pickImages(limit = 1): Promise<PickedFile[]> {
  const res = await launchImageLibrary({
    mediaType: 'photo',
    selectionLimit: limit,
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 0.8,
  });
  if (res.didCancel) return [];
  if (res.errorCode) throw new Error(res.errorMessage || 'Could not open your photos.');
  return (res.assets ?? []).filter((a) => a.uri).map(fromAsset);
}

export async function takePhoto(): Promise<PickedFile | null> {
  const res = await launchCamera({ mediaType: 'photo', maxWidth: 1600, maxHeight: 1600, quality: 0.8, saveToPhotos: false });
  if (res.didCancel || !res.assets?.[0]?.uri) return null;
  if (res.errorCode) throw new Error(res.errorMessage || 'Could not open the camera.');
  return fromAsset(res.assets[0]);
}

async function pickPdf(): Promise<PickedFile | null> {
  try {
    const [doc] = await pick({ type: [types.pdf, types.images], allowMultiSelection: false });
    return { uri: doc.uri, name: doc.name || 'receipt.pdf', type: doc.type || 'application/pdf', size: doc.size };
  } catch (e) {
    if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) return null;
    throw e;
  }
}

/** Receipt: photo from the gallery, camera, or a PDF/file. */
export function pickReceipt(): Promise<PickedFile | null> {
  return new Promise((resolve, reject) => {
    Alert.alert('Upload receipt', 'Choose where your payment receipt is', [
      { text: 'Photo library', onPress: () => pickImages(1).then((f) => resolve(f[0] ?? null), reject) },
      { text: 'Take photo', onPress: () => takePhoto().then(resolve, reject) },
      { text: 'PDF / file', onPress: () => pickPdf().then(resolve, reject) },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ]);
  });
}
