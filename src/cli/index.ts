#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { generateCommand } from './commands/generate.js';
import { watchCommand } from './commands/watch.js';
import { syncCommand } from './commands/sync.js';

const program = new Command();

program
  .name('aidocs')
  .description('Auto-generate documentation from code changes using AI')
  .version('1.0.0');

program.addCommand(initCommand);
program.addCommand(generateCommand);
program.addCommand(watchCommand);
program.addCommand(syncCommand);

program.parse();

