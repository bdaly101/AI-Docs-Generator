import fs from 'fs/promises';
import path from 'path';
import type { AIClient } from '../ai/client.js';
import type { ContextBuilder } from '../ai/context-builder.js';
import { SYSTEM_PROMPTS, PROMPT_TEMPLATES, API_DOC_SCHEMA } from '../ai/prompts.js';
import type { DocumentationChange } from '../analyzer/change-detector.js';
import type { Config, APIDoc, APIDocStructure } from '../../types/index.js';

/**
 * Generates API documentation for endpoints.
 */
export class APIDocsGenerator {
  constructor(
    private ai: AIClient,
    private contextBuilder: ContextBuilder,
    private config: Config['apiDocs']
  ) {}

  /**
   * Generate documentation for a single endpoint.
   */
  async generateEndpointDoc(change: DocumentationChange): Promise<APIDoc> {
    const context = await this.contextBuilder.buildAPIContext(change);
    const prompt = PROMPT_TEMPLATES.apiEndpoint(context);

    const docContent = await this.ai.generateWithStructure<APIDocStructure>(
      prompt,
      SYSTEM_PROMPTS.apiDocs,
      API_DOC_SCHEMA
    );

    const markdown = this.formatEndpointDoc(docContent);

    return {
      path: this.getOutputPath(context.method, context.path),
      content: markdown,
    };
  }

  /**
   * Generate an index file linking all endpoint docs.
   */
  async generateIndex(endpoints: APIDoc[]): Promise<string> {
    const lines = [
      '# API Reference',
      '',
      'This document provides an overview of all available API endpoints.',
      '',
      '## Endpoints',
      '',
    ];

    // Group endpoints by path prefix
    const grouped = new Map<string, APIDoc[]>();
    for (const endpoint of endpoints) {
      const prefix = this.getPathPrefix(endpoint.path);
      if (!grouped.has(prefix)) {
        grouped.set(prefix, []);
      }
      grouped.get(prefix)!.push(endpoint);
    }

    for (const [prefix, docs] of grouped) {
      lines.push(`### ${prefix || 'Root'}`);
      lines.push('');
      for (const doc of docs) {
        const relativePath = path.relative(this.config.outputPath, doc.path);
        lines.push(`- [${relativePath}](./${relativePath})`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Write all endpoint docs and index to files.
   */
  async writeAll(endpoints: APIDoc[]): Promise<void> {
    // Ensure output directory exists
    await fs.mkdir(this.config.outputPath, { recursive: true });

    // Write each endpoint doc
    for (const endpoint of endpoints) {
      const fullPath = path.join(this.config.outputPath, endpoint.path);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, endpoint.content, 'utf-8');
    }

    // Write index
    const indexContent = await this.generateIndex(endpoints);
    await fs.writeFile(
      path.join(this.config.outputPath, 'README.md'),
      indexContent,
      'utf-8'
    );
  }

  /**
   * Format structured API doc as markdown.
   */
  private formatEndpointDoc(doc: APIDocStructure): string {
    const lines = [
      `# ${doc.method} ${doc.path}`,
      '',
      doc.description,
      '',
    ];

    // Parameters
    if (doc.parameters && doc.parameters.length > 0) {
      lines.push('## Parameters');
      lines.push('');
      lines.push('| Name | Type | Required | Location | Description |');
      lines.push('|------|------|----------|----------|-------------|');
      for (const param of doc.parameters) {
        lines.push(
          `| ${param.name} | \`${param.type}\` | ${param.required ? 'Yes' : 'No'} | ${param.location} | ${param.description} |`
        );
      }
      lines.push('');
    }

    // Request Body
    if (doc.requestBody) {
      lines.push('## Request Body');
      lines.push('');
      lines.push(`Type: \`${doc.requestBody.type}\``);
      lines.push('');
      if (doc.requestBody.example) {
        lines.push('```json');
        lines.push(JSON.stringify(doc.requestBody.example, null, 2));
        lines.push('```');
        lines.push('');
      }
    }

    // Responses
    if (doc.responses && doc.responses.length > 0) {
      lines.push('## Responses');
      lines.push('');
      for (const response of doc.responses) {
        lines.push(`### ${response.status}`);
        lines.push('');
        lines.push(response.description);
        lines.push('');
        if (response.example) {
          lines.push('```json');
          lines.push(JSON.stringify(response.example, null, 2));
          lines.push('```');
          lines.push('');
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate output path for an endpoint doc.
   */
  private getOutputPath(method: string, apiPath: string): string {
    // Convert /users/:id to users-id.md
    const sanitized = apiPath
      .replace(/^\//, '')
      .replace(/\//g, '-')
      .replace(/:/g, '')
      .replace(/[^a-z0-9-]/gi, '-');

    return `${method.toLowerCase()}-${sanitized}.md`;
  }

  /**
   * Get the prefix of an API path for grouping.
   */
  private getPathPrefix(filePath: string): string {
    const parts = filePath.split('-');
    if (parts.length > 2) {
      return parts.slice(0, 2).join('/');
    }
    return parts[0] || '';
  }
}

