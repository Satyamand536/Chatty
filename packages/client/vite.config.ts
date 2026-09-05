import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  // Serves the repo-root assets/ directory, so /gremlin.glb resolves.
  publicDir: '../../assets',
  server: {
    host: '0.0.0.0',
    port: 5173,
    // The Arena preview proxies this server under an external host.
    allowedHosts: true,
  },
  preview: { host: '0.0.0.0', port: 5173, allowedHosts: true },
  build: { target: 'es2022' },
});
