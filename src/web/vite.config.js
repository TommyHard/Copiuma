import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import path from 'node:path';
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        svgr()
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 3000,
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:7161',
                changeOrigin: true,
                secure: false,
                ws: true
            },
            '/identity': {
                target: process.env.VITE_IDENTITY_URL || 'http://127.0.0.1:5001',
                changeOrigin: true,
                rewrite: function (p) { return p.replace(/^\/identity/, ''); },
            },
        },
    },
});
