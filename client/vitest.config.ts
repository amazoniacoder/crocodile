import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  cacheDir: 'node_modules/.vitest',
  test: {
    globals: true,
    environment: 'happy-dom',
    root: path.resolve(__dirname),
    pool: 'vmThreads',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/__tests__/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    testTimeout: 10000,
    hookTimeout: 10000,
    server: {
      deps: {
        inline: [
          '@csstools/css-calc',
          '@csstools/css-color-parser',
          '@csstools/css-parser-algorithms',
          '@csstools/css-tokenizer',
          '@csstools/color-helpers',
          '@asamuzakjp/css-color',
        ],
      },
    },
    deps: {
      optimizer: {
        web: {
          include: [
            '@asamuzakjp/css-color',
            '@csstools/css-calc',
          ],
        },
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      cleanOnRerun: false,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        'dist/',
        '**/__tests__/**',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
});