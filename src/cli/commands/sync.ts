import { Command } from 'commander';
import chalk from 'chalk';

export const syncCommand = new Command('sync')
  .description('Sync CHANGELOG.md from commits')
  .argument('[since]', 'Sync commits since this ref (tag, commit, or branch)', 'latest-tag')
  .option('--version <version>', 'Specify version number')
  .option('--dry-run', 'Show changelog without writing')
  .action(async (since, options) => {
    console.log(chalk.yellow('⚠ Sync command not yet implemented'));
    console.log(chalk.dim('  This will be implemented in Phase 4'));
  });

