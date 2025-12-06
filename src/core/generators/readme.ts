import fs from 'fs/promises';
import type { AIClient } from '../ai/client.js';
import type { ContextBuilder } from '../ai/context-builder.js';
import { SYSTEM_PROMPTS, PROMPT_TEMPLATES } from '../ai/prompts.js';
import type { DocumentationChange } from '../analyzer/change-detector.js';
import type { Config, ReadmeUpdate } from '../../types/index.js';
import type { FeatureContext } from '../ai/prompts.js';

/**
 * Generates and updates README documentation from code changes.
 */
export class ReadmeGenerator {
  constructor(
    private ai: AIClient,
    private contextBuilder: ContextBuilder,
    private config: Config['readme']
  ) {}

  /**
   * Generate a README section for a documentation change.
   */
  async generateSection(change: DocumentationChange): Promise<ReadmeUpdate> {
    const context = await this.contextBuilder.buildReadmeContext(change);
    const prompt = PROMPT_TEMPLATES.readmeFeature(context);

    const content = await this.ai.generate(prompt, SYSTEM_PROMPTS.readme);

    return {
      section: this.determineBestSection(change, context),
      content: content.trim(),
      insertAfter: this.findInsertionPoint(context),
    };
  }

  /**
   * Apply multiple updates to the README file.
   */
  async updateReadme(updates: ReadmeUpdate[]): Promise<string> {
    let readme: string;
    try {
      readme = await fs.readFile(this.config.path, 'utf-8');
    } catch {
      // Create new README if it doesn't exist
      readme = `# Project\n\n`;
    }

    for (const update of updates) {
      readme = this.insertSection(readme, update);
    }

    return readme;
  }

  /**
   * Apply updates and write to file.
   */
  async applyUpdates(updates: ReadmeUpdate[]): Promise<void> {
    const content = await this.updateReadme(updates);
    await fs.writeFile(this.config.path, content, 'utf-8');
  }

  /**
   * Determine which section the new content belongs in.
   */
  private determineBestSection(
    change: DocumentationChange,
    context: FeatureContext
  ): string {
    // Check if there's an obvious match with existing sections
    const lowerSections = context.existingSections.map((s) => s.toLowerCase());

    if (change.type === 'new-feature') {
      if (lowerSections.includes('features')) return 'Features';
      if (lowerSections.includes('api')) return 'API';
      return 'Features';
    }

    if (change.type === 'api-change') {
      if (lowerSections.includes('api')) return 'API';
      if (lowerSections.includes('api reference')) return 'API Reference';
      return 'API';
    }

    if (change.type === 'breaking-change') {
      if (lowerSections.includes('breaking changes')) return 'Breaking Changes';
      if (lowerSections.includes('migration')) return 'Migration';
      return 'Breaking Changes';
    }

    // Default to usage section
    if (lowerSections.includes('usage')) return 'Usage';
    return 'Usage';
  }

  /**
   * Find where to insert the new section.
   */
  private findInsertionPoint(context: FeatureContext): string | null {
    const sections = context.existingSections;

    // Standard README section order
    const sectionOrder = [
      'Installation',
      'Quick Start',
      'Usage',
      'Features',
      'API',
      'API Reference',
      'Configuration',
      'Examples',
      'Contributing',
      'License',
    ];

    // Find the last section that should come before our target
    for (let i = sectionOrder.length - 1; i >= 0; i--) {
      const section = sectionOrder[i];
      if (sections.some((s) => s.toLowerCase() === section.toLowerCase())) {
        return section;
      }
    }

    return null; // Insert at end
  }

  /**
   * Insert a section into the README content.
   */
  private insertSection(readme: string, update: ReadmeUpdate): string {
    const sectionHeader = `## ${update.section}`;
    const newContent = `${sectionHeader}\n\n${update.content}\n`;

    // Check if section already exists
    const sectionRegex = new RegExp(`^## ${update.section}\\s*$`, 'im');
    if (sectionRegex.test(readme)) {
      // Append to existing section
      return readme.replace(sectionRegex, (match) => {
        return `${match}\n\n${update.content}`;
      });
    }

    // Find insertion point
    if (update.insertAfter) {
      const insertRegex = new RegExp(
        `(^## ${update.insertAfter}.*?)(?=\\n## |$)`,
        'ims'
      );
      const match = readme.match(insertRegex);
      if (match) {
        const insertPos = (match.index ?? 0) + match[0].length;
        return (
          readme.slice(0, insertPos) +
          '\n\n' +
          newContent +
          readme.slice(insertPos)
        );
      }
    }

    // Append to end
    return readme.trim() + '\n\n' + newContent;
  }
}

