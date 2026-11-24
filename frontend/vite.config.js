import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  optimizeDeps: {
    include: ['jspdf', 'jszip', 'exceljs']
  },
  plugins: [
    react(),
    tailwindcss()
  ],
})
