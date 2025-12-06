/**
 * Shared TypeScript type definitions for AI-Docs-Generator
 */

// ============================================================================
// Configuration Types
// ============================================================================

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

// ============================================================================
// Generator Types
// ============================================================================

/**
 * Update to be applied to a README file.
 */
export interface ReadmeUpdate {
  /** Section name where content should be inserted */
  section: string;
  /** Generated markdown content */
  content: string;
  /** Section name to insert after (null for end of file) */
  insertAfter: string | null;
}

/**
 * Generated API documentation for an endpoint.
 */
export interface APIDoc {
  /** Output file path */
  path: string;
  /** Generated markdown content */
  content: string;
}

/**
 * Structured API documentation from AI.
 */
export interface APIDocStructure {
  method: string;
  path: string;
  description: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
    location: 'path' | 'query' | 'body';
  }>;
  requestBody?: {
    type: string;
    example: unknown;
  };
  responses: Array<{
    status: number;
    description: string;
    example?: unknown;
  }>;
}

/**
 * Update to add JSDoc/TSDoc comment to a file.
 */
export interface JSDocUpdate {
  /** File path to update */
  file: string;
  /** Character position to insert at */
  insertAt: number;
  /** Formatted JSDoc comment */
  comment: string;
}

/**
 * Changelog entries categorized by type.
 */
export interface ChangelogEntries {
  added?: string[];
  changed?: string[];
  fixed?: string[];
  removed?: string[];
  security?: string[];
}

/**
 * Update to be applied to changelog.
 */
export interface ChangelogUpdate {
  /** Version number */
  version: string;
  /** Release date (YYYY-MM-DD) */
  date: string;
  /** Categorized entries */
  entries: ChangelogEntries;
}

