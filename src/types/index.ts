/**
 * Shared TypeScript type definitions for AI-Docs-Generator
 */

export interface Config {
  ai: {
    provider: 'anthropic';
    model: string;
    apiKey?: string;
  };
  readme: {
    enabled: boolean;
    path: string;
    sections: string[];
    updateOnNewFeature: boolean;
  };
  apiDocs: {
    enabled: boolean;
    outputPath: string;
    format: 'markdown' | 'html';
    includeExamples: boolean;
  };
  jsdoc: {
    enabled: boolean;
    style: 'jsdoc' | 'tsdoc';
    includeTypes: boolean;
    includeExamples: boolean;
  };
  changelog: {
    enabled: boolean;
    path: string;
    format: 'keepachangelog' | 'conventional';
    groupBy: 'type' | 'scope' | 'date';
  };
  ignore: string[];
}

