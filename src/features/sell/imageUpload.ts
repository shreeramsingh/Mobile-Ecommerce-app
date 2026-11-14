import { useState } from 'react';
import { usersApi } from '../../api/users';
import { errorMessage } from '../../api/client';
import type { PickedFile } from '../../lib/validation';

export interface UploadTile {
  key: string;
  /** Local preview or remote URL. */
  previewUri?: string;
  /** Server image id once uploaded. */
  imageId?: string;
  status: 'uploading' | 'done' | 'error';
  error?: string;
}

/**
 * Product photo uploads: each picked photo uploads immediately (one request per
 * file, like the website) and becomes a tile. The server image id comes back
 * in `message`; productImageList is built from the finished tiles.
 */
export function useImageUploads(nodeId: string | undefined, initial: UploadTile[] = []) {
  const [tiles, setTiles] = useState<UploadTile[]>(initial);

  const upload = async (files: PickedFile[]) => {
    if (!nodeId) throw new Error('You must be logged in.');
    for (const f of files) {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setTiles((t) => [...t, { key, previewUri: f.uri, status: 'uploading' }]);
      try {
        const res = await usersApi.uploadImage(nodeId, f);
        const id = res?.message ?? res?.data?.imageId ?? res?.imageId;
        if (!id) throw new Error('Image uploaded but ID not received.');
        setTiles((t) => t.map((x) => (x.key === key ? { ...x, imageId: String(id), status: 'done' } : x)));
      } catch (e: any) {
        const msg =
          e?.status === 413
            ? 'Image too large. Use under 2MB.'
            : e?.status === 400
            ? 'Invalid format. Use JPG or PNG.'
            : `Upload failed: ${errorMessage(e)}`;
        setTiles((t) => t.map((x) => (x.key === key ? { ...x, status: 'error', error: msg } : x)));
      }
    }
  };

  return {
    tiles,
    setTiles,
    upload,
    remove: (key: string) => setTiles((t) => t.filter((x) => x.key !== key)),
    isUploading: tiles.some((t) => t.status === 'uploading'),
    productImageList: () =>
      tiles
        .filter((t) => t.status === 'done' && t.imageId)
        .map((t) => ({ productImageId: t.imageId!, productFkId: null, profileImageUrl: null })),
  };
}
