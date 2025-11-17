import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    // Enable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug']
      }
    },
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom'],
          'markdown-vendor': ['react-markdown', 'remark-gfm', 'rehype-raw', 'rehype-sanitize'],
          'syntax-highlighter': ['react-syntax-highlighter'],
          'icons': ['lucide-react'],
          'websocket': ['socket.io-client'],
          'state': ['zustand']
        },
        // Chunk naming for better caching
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // Increase chunk size warning limit (we're splitting chunks now)
    chunkSizeWarningLimit: 1000,
    // Source maps for production debugging (can be disabled for smaller builds)
    sourcemap: false,
    // Target modern browsers for better optimization
    target: 'es2020',
    // Optimize CSS
    cssCodeSplit: true,
    // Report bundle size
    reportCompressedSize: true
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-markdown',
      'socket.io-client',
      'zustand',
      'lucide-react'
    ],
    exclude: []
  }
});

