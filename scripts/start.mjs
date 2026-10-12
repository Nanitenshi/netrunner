import { build } from 'vite';
import {existsSync} from 'node:fs';
if(existsSync('.env'))process.loadEnvFile('.env');
// Native config loading avoids an unnecessary bundled config subprocess.
await build({ configLoader: 'native' });
await import('../server/main.ts');
