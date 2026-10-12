import { defineConfig } from 'vite';
export default defineConfig({
  esbuild: { jsx: 'automatic', jsxImportSource: 'react', tsconfigRaw: { compilerOptions: { target: 'ES2022', jsx: 'react-jsx' } } },
  optimizeDeps: { esbuildOptions: { tsconfigRaw: { compilerOptions: { jsx: 'react-jsx' } } } },
  server: { host: '127.0.0.1', port: 5174, strictPort: true, proxy: { '/api': 'http://127.0.0.1:5173', '/auth': 'http://127.0.0.1:5173', '/socket.io': { target:'http://127.0.0.1:5173',ws:true } } },
});
