import { mergeConfig } from 'vite';
import config from './vite.config.js';
// A fresh test server avoids reloads from a developer's HMR session or dependency optimizer.
export default mergeConfig(config, {
  server: { hmr: false },
  optimizeDeps: {
    include: ['react', 'react-dom/client', 'react/jsx-runtime'],
    exclude: ['@mesihtasci/scrollable'],
  },
});
