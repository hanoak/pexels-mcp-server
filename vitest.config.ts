import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text'],
      include: ['src/**/*.ts'],
      exclude: [
        // Bin bootstrap: exercised end-to-end by the out-of-process
        // stdout-purity test, which in-process v8 coverage cannot observe.
        'src/index.ts',
      ],
      // Regression floor, set a few points below current coverage (89.97/
      // 88.68/84.5/91.21 as measured 2026-08-11). Raise as the suite grows;
      // a real drop fails CI (`npm run test:coverage`).
      thresholds: {
        statements: 85,
        branches: 83,
        functions: 79,
        lines: 86,
      },
    },
  },
})
