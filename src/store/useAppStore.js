import { create } from 'zustand'

const useAppStore = create((set) => ({
  transactions: [],
  analysisResults: {},
  reviewState: {},
  selectedTxn: null,
  activeTab: 'dashboard',
  filters: { tier: 'all', department: 'all', flagType: 'all', dateRange: null },

  setTransactions: (transactions) => set({ transactions }),
  setAnalysisResults: (analysisResults) => set({ analysisResults }),
  updateReviewState: (txn_id, update) => set((state) => ({
    reviewState: {
      ...state.reviewState,
      [txn_id]: { ...state.reviewState[txn_id], ...update }
    }
  })),
  setSelectedTxn: (selectedTxn) => set({ selectedTxn }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
}))

export default useAppStore
