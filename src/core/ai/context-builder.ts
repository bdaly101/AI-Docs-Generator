import fs from 'fs/promises';
import path from 'path';
import type { DocumentationChange } from '../analyzer/change-detector.js';
import type { FileChange, CommitInfo } from '../analyzer/git-diff.js';
import type { CodeEntity } from '../analyzer/ast-parser.js';
import type {
  FeatureContext,
  APIContext,
  JSDocContext,
  ChangelogContext,
} from './prompts.js';

/**
 * Builds context objects for AI prompts from code changes.
 */
export class ContextBuilder {
  private readmePath: string;
  private changelogPath: string;

  constructor(options?: { readmePath?: string; changelogPath?: string }) {
    this.readmePath = options?.readmePath ?? 'README.md';
    this.changelogPath = options?.changelogPath ?? 'CHANGELOG.md';
  }

  /**
   * Build context for README feature documentation.
   */
  async buildReadmeContext(change: DocumentationChange): Promise<FeatureContext> {
    let fileContent = '';
    try {
      fileContent = await fs.readFile(change.file, 'utf-8');
    } catch {
      // File might not exist or be readable
    }

    const existingReadme = await this.loadExistingReadme();
    const existingSections = this.extractSections(existingReadme);

    return {
      name: change.entity?.name ?? 'Unknown',
      file: change.file,
      code: change.entity
        ? this.extractRelevantCode(fileContent, change.entity)
        : fileContent.slice(0, 2000),
      existingSections,
    };
  }

  /**
   * Build context for API endpoint documentation.
   */
  async buildAPIContext(change: DocumentationChange): Promise<APIContext> {
    let fileContent = '';
    try {
      fileContent = await fs.readFile(change.file, 'utf-8');
    } catch {
      // File might not exist or be readable
    }

    // Try to extract HTTP method and path from common patterns
    const methodMatch = fileContent.match(
      /\.(get|post|put|patch|delete|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/i
    );

    return {
      method: methodMatch?.[1]?.toUpperCase() ?? 'GET',
      path: methodMatch?.[2] ?? '/',
      code: change.entity
        ? this.extractRelevantCode(fileContent, change.entity)
        : fileContent.slice(0, 2000),
      handlerName: change.entity?.name,
    };
  }

  /**
   * Build context for JSDoc/TSDoc comment generation.
   */
  async buildJSDocContext(
    change: DocumentationChange,
    style: 'jsdoc' | 'tsdoc' = 'tsdoc'
  ): Promise<JSDocContext> {
    let fileContent = '';
    try {
      fileContent = await fs.readFile(change.file, 'utf-8');
    } catch {
      // File might not exist or be readable
    }

    return {
      code: change.entity
        ? this.extractRelevantCode(fileContent, change.entity)
        : '',
      signature: this.buildSignature(change.entity),
      style,
      existingComment: change.entity?.jsdoc,
    };
  }

  /**
   * Build context for changelog generation.
   */
  async buildChangelogContext(
    commits: CommitInfo[],
    changes: FileChange[]
  ): Promise<ChangelogContext> {
    const previousVersion = await this.getLastVersion();

    return {
      commits,
      changedFiles: changes.map((c) => c.path),
      previousVersion,
    };
  }

  /**
   * Load the existing README file content.
   */
  private async loadExistingReadme(): Promise<string> {
    try {
      return await fs.readFile(this.readmePath, 'utf-8');
    } catch {
      return '';
    }
  }

  /**
   * Extract section headings from markdown content.
   */
  private extractSections(markdown: string): string[] {
    const headingRegex = /^#{1,3}\s+(.+)$/gm;
    const sections: string[] = [];
    let match;

    while ((match = headingRegex.exec(markdown)) !== null) {
      sections.push(match[1].trim());
    }

    return sections;
  }

  /**
   * Extract relevant code around an entity.
   */
  private extractRelevantCode(fileContent: string, entity: CodeEntity): string {
    if (!entity.location) {
      return fileContent.slice(0, 2000);
    }

    const { start, end } = entity.location;
    const lines = fileContent.split('\n');

    // Find line numbers from character positions
    let charCount = 0;
    let startLine = 0;
    let endLine = lines.length - 1;

    for (let i = 0; i < lines.length; i++) {
      if (charCount <= start && start < charCount + lines[i].length + 1) {
        startLine = Math.max(0, i - 2); // Include 2 lines before for context
      }
      if (charCount <= end && end < charCount + lines[i].length + 1) {
        endLine = Math.min(lines.length - 1, i + 2); // Include 2 lines after
        break;
      }
      charCount += lines[i].length + 1; // +1 for newline
    }

    return lines.slice(startLine, endLine + 1).join('\n');
  }

  /**
   * Build a signature string from a code entity.
   */
  private buildSignature(entity?: CodeEntity): string {
    if (!entity) {
      return '';
    }

    if (entity.signature) {
      return entity.signature;
    }

    // Build signature from available info
    let signature = '';

    if (entity.type === 'function') {
      signature = entity.name;
      if (entity.params) {
        const params = entity.params
          .map((p) => `${p.name}${p.optional ? '?' : ''}${p.type ? ': ' + p.type : ''}`)
          .join(', ');
        signature += `(${params})`;
      } else {
        signature += '()';
      }
      if (entity.returnType) {
        signature += `: ${entity.returnType}`;
      }
    } else if (entity.type === 'class') {
      signature = `class ${entity.name}`;
    } else if (entity.type === 'interface') {
      signature = `interface ${entity.name}`;
    } else if (entity.type === 'type') {
      signature = `type ${entity.name}`;
    } else {
      signature = entity.name;
    }

    return signature;
  }

  /**
   * Get the last version from the changelog.
   */
  private async getLastVersion(): Promise<string | undefined> {
    try {
      const changelog = await fs.readFile(this.changelogPath, 'utf-8');
      // Match version patterns like [1.0.0], [v1.0.0], ## 1.0.0
      const versionMatch = changelog.match(/\[?v?(\d+\.\d+\.\d+)\]?/);
      return versionMatch?.[1];
    } catch {
      return undefined;
    }
  }
}

