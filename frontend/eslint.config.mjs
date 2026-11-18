// CR-FE-GATES-2436 (review 07:F20, master plan T6): ESLint for src/.
// CR-FE-GATES-ENFORCE-2442: every rule is an ERROR, so `npm run lint` (and the gate) exits non-zero on a report. The 27 reports
// that existed when the rules became blocking are counted per file and rule in eslint-suppressions.json (ESLint's own bulk
// suppressions: `eslint src --suppress-all` wrote it); a report above a file's count fails. Fixing one and then running
// `npx eslint src --prune-suppressions` lowers the count. No new entry is added to that file without a reason in a change note.
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

const asErrors = (rules) => Object.fromEntries(Object.entries(rules ?? {}).map(([k, v]) => [k, Array.isArray(v) ? ['error', ...v.slice(1)] : 'error']));
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
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      ...asErrors(litRecommended.rules),
    },
  },
];
