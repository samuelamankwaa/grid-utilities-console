import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface FiltersState {
  startDate: string | null;
  endDate: string | null;
  generalForeman: string;
  foreman: string[];
  workOrderNumbers: string[];
  area: string;
  status: string;
}

const initialState: FiltersState = {
  startDate: null,
  endDate: null,
  generalForeman: 'All crews',
  foreman: [],
  workOrderNumbers: [],
  area: 'All areas',
  status: 'All statuses',
};

const filtersSlice = createSlice({
  name: 'filters',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<Partial<FiltersState>>) => {
      return { ...state, ...action.payload };
    },
    resetFilters: () => initialState,
  },
});

export const { setFilters, resetFilters } = filtersSlice.actions;
export default filtersSlice.reducer;
