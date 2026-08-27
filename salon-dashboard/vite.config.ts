import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // приложение живёт под /news/ внутри портала vest-smr.ru
  base: "/news/",
  plugins: [react()],
})
