import { Command } from 'commander';
import chokidar from 'chokidar';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig } from '../../config/loader.js';
import { GitDiffAnalyzer } from '../../core/analyzer/git-diff.js';
import { ChangeDetector } from '../../core/analyzer/change-detector.js';
import { AIClient } from '../../core/ai/client.js';
import { ContextBuilder } from '../../core/ai/context-builder.js';
import { ReadmeGenerator } from '../../core/generators/readme.js';
import { JSDocGenerator } from '../../core/generators/jsdoc.js';
import { debounce } from '../../utils/debounce.js';
import type { Config } from '../../types/index.js';

export const watchCommand = new Command('watch')
  .description('Watch for changes and auto-generate documentation')
  .option('--debounce <ms>', 'Debounce time in milliseconds', '2000')
  .action(async (options) => {
    const configSpinner = ora('Loading configuration...').start();

    try {
      const config = await loadConfig();
      configSpinner.succeed('Configuration loaded');

      console.log(chalk.blue('\n👀 Watching for changes...'));
      console.log(chalk.dim('   Press Ctrl+C to stop\n'));

      const changedFiles: Set<string> = new Set();

      // Create debounced processor
      const processChanges = debounce(async () => {
        const files = Array.from(changedFiles);
        changedFiles.clear();

        if (files.length === 0) return;

        console.log(chalk.yellow(`\nProcessing ${files.length} changed file(s)...`));
        await runGeneration(files, config);
      }, parseInt(options.debounce, 10));

      // Set up file watcher
      const watcher = chokidar.watch(['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'], {
        ignored: [
          ...config.ignore,
          '**/node_modules/**',
          '**/dist/**',
          '**/.git/**',
          '**/coverage/**',
        ],
        persistent: true,
        ignoreInitial: true,
        cwd: process.cwd(),
      });

      watcher.on('change', (filePath) => {
        console.log(chalk.dim(`  Changed: ${filePath}`));
        changedFiles.add(filePath);
        processChanges();
      });

      watcher.on('add', (filePath) => {
        console.log(chalk.dim(`  Added: ${filePath}`));
        changedFiles.add(filePath);
        processChanges();
      });

      watcher.on('error', (error) => {
        console.error(chalk.red('Watcher error:'), error);
      });

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n\nStopping watcher...'));
        watcher.close().then(() => {
          console.log(chalk.green('Watcher stopped.'));
          process.exit(0);
        });
      });

    } catch (error) {
      configSpinner.fail('Failed to start watcher');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

/**
 * Run documentation generation for changed files.
 */
async function runGeneration(files: string[], config: Config): Promise<void> {
  const spinner = ora('Analyzing changes...').start();

  try {
    const git = new GitDiffAnalyzer();
    const detector = new ChangeDetector();
    const ai = new AIClient(config.ai);
    const contextBuilder = new ContextBuilder();

    // Create file changes from the changed files
    const changes = files.map((filePath) => ({
      path: filePath,
      status: 'modified' as const,
      additions: 0,
      deletions: 0,
      diff: '', // Would need actual diff in real implementation
      hunks: [],
    }));

    const docNeeds = await detector.detectDocumentationNeeds(changes);
    spinner.succeed(`Found ${docNeeds.length} documentation update(s) needed`);

    if (docNeeds.length === 0) {
      console.log(chalk.dim('  No documentation updates needed.'));
      return;
    }

    const generators = {
      readme: new ReadmeGenerator(ai, contextBuilder, config.readme),
      jsdoc: new JSDocGenerator(ai, contextBuilder, config.jsdoc),
    };

    for (const need of docNeeds) {
      const genSpinner = ora(`Generating ${need.scope}...`).start();

      try {
        switch (need.scope) {
          case 'readme':
            if (config.readme.enabled) {
              const update = await generators.readme.generateSection(need);
              await generators.readme.applyUpdates([update]);
              genSpinner.succeed(`Updated README: ${update.section}`);
            } else {
              genSpinner.info('README generation disabled');
            }
            break;

          case 'jsdoc':
            if (config.jsdoc.enabled && need.entity) {
              const updates = await generators.jsdoc.processFile(need.file);
              if (updates.length > 0) {
                await generators.jsdoc.applyAndWrite(need.file, updates);
                genSpinner.succeed(`Added ${updates.length} JSDoc comment(s) to ${need.file}`);
              } else {
                genSpinner.info(`No JSDoc needed for ${need.file}`);
              }
            } else {
              genSpinner.info('JSDoc generation disabled or no entity');
            }
            break;

          default:
            genSpinner.info(`Skipping ${need.scope} (use 'aidocs generate' or 'aidocs sync' instead)`);
        }
      } catch (error) {
        genSpinner.fail(`Failed: ${need.scope}`);
        console.error(chalk.red(`  ${error instanceof Error ? error.message : String(error)}`));
      }
    }

    console.log(chalk.green('\n✓ Documentation updated\n'));
  } catch (error) {
    spinner.fail('Generation failed');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}
