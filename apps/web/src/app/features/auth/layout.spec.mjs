import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

const stylesPath = fileURLToPath(new URL('../../../styles.css', import.meta.url));

function resolveVariables(value, variables, resolving = new Set()) {
  assert.ok(value, 'valor CSS ausente');
  return value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (_, name, fallback) => {
    assert.ok(!resolving.has(name), `referência circular à variável ${name}`);
    const replacement = variables.get(name) ?? fallback;
    assert.ok(replacement, `variável CSS não resolvida: ${name}`);
    return resolveVariables(replacement, variables, new Set([...resolving, name]));
  });
}

test('tokens de espaçamento não colidem com larguras de contêiner', async () => {
  const styles = await readFile(stylesPath, 'utf8');
  const source = `${styles}\n@source inline("max-w-md p-space-xs p-space-sm p-space-md p-space-lg p-space-xl");`;
  const { root } = await postcss([tailwind()]).process(source, { from: stylesPath });
  const variables = new Map();
  root.walkDecls((declaration) => {
    if (declaration.prop.startsWith('--')) variables.set(declaration.prop, declaration.value);
  });
  const properties = new Map();
  root.walkRules((rule) => {
    rule.walkDecls((declaration) => properties.set(`${rule.selector}:${declaration.prop}`, declaration.value));
  });
  assert.equal(resolveVariables(properties.get('.max-w-md:max-width'), variables), '28rem');
  for (const [size, value] of [['xs', '4px'], ['sm', '8px'], ['md', '12px'], ['lg', '16px'], ['xl', '24px']]) {
    assert.equal(resolveVariables(properties.get(`.p-space-${size}:padding`), variables), value);
  }
});

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
    const resolved = resolveVariables(maxWidth, variables);
    const size = resolved?.match(/^([\d.]+)(px|rem)$/);
    assert.ok(size, `${page}: limite de largura não resolvido (${resolved})`);
    const pixels = Number(size[1]) * (size[2] === 'rem' ? 16 : 1);
    assert.ok(pixels >= 320 && pixels <= 768, `${page}: limite de ${pixels}px é inadequado`);
  }
});
