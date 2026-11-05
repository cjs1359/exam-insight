import { defineConfig } from 'vite';
import { resolve } from 'path';
export default defineConfig({ base: '/exam-insight/', build: { rollupOptions: { input: { main: resolve(__dirname,'index.html'), review: resolve(__dirname,'review.html') } } } });
