import { z } from 'zod';
import type { Config } from '../types/index.js';

export const ConfigSchema = z.object({
  ai: z
    .object({
      provider: z.literal('anthropic').default('anthropic'),
      model: z.string().default('claude-sonnet-4-5-20250929'),
      apiKey: z.string().optional(), // Falls back to env var
    })
    .optional()
    .default(() => ({
      provider: 'anthropic' as const,
      model: 'claude-sonnet-4-5-20250929',
    })),
  readme: z
    .object({
      enabled: z.boolean().default(true),
      path: z.string().default('README.md'),
      sections: z.array(z.string()).default(['features', 'installation', 'usage']),
      updateOnNewFeature: z.boolean().default(true),
    })
    .optional()
    .default(() => ({
      enabled: true,
      path: 'README.md',
      sections: ['features', 'installation', 'usage'],
      updateOnNewFeature: true,
    })),
  apiDocs: z
    .object({
      enabled: z.boolean().default(true),
      outputPath: z.string().default('docs/api'),
      format: z.enum(['markdown', 'html']).default('markdown'),
      includeExamples: z.boolean().default(true),
    })
    .optional()
    .default(() => ({
      enabled: true,
      outputPath: 'docs/api',
      format: 'markdown' as const,
      includeExamples: true,
    })),
  jsdoc: z
    .object({
      enabled: z.boolean().default(true),
      style: z.enum(['jsdoc', 'tsdoc']).default('tsdoc'),
      includeTypes: z.boolean().default(true),
      includeExamples: z.boolean().default(false),
    })
    .optional()
    .default(() => ({
      enabled: true,
      style: 'tsdoc' as const,
      includeTypes: true,
      includeExamples: false,
    })),
  changelog: z
    .object({
      enabled: z.boolean().default(true),
      path: z.string().default('CHANGELOG.md'),
      format: z.enum(['keepachangelog', 'conventional']).default('keepachangelog'),
      groupBy: z.enum(['type', 'scope', 'date']).default('type'),
    })
    .optional()
    .default(() => ({
      enabled: true,
      path: 'CHANGELOG.md',
      format: 'keepachangelog' as const,
      groupBy: 'type' as const,
    })),
  ignore: z
    .array(z.string())
    .default(['node_modules/**', 'dist/**', '**/*.test.ts', '**/*.spec.ts']),
}) satisfies z.ZodType<Config>;

export type ConfigSchemaType = z.infer<typeof ConfigSchema>;

