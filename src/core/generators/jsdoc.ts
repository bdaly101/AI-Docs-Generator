import fs from 'fs/promises';
import type { AIClient } from '../ai/client.js';
import type { ContextBuilder } from '../ai/context-builder.js';
import { SYSTEM_PROMPTS, PROMPT_TEMPLATES, type JSDocContext } from '../ai/prompts.js';
import { ASTParser, type CodeEntity } from '../analyzer/ast-parser.js';
import type { Config, JSDocUpdate } from '../../types/index.js';

/**
 * Generates JSDoc/TSDoc comments for code entities.
 */
export class JSDocGenerator {
  private parser = new ASTParser();

  constructor(
    private ai: AIClient,
    private contextBuilder: ContextBuilder,
    private config: Config['jsdoc']
  ) {}

  /**
   * Generate a JSDoc comment for a single code entity.
   */
  async generateComment(
    entity: CodeEntity,
    fileContent: string
  ): Promise<JSDocUpdate> {
    const context: JSDocContext = {
      code: this.extractEntityCode(entity, fileContent),
      signature: entity.signature ?? this.buildSignature(entity),
      style: this.config.style,
      existingComment: entity.jsdoc,
    };

    const prompt = PROMPT_TEMPLATES.jsdocComment(context);
    const comment = await this.ai.generate(prompt, SYSTEM_PROMPTS.jsdoc);

    return {
      file: entity.location ? '' : '', // Will be set by caller
      insertAt: entity.location?.start ?? 0,
      comment: this.formatComment(comment),
    };
  }

  /**
   * Process a file and generate JSDoc for all exported entities missing documentation.
   */
  async processFile(filePath: string): Promise<JSDocUpdate[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const entities = this.parser.parse(content, filePath);

    const updates: JSDocUpdate[] = [];

    for (const entity of entities) {
      // Only document exported entities without JSDoc
      if (entity.isExported && !entity.jsdoc) {
        // Skip certain types that typically don't need JSDoc
        if (this.shouldDocument(entity)) {
          const update = await this.generateComment(entity, content);
          update.file = filePath;
          updates.push(update);
        }
      }
    }

    return updates;
  }

  /**
   * Apply JSDoc updates to a file.
   */
  async applyUpdates(filePath: string, updates: JSDocUpdate[]): Promise<string> {
    let content = await fs.readFile(filePath, 'utf-8');

    // Sort updates by position descending so we don't mess up positions
    const sortedUpdates = [...updates].sort((a, b) => b.insertAt - a.insertAt);

    for (const update of sortedUpdates) {
      content = this.insertComment(content, update);
    }

    return content;
  }

  /**
   * Apply updates and write to file.
   */
  async applyAndWrite(filePath: string, updates: JSDocUpdate[]): Promise<void> {
    const content = await this.applyUpdates(filePath, updates);
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * Determine if an entity should have JSDoc.
   */
  private shouldDocument(entity: CodeEntity): boolean {
    // Always document functions and classes
    if (entity.type === 'function' || entity.type === 'class') {
      return true;
    }

    // Document interfaces and types if they're complex
    if (entity.type === 'interface' || entity.type === 'type') {
      return true;
    }

    // Skip simple variable exports
    if (entity.type === 'variable') {
      return false;
    }

    return false;
  }

  /**
   * Extract the code for an entity from file content.
   */
  private extractEntityCode(entity: CodeEntity, fileContent: string): string {
    if (!entity.location) {
      return '';
    }

    const { start, end } = entity.location;

    // Add some context before and after
    const lines = fileContent.split('\n');
    let charCount = 0;
    let startLine = 0;
    let endLine = lines.length - 1;

    for (let i = 0; i < lines.length; i++) {
      if (charCount <= start && start < charCount + lines[i].length + 1) {
        startLine = i;
      }
      if (charCount <= end && end < charCount + lines[i].length + 1) {
        endLine = i;
        break;
      }
      charCount += lines[i].length + 1;
    }

    return lines.slice(startLine, endLine + 1).join('\n');
  }

  /**
   * Build a signature string from entity info.
   */
  private buildSignature(entity: CodeEntity): string {
    if (entity.signature) {
      return entity.signature;
    }

    let sig = entity.name;

    if (entity.type === 'function') {
      if (entity.params) {
        const params = entity.params
          .map((p) => `${p.name}${p.optional ? '?' : ''}${p.type ? ': ' + p.type : ''}`)
          .join(', ');
        sig += `(${params})`;
      } else {
        sig += '()';
      }
      if (entity.returnType) {
        sig += `: ${entity.returnType}`;
      }
    } else if (entity.type === 'class') {
      sig = `class ${entity.name}`;
    } else if (entity.type === 'interface') {
      sig = `interface ${entity.name}`;
    } else if (entity.type === 'type') {
      sig = `type ${entity.name}`;
    }

    return sig;
  }

  /**
   * Format a comment to proper JSDoc style.
   */
  private formatComment(comment: string): string {
    const trimmed = comment.trim();

    // If it's already formatted, return as-is
    if (trimmed.startsWith('/**') && trimmed.endsWith('*/')) {
      return trimmed;
    }

    // Extract just the comment content
    let content = trimmed;

    // Remove any existing comment markers
    content = content.replace(/^\/\*\*?\s*/gm, '');
    content = content.replace(/\s*\*\/$/gm, '');
    content = content.replace(/^\s*\*\s?/gm, '');

    // Split into lines and format
    const lines = content.split('\n').filter((l) => l.trim());

    if (lines.length === 1) {
      return `/** ${lines[0]} */`;
    }

    const formatted = ['/**', ...lines.map((l) => ` * ${l}`), ' */'];
    return formatted.join('\n');
  }

  /**
   * Insert a JSDoc comment at the specified position.
   */
  private insertComment(content: string, update: JSDocUpdate): string {
    const { insertAt, comment } = update;

    // Find the line start for the insertion point
    const lines = content.split('\n');
    let charCount = 0;
    let lineIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      if (charCount + lines[i].length >= insertAt) {
        lineIndex = i;
        break;
      }
      charCount += lines[i].length + 1;
    }

    // Get indentation of the target line
    const targetLine = lines[lineIndex];
    const indentMatch = targetLine.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';

    // Indent the comment
    const indentedComment = comment
      .split('\n')
      .map((line) => indent + line)
      .join('\n');

    // Insert before the target line
    lines.splice(lineIndex, 0, indentedComment);

    return lines.join('\n');
  }
}

