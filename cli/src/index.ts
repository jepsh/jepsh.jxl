#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { version } from '../package.json';
import { createAction } from './commands/create';
import { devAction } from './commands/dev';
import { buildAction } from './commands/build';

async function main() {
  const program = new Command();
  program
    .name('jepsh')
    .description('CLI to manage Jepsh projects')
    .version(version)
    .configureOutput({
      writeErr: (str) => process.stderr.write(chalk.red(str)),
      writeOut: (str) => process.stdout.write(str),
    });

  program
    .command('create')
    .description('Create a new Jepsh application')
    .argument('<app-name>', 'name of your application')
    .option('-t, --template <template>', 'Specify a template for the project') // for future
    .option('--verbose', 'Enable verbose output') // for future
    .action(createAction);

  program
    .command('dev')
    .description('Start the development server')
    .option('-p, --platform <platform>', 'Target platform', 'web') // default: web
    .option('--port <port>', 'Port to run the server on') // for future
    .option('--host <host>', 'Host to run the server on') // for future
    .option('--verbose', 'Enable verbose output') // for future
    .action(devAction);

  program
    .command('build')
    .description('Build the project for production')
    .option('-t, --target <target>', 'Build target (dev, prod)', 'prod') // default: prod
    .option('-p, --platform <platform>', 'Target platform (web)') // for future: all/native
    .option('--verbose', 'Enable verbose output') // for future
    .action(buildAction);

  program.allowUnknownOption();

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  console.error(chalk.red('An unexpected error occurred:'), error);
  process.exit(1);
});
