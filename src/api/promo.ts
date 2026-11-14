import { request } from './client';

// Discounts (automatic sales on store products) and vouchers (codes entered in the cart).

export type PromoValueType = 'PERCENTAGE' | 'FLAT'; // PERCENTAGE: 1–99 (% off). FLAT: rupees off.
export type DiscountScope = 'ALL_STORE_PRODUCTS' | 'SELECTED_PRODUCTS';

export interface DiscountInput {
  name: string;
  valueType: PromoValueType;
  value: number;
  scope: DiscountScope;
  productIds: number[]; // empty when scope is ALL_STORE_PRODUCTS
  startsAt: string; // ISO instant
  endsAt: string | null; // null = no end date
  active: boolean;
}
export interface Discount extends DiscountInput {
  id: number;
  createdAt: string;
  updatedAt: string;
}

export interface VoucherInput {
  code: string; // A–Z, 0–9, 4–20 chars
  description: string | null;
  valueType: PromoValueType;
  value: number;
  maxDiscountAmount: number | null; // cap for PERCENTAGE; ignored for FLAT
  minOrderAmount: number | null;
  usageLimit: number | null; // total redemptions; null = unlimited
  perUserLimit: number | null;
  startsAt: string;
  endsAt: string | null;
  active: boolean;
}
export interface Voucher extends VoucherInput {
  id: number;
  usedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface VoucherQuote {
  code: string;
  description: string | null;
  subtotal: number; // cart total after automatic sale discounts
  discountAmount: number; // what the voucher takes off
  total: number; // subtotal − discountAmount
}

export const VOUCHER_CODE_PATTERN = /^[A-Z0-9]{4,20}$/;

function crud<T, I>(base: string) {
  return {
    list: () => request<T[]>(base),
    create: (body: I) => request<T>(base, { method: 'POST', body }),
    update: (id: number, body: I) => request<T>(`${base}/${id}`, { method: 'PUT', body }),
    setActive: (id: number, active: boolean) =>
      request<T>(`${base}/${id}/status`, { method: 'PATCH', query: { active } }),
    remove: (id: number) => request(`${base}/${id}`, { method: 'DELETE', responseType: 'none' }),
  };
}

export const discountAdminApi = crud<Discount, DiscountInput>('/api/admin/discounts');
export const voucherAdminApi = crud<Voucher, VoucherInput>('/api/admin/vouchers');

export const voucherUserApi = {
  /** Checks a code against the cart. Rejections are 400/404 with a buyer-friendly `detail`. */
  validate: (code: string, items: { productId: number; quantity: number }[]) =>
    request<VoucherQuote>('/api/vouchers/validate', {
      method: 'POST',
      body: { code: code.trim().toUpperCase(), items },
    }),
};

// ─── Status and labels ────────────────────────────────────────────────────────
export type PromoStatus = 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'INACTIVE' | 'USED_UP';

export function promoStatus(p: {
  active: boolean;
  startsAt: string;
  endsAt: string | null;
  usageLimit?: number | null;
  usedCount?: number;
}): PromoStatus {
  const now = Date.now();
  if (!p.active) return 'INACTIVE';
  if (p.endsAt && new Date(p.endsAt).getTime() <= now) return 'EXPIRED';
  if (p.usageLimit != null && (p.usedCount ?? 0) >= p.usageLimit) return 'USED_UP';
  if (new Date(p.startsAt).getTime() > now) return 'SCHEDULED';
  return 'ACTIVE';
}

export const valueLabel = (type: PromoValueType, value: number) =>
  type === 'PERCENTAGE' ? `${value}% OFF` : `₹${Number(value).toLocaleString('en-IN')} OFF`;
