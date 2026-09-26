/**
 * WordAPA7 — T1: el token de fondo del resaltado de patrones IA existe en
 * ambos temas. Sin el redefine en oscuro, el subrayado del detector queda
 * invisible sobre superficie oscura (Review Focus #1).
 */
import { describe, it, expect, beforeAll } from 'vitest';

// Specifiers en variables, imports dinámicos: si Vite puede analizarlos los
// pasa por vite-plugin-node-polyfills, cuyos shims de browser no traen
// readFileSync ni fileURLToPath, y su `path.resolve` ni siquiera entiende una
// ruta absoluta de Windows (mismo problema que documenta vite.config.ts).
const NODE_FS = 'node:fs';
const NODE_PATH = 'node:path';
const NODE_URL = 'node:url';

let lightBlock = '';
let darkBlock = '';

beforeAll(async () => {
  const { readFileSync } = await import(/* @vite-ignore */ NODE_FS);
  const { resolve } = await import(/* @vite-ignore */ NODE_PATH);
  const { fileURLToPath } = await import(/* @vite-ignore */ NODE_URL);
  // La ruta se ancla en import.meta.url, no en __dirname (que en este runner
  // apunta a <root>/src) ni en `new URL('../styles/...', import.meta.url)`
  // (que en jsdom resuelve contra http://localhost:3000, no contra file://).
  const testDir = fileURLToPath(import.meta.url).replace(/[^/\\]+$/, '');
  const css = readFileSync(resolve(testDir, '../styles/design-system.css'), 'utf8');
  lightBlock = css.slice(css.indexOf(':root,'), css.indexOf(':root[data-theme="dark"]'));
  darkBlock = css.slice(css.indexOf(':root[data-theme="dark"]'));
});

describe('T1 — token --mark-ai-bg', () => {
  it('está definido en el tema claro', () => {
    expect(lightBlock).toMatch(/--mark-ai-bg:\s*[^;]+;/);
  });

  it('está definido en el tema oscuro', () => {
    expect(darkBlock).toMatch(/--mark-ai-bg:\s*[^;]+;/);
  });

  it('los dos valores son distintos, para que el detector se lea en ambos temas', () => {
    const light = lightBlock.match(/--mark-ai-bg:\s*([^;]+);/)?.[1].trim();
    const dark = darkBlock.match(/--mark-ai-bg:\s*([^;]+);/)?.[1].trim();
    expect(light).toBeTruthy();
    expect(dark).toBeTruthy();
    expect(dark).not.toBe(light);
  });
});
