import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
        headers: {
          'anthropic-dangerous-direct-browser-access': 'true'
        }
      },
      '/api/sec-tickers': {
        target: 'https://www.sec.gov',
        changeOrigin: true,
        rewrite: () => '/files/company_tickers.json'
      },
      '/api/sec-efts': {
        target: 'https://efts.sec.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/sec-efts/, '')
      },
      '/api/sec-data': {
        target: 'https://data.sec.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/sec-data/, '')
      }
    }
  }
})
