import type { Config } from '../types/index.js';

export const defaultConfig: Config = {
  ai: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
  },
  readme: {
    enabled: true,
    path: 'README.md',
    sections: ['features', 'installation', 'usage'],
    updateOnNewFeature: true,
  },
  apiDocs: {
    enabled: true,
    outputPath: 'docs/api',
    format: 'markdown',
    includeExamples: true,
  },
  jsdoc: {
    enabled: true,
    style: 'tsdoc',
    includeTypes: true,
    includeExamples: false,
  },
  changelog: {
    enabled: true,
    path: 'CHANGELOG.md',
    format: 'keepachangelog',
    groupBy: 'type',
  },
  ignore: ['node_modules/**', 'dist/**', '**/*.test.ts', '**/*.spec.ts'],
};

