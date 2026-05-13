import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const apiUrl = env.VITE_API_URL || 'http://localhost:5000';
  const wsUrl = env.VITE_WS_URL || 'ws://localhost:5000';

  return {
    plugins: [react()],
    publicDir: 'public',
    css: {
      devSourcemap: true,
      preprocessorOptions: {
        css: {
          charset: false
        }
      },
      modules: {
        generateScopedName: '[name]__[local]___[hash:base64:5]'
      }
    },
    build: {
      cssCodeSplit: false,
      target: 'esnext',
      minify: 'esbuild',
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          assetFileNames: (assetInfo) => {
            if (assetInfo.name === 'sprite.svg') {
              return 'icons/sprite.svg';
            }
            return 'assets/[name]-[hash][extname]';
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        'components': path.resolve(__dirname, './src/styles/blocks')
      },
    },
    server: {
      port: 3000,
      host: true,
      cors: true,
      hmr: {
        overlay: false
      },
      proxy: {
        '/api': {
          target: apiUrl,
          changeOrigin: true,
          secure: false
        },
        '/ws': {
          target: wsUrl,
          ws: true
        }
      }
    }
  };
});