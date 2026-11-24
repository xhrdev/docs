import { config } from '@skilbjo/config-rc';

export default [
  {
    ignores: [
      'dist/',
      'dist0/',
      'cdk.out/',
      'target/',
      'scripts/generate-openapi-string.js',
      'scripts/replace-imports.js',
      'sdk/spec-generated.ts',
      'sdk/openapi.ts',
      '.vitepress/dist/',
      '.vitepress/cache/',
    ],
  },
  ...config,
  {
    files: ['**/*.ts', '**/*.mts', '**/*.cts', '**/*.tsx'],
    rules: {
      'n/no-unpublished-import': 'off',
    },
  },
];
