import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: [
        'app/api/**/*.ts',
        'lib/**/*.ts',
      ],
      exclude: [
        'lib/auth.ts',
        'lib/auth.config.ts',
        'lib/prisma.ts',
        'lib/redis.ts',
        'app/api/auth/**',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
