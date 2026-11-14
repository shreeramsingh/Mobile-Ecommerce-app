import { request, unwrapList, unwrapFirst } from './client';
import type { ApiProduct, Paged, Product, ProductImage } from './types';
import { timeAgo } from '../lib/format';

// ─── Mapping ──────────────────────────────────────────────────────────────────
export const mapProduct = (p: ApiProduct): Product => ({
  id: p.productPkId,
  images: (p.productImageList ?? [])
    .map((img) => img.profileImageUrl)
    .filter((u): u is string => !!u),
  price: Number(p.price),
  title: p.title,
  location: p.location || `${p.city || ''}, ${p.state || ''}`.replace(/^,\s*/, '').replace(/,\s*$/, ''),
  createdAt: p.createdDatetime,
  sellerId: p.sellerId,
  sellerName: p.sellerName,
  description: p.description,
  brand: p.brand || '',
  isNegotiable: p.negotiable,
  isStoreProduct: p.isStoreProduct,
  productQuantity: p.productQuantity,
  categoryId: p.categoryId,
  subcategoryId: p.subcategoryId,
  weaponCategoryFkId: p.weaponCategoryFkId,
  weaponTypeFkId: p.weaponTypeFkId,
  weaponSubTypeFkId: p.weaponSubTypeFkId,
  caliberFkId: p.caliberFkId,
  isLicenseRequired: p.isLicenseRequired,
  salePrice: p.salePrice ?? null,
  discountLabel: p.discountLabel ?? null,
});

/** True when a live sale makes the product cheaper than its list price. */
export const hasSale = (p: Product) => p.salePrice != null && Number(p.salePrice) < Number(p.price);

/** What the buyer pays per unit right now. */
export const effectivePrice = (p: Product) => (hasSale(p) ? Number(p.salePrice) : Number(p.price));

export const productAge = (p: Product) => timeAgo(p.createdAt);

/** null/0 quantity = out of stock; undefined = the API didn't send it (available). */
export const isOutOfStock = (p: Product) =>
  p.productQuantity === null || (p.productQuantity !== undefined && p.productQuantity <= 0);

export const stockLeftLabel = (p: Product): string | null =>
  typeof p.productQuantity === 'number' && p.productQuantity > 0
    ? `${p.productQuantity.toLocaleString('en-IN')} ${p.productQuantity === 1 ? 'item' : 'items'} left`
    : null;

export const isNewProduct = (p: Product) =>
  !!p.createdAt && Date.now() - new Date(p.createdAt).getTime() < 24 * 60 * 60 * 1000;

// ─── Queries ──────────────────────────────────────────────────────────────────
interface ListParams {
  page?: number;
  size?: number;
  /** Seller node id — filters to one seller's products. */
  sellerId?: string | null;
  /** The API returns one kind per call: store products or user listings. */
  isStoreProduct?: boolean;
  categoryId?: number;
  productId?: number;
  auth?: boolean;
}

async function getProducts({
  page = 0,
  size = 24,
  sellerId = null,
  isStoreProduct,
  categoryId,
  productId,
  auth = true,
}: ListParams): Promise<Paged<Product>> {
  const res = await request<{ data?: ApiProduct[]; count?: number }>('/api/users/getProduct', {
    auth,
    query: {
      page,
      size,
      filterBy: 'ACTIVE',
      inputPkId: productId ?? null,
      inputFkId: sellerId,
      searchValue: null,
      ...(categoryId != null ? { categoryId } : {}),
      ...(isStoreProduct !== undefined ? { isStoreProduct } : {}),
    },
  });
  const items = unwrapList<ApiProduct>(res).map(mapProduct);
  return { items, total: Number(res?.count ?? 0) };
}

export const productsApi = {
  list: getProducts,

  /** One page of the main feed (user listings), same as the website's home page. */
  feed: (page: number, size = 24) => getProducts({ page, size, isStoreProduct: false }),

  /**
   * getProduct has no weapon-category filter, so — like the website — fetch both
   * kinds and keep products whose weaponCategoryFkId matches.
   */
  async byWeaponCategory(weaponCategoryId: number, size = 200): Promise<Product[]> {
    const [listings, store] = await Promise.all([
      getProducts({ size, isStoreProduct: false, auth: false }),
      getProducts({ size, isStoreProduct: true, auth: false }),
    ]);
    return [...store.items, ...listings.items].filter(
      (p) => p.weaponCategoryFkId === weaponCategoryId,
    );
  },

  byCategory: (categoryId: number, size: number, isStoreProduct: boolean) =>
    getProducts({ categoryId, size, isStoreProduct, auth: false }).then((r) => r.items),

  bySeller: (sellerId: string, isStoreProduct: boolean, size = 50) =>
    getProducts({ sellerId, isStoreProduct, size }),

  async rawById(id: number): Promise<ApiProduct | null> {
    const res = await request('/api/users/getProduct', {
      auth: false,
      query: { filterBy: 'ACTIVE', page: 0, size: 1, inputPkId: id, inputFkId: null, searchValue: null },
    });
    return unwrapList<ApiProduct>(res).find((p) => p.productPkId === id) ?? null;
  },

  async byId(id: number): Promise<Product | null> {
    const raw = await productsApi.rawById(id);
    return raw ? mapProduct(raw) : null;
  },

  create: (body: ProductInput) =>
    request('/api/users/addProduct', { method: 'POST', body }).then(unwrapFirst),

  update: (id: number, body: Partial<ProductInput>) =>
    request(`/api/users/updateProduct/${id}`, { method: 'PUT', body }).then(unwrapFirst),

  remove: (id: number) =>
    request(`/api/users/deleteProduct/${id}`, { method: 'DELETE', responseType: 'none' }),
};

export interface ProductInput {
  title: string;
  description: string;
  categoryId?: number | null;
  subcategoryId?: number | null;
  price: number;
  isNegotiable: boolean;
  negotiable?: boolean;
  productQuantity?: number | null;
  sellerId: string;
  location: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  latitude: number | null;
  longitude: number | null;
  isStoreProduct?: boolean;
  isLicenseRequired?: boolean;
  weaponCategoryFkId?: number | null;
  weaponTypeFkId?: number | null;
  weaponSubTypeFkId?: number | null;
  caliberFkId?: number | null;
  productImageList: ProductImage[];
  [key: string]: unknown;
}
