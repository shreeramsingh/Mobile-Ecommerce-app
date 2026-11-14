import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Product } from '../api/types';

export type UserTabParamList = {
  Home: undefined;
  Wishlist: undefined;
  SellTab: undefined;
  Chats: undefined;
  Account: undefined;
};

export type AdminTabParamList = {
  AdminDashboard: undefined;
  AdminPayments: undefined;
  AdminStore: undefined;
  AdminMore: undefined;
};

export interface ChatParams {
  conversationId?: string;
  productId?: string;
  productTitle?: string;
  productImage?: string;
  sellerId?: string;
  sellerName?: string;
  /** The other person's name, from the conversation list. */
  peerName?: string;
  initialMessage?: string;
}

export type RootStackParamList = {
  UserTabs: NavigatorScreenParams<UserTabParamList> | undefined;
  AdminTabs: NavigatorScreenParams<AdminTabParamList> | undefined;
  SignIn: undefined;
  SignUp: undefined;
  ProductDetails: { id: number; product?: Product };
  Cart: undefined;
  Orders: undefined;
  Payments: undefined;
  Track: undefined;
  Chat: ChatParams;
  SellProduct: { productId?: number } | undefined;
  StoreProductForm: { product?: Product } | undefined;
  Store: { sellerId?: string; allowPosting?: boolean } | undefined;
  Profile: undefined;
  Support: undefined;
  Marketplace: undefined;
  AdminUsers: { status?: 'active' | 'inactive'; role?: 'admin' | 'normal' } | undefined;
  AdminSubscription: undefined;
  AdminListings: undefined;
  AdminPaymentMethods: undefined;
  AdminShipments: undefined;
  AdminDiscounts: undefined;
  AdminVouchers: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
