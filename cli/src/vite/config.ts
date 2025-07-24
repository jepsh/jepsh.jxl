import { InlineConfig } from 'vite';
import { resolve } from 'path';
import { jepshVitePlugin } from './plugin';

export function createViteConfig(options: {
  root: string;
  mode: 'development' | 'production';
  port?: number;
  host?: string | boolean;
}): InlineConfig {
  const { root, mode, port = 3000, host = 'localhost' } = options;

  const config: InlineConfig = {
    root,
    mode,
    plugins: [
      jepshVitePlugin(),
      // vitePluginInspect(),
    ],
    server: {
      host,
      port,
      strictPort: false,
      hmr: {
        // overlay: false,
      },
    },
    build: {
      outDir: resolve(root, 'dist'),
      assetsDir: 'assets',
    },
    define: {
      // '__DEV__': JSON.stringify(mode === 'development')
    },
    // assetsInclude: ['**/*.jxl'],
  };

  return config;
}
