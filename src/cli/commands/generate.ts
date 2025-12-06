import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import fs from 'fs/promises';
import { loadConfig } from '../../config/loader.js';
import { GitDiffAnalyzer } from '../../core/analyzer/git-diff.js';
import { ChangeDetector, type DocumentationChange } from '../../core/analyzer/change-detector.js';
import { AIClient } from '../../core/ai/client.js';
import { ContextBuilder } from '../../core/ai/context-builder.js';
import { ReadmeGenerator } from '../../core/generators/readme.js';
import { APIDocsGenerator } from '../../core/generators/api-docs.js';
import { JSDocGenerator } from '../../core/generators/jsdoc.js';
import type { JSDocUpdate } from '../../types/index.js';

export const generateCommand = new Command('generate')
  .description('Generate documentation from recent changes')
  .option('--since <ref>', 'Generate from changes since this ref', 'HEAD~1')
  .option('--readme', 'Only update README')
  .option('--api', 'Only update API docs')
  .option('--jsdoc', 'Only add JSDoc comments')
  .option('--dry-run', 'Show what would be generated without writing')
  .action(async (options) => {
    const spinner = ora('Loading configuration...').start();

    try {
      const config = await loadConfig();
      const git = new GitDiffAnalyzer();
      const detector = new ChangeDetector();
      const ai = new AIClient(config.ai);
      const contextBuilder = new ContextBuilder();

      spinner.text = 'Analyzing changes...';
      const changes = await git.getChangesSince(options.since);
      const docNeeds = await detector.detectDocumentationNeeds(changes);

      spinner.succeed(`Found ${docNeeds.length} documentation updates needed`);

      if (docNeeds.length === 0) {
        console.log(chalk.yellow('\nNo documentation updates needed.'));
        return;
      }

      const generators = {
        readme: new ReadmeGenerator(ai, contextBuilder, config.readme),
        api: new APIDocsGenerator(ai, contextBuilder, config.apiDocs),
        jsdoc: new JSDocGenerator(ai, contextBuilder, config.jsdoc),
      };

      // Group JSDoc updates by file for batch processing
      const jsdocUpdatesByFile = new Map<string, JSDocUpdate[]>();

      for (const need of docNeeds) {
        // Filter by scope if options specified
        if (options.readme && need.scope !== 'readme') continue;
        if (options.api && need.scope !== 'api-docs') continue;
        if (options.jsdoc && need.scope !== 'jsdoc') continue;

        const genSpinner = ora(`Generating ${need.scope} for ${need.entity?.name || need.file}...`).start();

        try {
          switch (need.scope) {
            case 'readme':
              await handleReadmeGeneration(generators.readme, need, options.dryRun, genSpinner);
              break;

            case 'api-docs':
              await handleAPIDocGeneration(generators.api, need, options.dryRun, genSpinner);
              break;

            case 'jsdoc':
              await handleJSDocGeneration(generators.jsdoc, need, jsdocUpdatesByFile, genSpinner);
              break;

            case 'changelog':
              // Changelog is handled separately via sync command
              genSpinner.info(`Changelog update: ${need.description}`);
              break;
          }
        } catch (error) {
          genSpinner.fail(`Failed: ${need.entity?.name || need.file}`);
          console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        }
      }

      // Apply batched JSDoc updates
      if (jsdocUpdatesByFile.size > 0 && !options.dryRun) {
        const jsdocSpinner = ora('Applying JSDoc updates...').start();
        for (const [filePath, updates] of jsdocUpdatesByFile) {
          try {
            await generators.jsdoc.applyAndWrite(filePath, updates);
            jsdocSpinner.succeed(`Applied ${updates.length} JSDoc comments to ${filePath}`);
          } catch (error) {
            jsdocSpinner.fail(`Failed to apply JSDoc to ${filePath}`);
            console.error(chalk.red(error instanceof Error ? error.message : String(error)));
          }
        }
      }

      console.log(chalk.green('\n✓ Documentation generation complete'));
    } catch (error) {
      spinner.fail('Generation failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

/**
 * Handle README section generation.
 */
async function handleReadmeGeneration(
  generator: ReadmeGenerator,
  need: DocumentationChange,
  dryRun: boolean,
  spinner: ReturnType<typeof ora>
): Promise<void> {
  const readmeUpdate = await generator.generateSection(need);

  if (dryRun) {
    spinner.info(`Would update README section: ${readmeUpdate.section}`);
    console.log(chalk.dim('\n--- Preview ---'));
    console.log(readmeUpdate.content);
    console.log(chalk.dim('--- End Preview ---\n'));
  } else {
    await generator.applyUpdates([readmeUpdate]);
    spinner.succeed(`Updated README: ${readmeUpdate.section}`);
  }
}

/**
 * Handle API documentation generation.
 */
async function handleAPIDocGeneration(
  generator: APIDocsGenerator,
  need: DocumentationChange,
  dryRun: boolean,
  spinner: ReturnType<typeof ora>
): Promise<void> {
  const apiDoc = await generator.generateEndpointDoc(need);

  if (dryRun) {
    spinner.info(`Would generate API doc: ${apiDoc.path}`);
    console.log(chalk.dim('\n--- Preview ---'));
    console.log(apiDoc.content);
    console.log(chalk.dim('--- End Preview ---\n'));
  } else {
    await fs.writeFile(apiDoc.path, apiDoc.content, 'utf-8');
    spinner.succeed(`Generated API doc: ${apiDoc.path}`);
  }
}

/**
 * Handle JSDoc comment generation.
 */
async function handleJSDocGeneration(
  generator: JSDocGenerator,
  need: DocumentationChange,
  updatesByFile: Map<string, JSDocUpdate[]>,
  spinner: ReturnType<typeof ora>
): Promise<void> {
  if (!need.entity) {
    spinner.warn('No entity for JSDoc generation');
    return;
  }

  const fileContent = await fs.readFile(need.file, 'utf-8');
  const jsdocUpdate = await generator.generateComment(need.entity, fileContent);
  jsdocUpdate.file = need.file;

  // Group updates by file
  if (!updatesByFile.has(need.file)) {
    updatesByFile.set(need.file, []);
  }
  updatesByFile.get(need.file)!.push(jsdocUpdate);

  spinner.succeed(`Queued JSDoc for: ${need.entity.name}`);
}
