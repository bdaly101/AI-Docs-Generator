import { cosmiconfig } from 'cosmiconfig';
import { ConfigSchema } from './schema.js';
import type { Config } from '../types/index.js';

const explorer = cosmiconfig('aidocs', {
  searchPlaces: [
    '.aidocsrc.json',
    '.aidocsrc.yaml',
    '.aidocsrc.yml',
    '.aidocsrc.js',
    '.aidocsrc.cjs',
    'package.json',
  ],
});

export async function loadConfig(): Promise<Config> {
  const result = await explorer.search();
  const rawConfig = result?.config ?? {};
  return ConfigSchema.parse(rawConfig);
}

