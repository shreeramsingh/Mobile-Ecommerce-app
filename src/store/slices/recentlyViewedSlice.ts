import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Product } from '../../api/types';

const MAX_ITEMS = 12;

interface RecentState {
  items: Product[];
}

const initialState: RecentState = { items: [] };

const recentlyViewedSlice = createSlice({
  name: 'recentlyViewed',
  initialState,
  reducers: {
    addRecentlyViewed(state, action: PayloadAction<Product>) {
      state.items = [action.payload, ...state.items.filter((p) => p.id !== action.payload.id)].slice(0, MAX_ITEMS);
    },
    removeRecentlyViewed(state, action: PayloadAction<number>) {
      state.items = state.items.filter((p) => p.id !== action.payload);
    },
    /** Swap stored copies for fresh ones without changing the order. */
    refreshRecentlyViewed(state, action: PayloadAction<Product[]>) {
      const byId = new Map(action.payload.map((p) => [p.id, p]));
      if (!state.items.some((p) => byId.has(p.id))) return;
      state.items = state.items.map((p) => (byId.has(p.id) ? { ...p, ...byId.get(p.id)! } : p));
    },
  },
});

export const { addRecentlyViewed, removeRecentlyViewed, refreshRecentlyViewed } = recentlyViewedSlice.actions;
export default recentlyViewedSlice.reducer;

export const selectRecentlyViewed = (s: { recentlyViewed: RecentState }) => s.recentlyViewed.items;
