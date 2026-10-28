import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'

export default defineConfig({
  // GitHub Pages project sites live under /<repo>/; the workflow sets VITE_BASE.
  base: process.env.VITE_BASE || '/',
  plugins: [vue(), vuetify({ autoImport: true })],
})