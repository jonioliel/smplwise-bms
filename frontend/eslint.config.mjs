// CR-FE-GATES-2436 (review 07:F20, master plan T6): ESLint for src/, REPORT-ONLY. Every rule is a warning, so `npm run lint` prints
// the findings and their count and exits 0; CR-FE-GATES-ENFORCE fixes or baselines the reports and then turns them into errors.
//
// The rules the review asked for:
//   - @typescript-eslint/no-floating-promises: a promise nobody awaits or catches (a failed request that vanishes);
//   - @typescript-eslint/no-misused-promises: a promise where a boolean or a void callback is expected (an async event handler
//     whose rejection nobody sees, `if (promise)`);
//   - eslint-plugin-lit (recommended set): template mistakes Lit cannot report at run time (duplicate bindings, bad attribute
//     bindings, legacy syntax).
// Type-aware linting uses tsconfig.json through the project service (no second program to keep in step).
import tseslint from 'typescript-eslint';
import lit from 'eslint-plugin-lit';

const asWarnings = (rules) => Object.fromEntries(Object.entries(rules ?? {}).map(([k, v]) => [k, Array.isArray(v) ? ['warn', ...v.slice(1)] : 'warn']));
const litRecommended = lit.configs['flat/recommended'];

export default [
  { ignores: ['dist/**', 'node_modules/**', 'tests/**', 'scripts/**', '*.config.ts', '*.config.mjs', 'public/**'] },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    plugins: { '@typescript-eslint': tseslint.plugin, ...litRecommended.plugins },
    rules: {
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      ...asWarnings(litRecommended.rules),
    },
  },
];
