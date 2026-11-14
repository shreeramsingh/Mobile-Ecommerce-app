import { createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface CartItem {
  /** Product id as a string (same as the website's cart). */
  id: string;
  title: string;
  /** Unit price the buyer pays (the sale price when a sale is live). */
  price: number;
  /** List price before any sale, for showing the saving. */
  originalPrice?: number;
  image?: string;
  location: string;
  quantity: number;
}

interface CartState {
  items: CartItem[];
}

const initialState: CartState = { items: [] };

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart(state, action: PayloadAction<Omit<CartItem, 'quantity'>>) {
      const existing = state.items.find((i) => i.id === action.payload.id);
      if (existing) {
        existing.quantity += 1;
        // Keep the latest price (a sale may have started or ended).
        existing.price = action.payload.price;
        existing.originalPrice = action.payload.originalPrice;
      }
      else state.items.push({ ...action.payload, quantity: 1 });
    },
    removeFromCart(state, action: PayloadAction<string>) {
      state.items = state.items.filter((i) => i.id !== action.payload);
    },
    clearCart(state) {
      state.items = [];
    },
  },
});

export const { addToCart, removeFromCart, clearCart } = cartSlice.actions;
export default cartSlice.reducer;

type WithCart = { cart: CartState };
export const selectCartItems = (s: WithCart) => s.cart.items;
export const selectCartCount = createSelector(selectCartItems, (items) => items.reduce((n, i) => n + i.quantity, 0));
export const selectCartTotal = createSelector(selectCartItems, (items) =>
  items.reduce((n, i) => n + i.price * i.quantity, 0),
);
export const selectIsInCart = (id: string) => (s: WithCart) => s.cart.items.some((i) => i.id === id);
