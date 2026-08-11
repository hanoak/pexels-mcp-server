import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'
import eslintConfigPrettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // MCP stdout purity: stdout carries the JSON-RPC stream, so nothing may be
      // written there. Only console.error (stderr) is permitted; prefer the logger.
      'no-console': ['error', { allow: ['error'] }],
      // Quality bar: no `any`.
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  eslintConfigPrettier,
)
