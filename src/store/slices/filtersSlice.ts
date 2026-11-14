import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

// Search + city filter shared by the header and the home feed.
interface FiltersState {
  searchQuery: string;
  selectedCity: string;
}

const initialState: FiltersState = { searchQuery: '', selectedCity: '' };

const filtersSlice = createSlice({
  name: 'filters',
  initialState,
  reducers: {
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    setSelectedCity(state, action: PayloadAction<string>) {
      state.selectedCity = action.payload === 'All India' ? '' : action.payload;
    },
  },
});

export const { setSearchQuery, setSelectedCity } = filtersSlice.actions;
export default filtersSlice.reducer;

type WithFilters = { filters: FiltersState };
export const selectSearchQuery = (s: WithFilters) => s.filters.searchQuery;
export const selectSelectedCity = (s: WithFilters) => s.filters.selectedCity;
