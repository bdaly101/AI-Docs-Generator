import { FileChange } from './git-diff.js';
import { CodeEntity, ASTParser } from './ast-parser.js';
import fs from 'fs/promises';

export interface DocumentationChange {
  type: 'new-feature' | 'api-change' | 'breaking-change' | 'bugfix' | 'refactor';
  scope: 'readme' | 'api-docs' | 'jsdoc' | 'changelog';
  entity?: CodeEntity;
  file: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export class ChangeDetector {
  private parser = new ASTParser();

  async detectDocumentationNeeds(changes: FileChange[]): Promise<DocumentationChange[]> {
    const docChanges: DocumentationChange[] = [];

    for (const change of changes) {
      if (!this.isDocumentableFile(change.path)) {
        continue;
      }

      // For added/modified files, parse the current file content
      if (change.status === 'added' || change.status === 'modified') {
        try {
          const fileContent = await this.readFileContent(change.path);
          if (fileContent) {
            const entities = this.parser.parse(fileContent, change.path);

            for (const entity of entities) {
              // Check for new exports
              if (this.isNewExport(entity, change)) {
                docChanges.push({
                  type: 'new-feature',
                  scope: 'readme',
                  entity,
                  file: change.path,
                  description: `New exported ${entity.type}: ${entity.name}`,
                  priority: 'high',
                });
              }

              // Check for API changes (signature changes, parameter changes)
              if (this.isAPIChange(entity, change)) {
                docChanges.push({
                  type: 'api-change',
                  scope: 'api-docs',
                  entity,
                  file: change.path,
                  description: `API change in ${entity.name}`,
                  priority: 'high',
                });
              }

              // Check for missing JSDoc
              if (this.needsJSDoc(entity)) {
                docChanges.push({
                  type: 'new-feature',
                  scope: 'jsdoc',
                  entity,
                  file: change.path,
                  description: `Missing documentation for ${entity.name}`,
                  priority: 'medium',
                });
              }
            }
          }
        } catch (error) {
          // If file can't be read, skip it
          console.warn(`Could not read file ${change.path}:`, error);
        }
      }

      // For deleted files, mark as changelog entry
      if (change.status === 'deleted') {
        docChanges.push({
          type: 'refactor',
          scope: 'changelog',
          file: change.path,
          description: `Removed file: ${change.path}`,
          priority: 'medium',
        });
      }
    }

    return docChanges;
  }

  private isDocumentableFile(path: string): boolean {
    return /\.(ts|js|tsx|jsx)$/.test(path);
  }

  private async readFileContent(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  private isNewExport(entity: CodeEntity, change: FileChange): boolean {
    // New exports in added files or newly exported entities
    if (change.status === 'added' && entity.isExported) {
      return true;
    }

    // Check if this entity was newly exported (appears in diff as new export)
    if (change.status === 'modified' && entity.isExported) {
      // Simple heuristic: if the diff contains "export" and the entity name
      const hasExportKeyword = change.diff.includes('export');
      const hasEntityName = change.diff.includes(entity.name);
      return hasExportKeyword && hasEntityName;
    }

    return false;
  }

  private isAPIChange(entity: CodeEntity, change: FileChange): boolean {
    // API changes are modifications to exported functions/classes
    if (change.status !== 'modified' || !entity.isExported) {
      return false;
    }

    // Check if the diff shows changes to function signature, parameters, or return type
    const signatureKeywords = ['function', 'class', 'interface', 'type'];
    const hasSignatureKeyword = signatureKeywords.some((kw) =>
      change.diff.includes(kw)
    );

    // Check for parameter changes (lines with + or - before parameters)
    const hasParameterChanges =
      change.diff.includes('(') && (change.diff.includes('+') || change.diff.includes('-'));

    // Check for return type changes
    const hasReturnTypeChanges =
      change.diff.includes(':') && Boolean(entity.returnType);

    return hasSignatureKeyword && (hasParameterChanges || hasReturnTypeChanges);
  }

  private needsJSDoc(entity: CodeEntity): boolean {
    // Only exported entities need JSDoc
    if (!entity.isExported) {
      return false;
    }

    // Functions, classes, interfaces, and types should have JSDoc
    const needsDocTypes: CodeEntity['type'][] = ['function', 'class', 'interface', 'type'];
    if (!needsDocTypes.includes(entity.type)) {
      return false;
    }

    // Check if JSDoc is missing
    return !entity.jsdoc || entity.jsdoc.trim().length === 0;
  }
}

