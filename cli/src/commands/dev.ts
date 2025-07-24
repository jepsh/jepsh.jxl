import chalk from 'chalk';
import { createServer, ViteDevServer } from 'vite';
import { createViteConfig } from '../vite/config';

/**
 * handler for `jepsh dev`
 * @param options
 * @param command
 */
export async function devAction(
  options: { platform: string; port?: string; host?: string; verbose?: boolean },
  command: any
) {
  console.log(
    chalk.blue(`Starting Jepsh development server for platform '${options.platform}'...`)
  );

  if (options.platform !== 'web') {
    console.warn(
      chalk.yellow(
        `Warning: Platform '${options.platform}' is not supported yet. Defaulting to 'web'.`
      )
    );

    options.platform = 'web';
  }

  const projectRoot = process.cwd();
  console.log(chalk.gray(`Project root: ${projectRoot}`));

  // TODO: load project config (jepsh.config.js/ts, package.json jepsh field)

  const port = options.port ? parseInt(options.port, 10) : 3000;
  // handle --host 0.0.0.0 or --host (boolean true)
  let host: string | boolean = 'localhost';
  if (options.host !== undefined) {
    if (options.host === 'true' || options.host === '') {
      host = '0.0.0.0';
    } else {
      host = options.host;
    }
  }

  const viteConfig = createViteConfig({
    root: projectRoot,
    mode: 'development',
    port,
    host,
  });

  let server: ViteDevServer;
  try {
    console.log(chalk.gray('Starting Vite development server...'));
    server = await createServer(viteConfig);

    await server.listen();

    const { port: serverPort, host: serverHost } = server.config.server;
    const protocol = server.config.server.https ? 'https' : 'http';
    const networkUrls = server.printUrls();

    console.log(chalk.green(`\n✓ Jepsh development server running!`));
    console.log(chalk.cyan(`  > Local:    ${protocol}://${serverHost}:${serverPort}`));
    console.log(chalk.gray('\nHot Module Replacement (HMR) is enabled.'));
    console.log(chalk.gray('Edit your .jxl files to see changes in real-time.'));

    // TODO: setup file watchers for .jxl files
    // TODO: setup WebSocket connection for HMR

    const cleanup = () => {
      console.log(chalk.yellow('\nShutting down development server...'));
      server
        .close()
        .then(() => {
          console.log(chalk.green('✓ Server stopped.'));
          process.exit(0);
        })
        .catch((err) => {
          console.error(chalk.red('Error stopping server:'), err);
          process.exit(1);
        });
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  } catch (error: any) {
    console.error(chalk.red('Failed to start development server:'));
    console.error(error);
    process.exit(1);
  }
}
