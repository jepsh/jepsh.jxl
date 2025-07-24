import type { Plugin, ViteDevServer } from 'vite';
import { promises as fs } from 'fs';
import { parse } from '@jepsh/compiler';

export function jepshVitePlugin(): Plugin {
  let server: ViteDevServer | null = null;
  const jxlModuleMap = new Map<string, Set<string>>(); // jxlPath -> set of dependent moduleIds

  return {
    name: 'jepsh-vite-plugin',
    configureServer(_server) {
      server = _server;

      // _server.watcher.on('change', (file) => {
      //   if (file.endsWith('.jxl')) {
      //     console.log(`[Jepsh Plugin] JXL file changed: ${file}`);
      //     // trigger HMR update for modules that depend on this .jxl file
      //   }
      // });
    },

    async load(id) {
      if (id.endsWith('.jxl')) {
        const source = await fs.readFile(id, 'utf-8');

        try {
          const ast = parse(source);

          console.log(`[Jepsh Plugin] Parsed ${id}`);

          const jsCode = `import { mount } from '@jepsh/runtime';

const jxlSource = ${JSON.stringify(source)};

export function render(containerElement) {
  if (!containerElement) {
    console.error('[Jepsh] No container element provided to render function.');
    return;
  }

  mount(jxlSource, { container: containerElement });
}

// if (import.meta.hot) {
//   import.meta.hot.accept(() => {
//     console.log('[Jepsh HMR] JXL module updated.');
//     // re-render the app if it was mounted
//   });
// }
`;

          return jsCode;
        } catch (error: any) {
          console.error(`[Jepsh Plugin] Error parsing ${id}:`, error);
          return `export default function() { throw new Error(${JSON.stringify(`JXL Parse Error in ${id}: ${error.message}`)}); }`;
        }
      }

      return null;
    },

    handleHotUpdate(ctx) {
      if (ctx.file.endsWith('.jxl')) {
        console.log(`[Jepsh Plugin] Handling HMR for updated JXL file: ${ctx.file}`);

        return undefined;
      }

      return undefined;
    },
  };
}
