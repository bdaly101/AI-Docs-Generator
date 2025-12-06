import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import fs from 'fs/promises';
import { simpleGit } from 'simple-git';
import { loadConfig } from '../../config/loader.js';
import { AIClient } from '../../core/ai/client.js';
import { ContextBuilder } from '../../core/ai/context-builder.js';
import { ChangelogGenerator } from '../../core/generators/changelog.js';

export const syncCommand = new Command('sync')
  .description('Sync CHANGELOG.md from commits')
  .argument('[since]', 'Sync commits since this ref (tag, commit, or branch)', 'latest-tag')
  .option('--version <version>', 'Specify version number')
  .option('--dry-run', 'Show changelog without writing')
  .action(async (since, options) => {
    const spinner = ora('Loading configuration...').start();

    try {
      const config = await loadConfig();

      if (!config.changelog.enabled) {
        spinner.warn('Changelog generation is disabled in config');
        return;
      }

      const ai = new AIClient(config.ai);
      const contextBuilder = new ContextBuilder();
      const generator = new ChangelogGenerator(ai, contextBuilder, config.changelog);

      // Resolve 'latest-tag' to actual tag
      spinner.text = 'Resolving reference...';
      const resolvedSince = since === 'latest-tag' 
        ? await getLatestTag() 
        : since;

      spinner.text = `Analyzing commits since ${resolvedSince}...`;
      const update = await generator.syncFromCommits(resolvedSince);

      // Allow version override
      if (options.version) {
        update.version = options.version;
      }

      spinner.succeed(`Generated changelog for version ${update.version}`);

      // Show summary
      console.log(chalk.dim('\n--- Changelog Summary ---'));
      if (update.entries.added?.length) {
        console.log(chalk.green(`  Added: ${update.entries.added.length} item(s)`));
      }
      if (update.entries.changed?.length) {
        console.log(chalk.yellow(`  Changed: ${update.entries.changed.length} item(s)`));
      }
      if (update.entries.fixed?.length) {
        console.log(chalk.blue(`  Fixed: ${update.entries.fixed.length} item(s)`));
      }
      if (update.entries.removed?.length) {
        console.log(chalk.red(`  Removed: ${update.entries.removed.length} item(s)`));
      }
      if (update.entries.security?.length) {
        console.log(chalk.magenta(`  Security: ${update.entries.security.length} item(s)`));
      }
      console.log(chalk.dim('-------------------------\n'));

      // Generate full changelog content
      const content = await generator.updateChangelog(update);

      if (options.dryRun) {
        console.log(chalk.yellow('--- Dry Run Output ---\n'));
        console.log(content);
        console.log(chalk.yellow('\n--- End Dry Run ---'));
      } else {
        await fs.writeFile(config.changelog.path, content, 'utf-8');
        console.log(chalk.green(`✓ Updated ${config.changelog.path}`));
      }
    } catch (error) {
      spinner.fail('Sync failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

/**
 * Get the latest git tag, or fall back to a recent commit range.
 */
async function getLatestTag(): Promise<string> {
  try {
    const git = simpleGit();
    const tags = await git.tags();

    if (tags.latest) {
      return tags.latest;
    }

    // No tags found, use HEAD~10 as default
    console.log(chalk.dim('  No tags found, using HEAD~10'));
    return 'HEAD~10';
  } catch (error) {
    console.log(chalk.dim('  Could not get tags, using HEAD~10'));
    return 'HEAD~10';
  }
}
