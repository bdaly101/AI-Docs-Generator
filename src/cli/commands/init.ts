import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { defaultConfig } from '../../config/defaults.js';

export const initCommand = new Command('init')
  .description('Initialize AI-Docs-Generator configuration')
  .option('--force', 'Overwrite existing config')
  .action(async (options) => {
    const configPath = path.join(process.cwd(), '.aidocsrc.json');

    const exists = await fs
      .access(configPath)
      .then(() => true)
      .catch(() => false);

    if (exists && !options.force) {
      console.log(chalk.yellow('Config already exists. Use --force to overwrite.'));
      return;
    }

    await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));

    console.log(chalk.green('✓ Created .aidocsrc.json'));
    console.log(chalk.dim('  Set ANTHROPIC_API_KEY environment variable to get started.'));
  });

