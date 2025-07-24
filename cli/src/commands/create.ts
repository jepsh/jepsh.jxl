import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';

/**
 * handler for `jepsh create`
 * @param appName
 * @param options
 * @param command
 */
export async function createAction(
  appName: string,
  options: { template?: string; verbose?: boolean },
  command: any
) {
  console.log(chalk.green(`Creating a new Jepsh app in ${appName}...`));

  const appPath = path.resolve(appName);
  if (fs.existsSync(appPath)) {
    console.error(chalk.red(`Error: Directory '${appName}' already exists.`));
    process.exit(1);
  }

  try {
    await fs.ensureDir(appPath);
    process.chdir(appPath);

    const packageJson = {
      name: appName,
      version: '0.1.0',
      private: true,
      scripts: {
        dev: 'jepsh dev',
        build: 'jepsh build',
        preview: 'vite preview',
      },
      dependencies: {},
    };

    await fs.writeJSON(path.join(appPath, 'package.json'), packageJson, { spaces: 2 });

    const srcPath = path.join(appPath, 'src');
    await fs.ensureDir(srcPath);

    const mainJxlContent = `view App {
  signal count: Int = 0

  render {
    VStack {
      Text("Welcome to Jepsh!")
      Text("Count: \\(count)")
      Button("Increment") {
        count += 1
      }
    }
  }
}
`;
    await fs.writeFile(path.join(srcPath, 'main.jxl'), mainJxlContent);

    const indexPath = path.join(appPath, 'index.html');
    const indexHtmlContent = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Jepsh App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module">
      import { render } from './src/main.jxl';
      const appContainer = document.getElementById('app');
      if (appContainer) {
        render(appContainer);
      } else {
        console.error("Could not find element with id 'app'");
      }
    </script>
  </body>
</html>
`;
    await fs.writeFile(indexPath, indexHtmlContent);

    const tsConfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
      },
    };

    await fs.writeJSON(path.join(appPath, 'tsconfig.json'), tsConfig, { spaces: 2 });

    const readmeContent = `# ${appName}

This is a Jepsh application bootstrapped with \`jepsh create\`.

## Getting Started

First, run the development server:

\`\`\`bash
npm run dev
# or
yarn dev
\`\`\`

Open your browser to see your app.
`;
    await fs.writeFile(path.join(appPath, 'README.md'), readmeContent);

    // TODO: template files if a template is specified
    // if (options.template) { ... }

    // console.log(chalk.cyan('Installing dependencies...'));
    // execSync('npm install', { stdio: 'inherit' });

    console.log(chalk.green(`Success! Created ${appName} at ${appPath}`));
    console.log(chalk.cyan('Inside that directory, you can run several commands:'));
    console.log();
    console.log(chalk.cyan('  npm run dev'));
    console.log('    Starts the development server.');
    console.log();
    console.log(chalk.cyan('  npm run build'));
    console.log('    Bundles the app for production.');
    console.log();
    console.log('We suggest that you begin by typing:');
    console.log();
    console.log(chalk.cyan('  cd'), appName);
    console.log(chalk.cyan('  npm run dev'));
    console.log();
  } catch (error: any) {
    console.error(chalk.red('Error creating app:'), error.message || error);
    await fs.remove(appPath).catch(() => {});
    process.exit(1);
  }
}
