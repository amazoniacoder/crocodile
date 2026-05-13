import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['server/__tests__/**/*.test.ts'],
    testTimeout: 15000,
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
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
});
