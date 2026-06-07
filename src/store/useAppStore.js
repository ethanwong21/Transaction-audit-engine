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

  companyData: null,
  companyTransactions: [],
  companyAnalysis: {},
  companyLoading: false,
  companyError: null,
  companyTicker: '',
  setCompanyData: (companyData) => set({ companyData }),
  setCompanyTransactions: (companyTransactions) => set({ companyTransactions }),
  setCompanyAnalysis: (companyAnalysis) => set({ companyAnalysis }),
  setCompanyLoading: (companyLoading) => set({ companyLoading }),
  setCompanyError: (companyError) => set({ companyError }),
  setCompanyTicker: (companyTicker) => set({ companyTicker })
}))

export default useAppStore
