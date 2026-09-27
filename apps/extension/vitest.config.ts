import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@sih26171/protocol': path.resolve(__dirname, '../../packages/protocol/src'),
      '@sih26171/privacy': path.resolve(__dirname, '../../packages/privacy/src'),
      '@sih26171/perception': path.resolve(__dirname, '../../packages/perception/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        '../../packages/protocol/src/**',
        '../../packages/privacy/src/**',
      ],
    },
  },
});
