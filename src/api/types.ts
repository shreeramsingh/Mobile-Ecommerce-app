// Shapes returned by the Bandookwale backend (same API the website uses).

export interface Role {
  roleId: number;
  name: string; // 'ADMIN_USER' | 'NORMAL_USER'
}

export interface User {
  userPkId?: number;
  nodeId?: string;
  name: string;
  email: string;
  username?: string;
  country?: string;
  mobile?: string;
  about?: string;
  roles?: Role[];
  enabled?: boolean;
  activeStateCodeFkId?: string;
  profileImageUrl?: string | null;
  imageUrl?: string | null;
  imageId?: string | null;
  nationalIdType?: string;
  nationalId?: string;
  createdDatetime?: string;
  [key: string]: unknown;
}

export const isAdminUser = (u: User | null | undefined) =>
  !!u?.roles?.some((r) => r.name === 'ADMIN_USER');

/** Raw product as returned by /api/users/getProduct. */
export interface ApiProduct {
  productPkId: number;
  title: string;
  description?: string;
  price: number;
  negotiable?: boolean;
  isStoreProduct?: boolean;
  productQuantity?: number | null;
  sellerId?: string;
  sellerName?: string;
  brand?: string;
  location?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  latitude?: number | string;
  longitude?: number | string;
  categoryId?: number;
  subcategoryId?: number;
  weaponCategoryFkId?: number;
  weaponTypeFkId?: number;
  weaponSubTypeFkId?: number;
  caliberFkId?: number;
  isLicenseRequired?: boolean;
  /** Price after the best live sale (set by the backend); null when no sale. */
  salePrice?: number | null;
  /** e.g. "20% OFF" or "₹3,000 OFF" (set by the backend). */
  discountLabel?: string | null;
  createdDatetime?: string;
  productImageList?: ProductImage[];
  [key: string]: unknown;
}

export interface ProductImage {
  productImageId: string;
  productFkId: number | null;
  profileImageUrl: string | null;
}

/** Product as used by the UI. */
export interface Product {
  id: number;
  images: string[];
  price: number;
  title: string;
  location: string;
  createdAt?: string;
  sellerId?: string;
  sellerName?: string;
  description?: string;
  brand?: string;
  isNegotiable?: boolean;
  isStoreProduct?: boolean;
  /** null/0 = out of stock; undefined = not sent (treated as available). */
  productQuantity?: number | null;
  categoryId?: number;
  subcategoryId?: number;
  weaponCategoryFkId?: number;
  weaponTypeFkId?: number;
  weaponSubTypeFkId?: number;
  caliberFkId?: number;
  isLicenseRequired?: boolean;
  /** Price after the best live sale; null/undefined when there's no sale. */
  salePrice?: number | null;
  discountLabel?: string | null;
}

export interface Paged<T> {
  items: T[];
  total: number;
}

export interface Favorite {
  favoritesPkId: number;
  userFkId: string;
  productFkId: number;
  createdAt: string | null;
}

export interface Review {
  userReviewPkId?: number;
  reviewId?: number;
  userFkId: string;
  userId?: string;
  userName?: string;
  rating: number;
  comment: string;
  createdAt?: string;
  createdDateTime?: string | null;
}

// ─── Payments & orders ────────────────────────────────────────────────────────
export type PaymentMethodType = 'BANK_ACCOUNT' | 'QR_CODE';
export type PaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface PaymentMethod {
  id: number;
  type: PaymentMethodType;
  displayName: string;
  accountHolderName?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branchName?: string;
  upiId?: string;
  qrImageUrl?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentSubmission {
  id: number;
  userId: string;
  paymentMethodId: number;
  paymentMethodType: PaymentMethodType;
  paymentMethodName: string;
  amount: number;
  transactionReference: string;
  paymentDate: string;
  remarks: string | null;
  orderReference: string | null;
  receiptUrl: string;
  receiptFileName: string;
  status: PaymentStatus;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  submittedAt: string;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export type OrderStatus = 'PENDING_PAYMENT' | 'PAID' | 'CANCELLED';
export type ShippingStatus =
  | 'NOT_STARTED'
  | 'MANUAL_REVIEW'
  | 'PROCESSING'
  | 'ORDER_CREATED'
  | 'AWB_ASSIGNED'
  | 'PICKUP_SCHEDULED'
  | 'FAILED';

export interface ShippingAddressInput {
  fullName: string;
  phone: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
}

export interface ShopOrderItem {
  productId: number;
  productName: string;
  units: number;
  /** Charged price per unit (after any sale). */
  unitPrice: number;
  /** List price before the sale; absent or equal to unitPrice when there was no sale. */
  originalUnitPrice?: number | null;
  licenceRequired: boolean;
  storeProduct: boolean;
}

export interface ShopOrder {
  orderReference: string;
  userId: string | null;
  status: OrderStatus;
  /** Sum of items at charged prices (sale discounts already applied). */
  subtotal: number;
  voucherCode?: string | null;
  voucherDiscount?: number | null;
  /** subtotal − voucherDiscount (absent on older backends — use orderPayable). */
  total?: number | null;
  items: ShopOrderItem[];
  shippingAddress: ShippingAddressInput & { country: string };
  paidPaymentSubmissionId: number | null;
  paidAt: string | null;
  shipping: {
    status: ShippingStatus;
    awbCode: string | null;
    courierName: string | null;
    pickupScheduledDate: string | null;
    trackingUrl: string | null;
    shiprocketOrderId: number | null;
    shiprocketShipmentId: number | null;
    error: string | null;
    attempts: number | null;
    lastAttemptAt: string | null;
  };
  createdAt: string;
}

export interface SubscriptionDefinition {
  subscriptionDefinitionPkId: number;
  subscriptionName: string;
  subscriptionAmount: number;
  createdDatetime?: string;
}

export interface SupportTicket {
  supportTicketPkId: number | null;
  category: string;
  priority: string;
  userNodeId: string;
  message: string;
  status: string;
  updatedAtDateTime: string | null;
  userName?: string;
  createdDatetime?: string;
}
