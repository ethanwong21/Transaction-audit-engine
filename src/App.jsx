import React, { useEffect } from 'react'
import useAppStore from './store/useAppStore'
import TabBar from './components/TabBar'
import Dashboard from './views/Dashboard'
import ReviewQueue from './views/ReviewQueue'
import VendorRisk from './views/VendorRisk'
import ControlsTesting from './views/ControlsTesting'
import DataImport from './views/DataImport'
import { generateTransactions } from './data/generateData'
import { runAnomalyDetection } from './data/anomalyEngine'

export default function App() {
  const activeTab = useAppStore(s => s.activeTab)
  const setActiveTab = useAppStore(s => s.setActiveTab)
  const setTransactions = useAppStore(s => s.setTransactions)
  const setAnalysisResults = useAppStore(s => s.setAnalysisResults)
  const transactions = useAppStore(s => s.transactions)

  // Load demo data on first mount
  useEffect(() => {
    if (transactions.length === 0) {
      const txns = generateTransactions()
      const results = runAnomalyDetection(txns)
      setTransactions(txns)
      setAnalysisResults(results)
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    function handler(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'D' || e.key === 'd') setActiveTab('dashboard')
      if (e.key === 'R' || e.key === 'r') setActiveTab('review')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setActiveTab])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TabBar />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'review' && <ReviewQueue />}
        {activeTab === 'vendor' && <VendorRisk />}
        {activeTab === 'controls' && <ControlsTesting />}
        {activeTab === 'import' && <DataImport />}
      </div>
    </div>
  )
}
