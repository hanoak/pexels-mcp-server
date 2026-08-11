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
      // Regression floor, set a few points below the suite's coverage when
      // first measured (89.97/88.68/84.5/91.21 as of the coverage-gate
      // commit; the suite has since grown past that, currently ~91/89/87/92
      // as of 2026-08-11). Raise the floor as the suite grows; a real drop
      // fails CI (`npm run test:coverage`).
      thresholds: {
        statements: 85,
        branches: 83,
        functions: 79,
        lines: 86,
      },
    },
  },
})
