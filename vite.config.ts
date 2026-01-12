import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // <-- Agrega esto

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // <-- Agrega esto
  ],
})