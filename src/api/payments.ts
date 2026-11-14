import { request, filePart } from './client';
import type {
  PageResponse,
  PaymentMethod,
  PaymentStatus,
  PaymentSubmission,
  ShippingAddressInput,
  ShippingStatus,
  OrderStatus,
  ShopOrder,
} from './types';
import type { PickedFile } from '../lib/validation';

// Manual payments (bank transfer / UPI QR + receipt) and shop orders (Shiprocket).

export interface SubmitPaymentInput {
  paymentMethodId: number;
  amount: string; // "1500.00"
  transactionReference: string;
  paymentDate: string; // YYYY-MM-DD
  remarks?: string;
  orderReference?: string;
  productIds?: number[];
  receipt: PickedFile;
}

export interface BankAccountInput {
  displayName: string;
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branchName?: string;
}

const toQuery = (q: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(q).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ) as Record<string, string | number>;

export const paymentUserApi = {
  listMethods: () => request<PaymentMethod[]>('/api/payment-methods'),

  submitPayment: (input: SubmitPaymentInput) => {
    const form = new FormData();
    form.append('paymentMethodId', String(input.paymentMethodId));
    form.append('amount', input.amount);
    form.append('transactionReference', input.transactionReference.trim());
    form.append('paymentDate', input.paymentDate);
    if (input.remarks?.trim()) form.append('remarks', input.remarks.trim());
    if (input.orderReference) form.append('orderReference', input.orderReference);
    input.productIds?.forEach((id) => form.append('productIds', String(id)));
    form.append('receipt', filePart(input.receipt));
    return request<PaymentSubmission>('/api/payments', { method: 'POST', body: form, timeoutMs: 60_000 });
  },

  myPayments: () => request<PaymentSubmission[]>('/api/payments'),
  getPayment: (id: number) => request<PaymentSubmission>(`/api/payments/${id}`),
  qrImagePath: (id: number) => `/api/payment-methods/${id}/qr-image`,
};

export const paymentAdminApi = {
  listMethods: () => request<PaymentMethod[]>('/api/admin/payment-methods'),

  createBankAccount: (body: BankAccountInput) =>
    request<PaymentMethod>('/api/admin/payment-methods/bank-account', { method: 'POST', body }),

  updateBankAccount: (id: number, body: BankAccountInput) =>
    request<PaymentMethod>(`/api/admin/payment-methods/bank-account/${id}`, { method: 'PUT', body }),

  createQrCode: (input: { displayName: string; upiId?: string; qrImage: PickedFile }) => {
    const form = new FormData();
    form.append('displayName', input.displayName.trim());
    if (input.upiId?.trim()) form.append('upiId', input.upiId.trim());
    form.append('qrImage', filePart(input.qrImage));
    return request<PaymentMethod>('/api/admin/payment-methods/qr-code', { method: 'POST', body: form });
  },

  updateQrCode: (
    id: number,
    input: { displayName?: string; upiId?: string; qrImage?: PickedFile | null },
  ) => {
    const form = new FormData();
    if (input.displayName?.trim()) form.append('displayName', input.displayName.trim());
    if (input.upiId !== undefined) form.append('upiId', input.upiId.trim());
    if (input.qrImage) form.append('qrImage', filePart(input.qrImage));
    return request<PaymentMethod>(`/api/admin/payment-methods/qr-code/${id}`, { method: 'PUT', body: form });
  },

  setActive: (id: number, active: boolean) =>
    request<PaymentMethod>(`/api/admin/payment-methods/${id}/status`, {
      method: 'PATCH',
      query: { active },
    }),

  qrImagePath: (id: number) => `/api/admin/payment-methods/${id}/qr-image`,

  listPayments: (q: { status?: PaymentStatus; page?: number; size?: number; sort?: string } = {}) =>
    request<PageResponse<PaymentSubmission>>('/api/admin/payments', { query: toQuery(q) }),

  getPayment: (id: number) => request<PaymentSubmission>(`/api/admin/payments/${id}`),

  approve: (id: number, productIds: number[] = []) =>
    request<PaymentSubmission>(`/api/admin/payments/${id}/approve`, { method: 'PUT', body: { productIds } }),

  reject: (id: number, reason: string, productIds: number[] = []) =>
    request<PaymentSubmission>(`/api/admin/payments/${id}/reject`, {
      method: 'PUT',
      body: { reason: reason.trim(), productIds },
    }),
};

export const shopOrderApi = {
  /** Creates the order on the server; prices come from the products table. */
  /** The server re-checks the voucher and prices; a bad voucher comes back as a 400 with `detail`. */
  create: (
    items: { productId: number; quantity: number }[],
    shipping: ShippingAddressInput,
    voucherCode?: string | null,
  ) =>
    request<ShopOrder>('/api/shop-orders', {
      method: 'POST',
      body: { items, shipping, ...(voucherCode ? { voucherCode } : {}) },
    }),
  myOrders: () => request<ShopOrder[]>('/api/shop-orders'),
  get: (ref: string) => request<ShopOrder>(`/api/shop-orders/${encodeURIComponent(ref)}`),
};

export const adminShopOrderApi = {
  list: (q: { status?: OrderStatus; shippingStatus?: ShippingStatus; page?: number; size?: number } = {}) =>
    request<PageResponse<ShopOrder>>('/api/admin/shop-orders', { query: toQuery(q) }),
  get: (ref: string) => request<ShopOrder>(`/api/admin/shop-orders/${encodeURIComponent(ref)}`),
  ship: (ref: string) =>
    request<ShopOrder>(`/api/admin/shop-orders/${encodeURIComponent(ref)}/ship`, { method: 'POST' }),
};

/** Amount the buyer pays for an order (after voucher). */
export const orderPayable = (o: ShopOrder) => Number(o.total ?? o.subtotal);
