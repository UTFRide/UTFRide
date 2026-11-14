import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

const stylesPath = fileURLToPath(new URL('../../../styles.css', import.meta.url));

test('o conteúdo das telas públicas mantém uma largura legível', async () => {
  const styles = await readFile(stylesPath, 'utf8');
  const { root } = await postcss([tailwind()]).process(styles, { from: stylesPath });
  const variables = new Map();
  root.walkDecls((declaration) => {
    if (declaration.prop.startsWith('--')) variables.set(declaration.prop, declaration.value);
  });

  for (const page of ['landing', 'register']) {
    const template = await readFile(new URL(`./${page}/${page}.html`, import.meta.url), 'utf8');
    const main = new JSDOM(template).window.document.querySelector('main');
    assert.ok(main, `${page}: conteúdo principal ausente`);
    let maxWidth;
    root.walkRules((rule) => {
      let parent = rule.parent;
      while (parent) {
        if (parent.type === 'atrule' && parent.name === 'media') return;
        parent = parent.parent;
      }
      if (!rule.nodes?.some((node) => node.type === 'decl' && node.prop === 'max-width')) return;
      try {
        if (main.matches(rule.selector)) rule.walkDecls('max-width', (declaration) => { maxWidth = declaration.value; });
      } catch {
        // O DOM de testes não oferece suporte a todos os seletores de CSS.
      }
    });
    assert.ok(maxWidth, `${page}: limite de largura ausente`);
    const variable = maxWidth.match(/^var\((--[^)]+)\)$/)?.[1];
    const resolved = variable ? variables.get(variable) : maxWidth;
    const size = resolved?.match(/^([\d.]+)(px|rem)$/);
    assert.ok(size, `${page}: limite de largura não resolvido (${resolved})`);
    const pixels = Number(size[1]) * (size[2] === 'rem' ? 16 : 1);
    assert.ok(pixels >= 320 && pixels <= 768, `${page}: limite de ${pixels}px é inadequado`);
  }
});
