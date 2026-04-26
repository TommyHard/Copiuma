import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 3000,
        proxy: {
            '/api': {
                target: process.env.VITE_GATEWAY_URL || 'http://127.0.0.1:7161',
                changeOrigin: true,
                rewrite: (p) => p.replace(/^\/api/, ''),
            },
            '/identity': {
                target: process.env.VITE_IDENTITY_URL || 'http://127.0.0.1:5001',
                changeOrigin: true,
                rewrite: (p) => p.replace(/^\/identity/, ''),
            },
        },
    },
});