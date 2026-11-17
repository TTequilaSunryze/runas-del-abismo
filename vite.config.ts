import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

const sh = (c: string): string => { try { return execSync(c).toString().trim(); } catch { return ''; } };
const version = `${sh('git rev-parse --short HEAD') || 'dev'} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`;

// base relativa: funciona en GitHub Pages sin importar el nombre del repo
export default defineConfig({ base: './', define: { __BUILD__: JSON.stringify(version) } });
