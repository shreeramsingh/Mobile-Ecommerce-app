// Client-side rules that mirror the server's validation (same as the website).

export const PHONE_PATTERN = /^(\+?91[\s-]?|0)?[6-9]\d{9}$/;
export const PINCODE_PATTERN = /^[1-9]\d{5}$/;
export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const ACCOUNT_NUMBER_PATTERN = /^\d{9,18}$/;
export const UPI_ID_PATTERN = /^[\w.-]{2,256}@[A-Za-z]{2,64}$/;
export const TXN_REF_PATTERN = /^[A-Za-z0-9-]+$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const RECEIPT_TYPES = ['image/png', 'image/jpeg', 'application/pdf'];
export const QR_TYPES = ['image/png', 'image/jpeg'];

export interface PickedFile {
  uri: string;
  name: string;
  type: string;
  size?: number | null;
}

/** Returns an error message, or null if the file is acceptable. */
export function checkFile(file: PickedFile | null | undefined, allowed: string[]): string | null {
  if (!file) return 'Please choose a file.';
  if (file.size && file.size > MAX_UPLOAD_BYTES) return 'File is too large. Maximum size is 5 MB.';
  if (file.type && !allowed.includes(file.type)) {
    return allowed.includes('application/pdf')
      ? 'Only PNG, JPG or PDF files are allowed.'
      : 'Only PNG or JPG images are allowed.';
  }
  return null;
}
