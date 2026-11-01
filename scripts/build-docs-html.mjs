/**
 * Рендерит документацию в один самодостаточный HTML-файл: удобно читать человеку
 * без сети и без просмотрщика markdown. Источник — те же .md, поэтому страница не
 * может разойтись с репозиторием: `npm run docs:html` пересобирает её.
 *
 * Поддерживается ровно то подмножество markdown, которое используется в docs/:
 * заголовки, абзацы, списки, таблицы, цитаты, горизонтальные линии, блоки кода
 * с подписью языка и инлайн-разметка (`code`, **bold**, *em*, ссылки).
 *
 * Вывод: .qwen/tmp/bso5-handbook.html (в git не попадает).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(root, '.qwen', 'tmp');
const OUT = join(OUT_DIR, 'bso5-handbook.html');

const DOCS = [
  ['docs/README.md', 'Навигация'],
  ['docs/API.md', 'API'],
  ['docs/GUIDE.md', 'Рецепты'],
  ['docs/TREE_GRID.md', 'Разметка и CSS'],
  ['docs/COMPROMISES.md', 'Компромиссы'],
];

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Тот же алгоритм, что у GitHub и в check-doc-links: пунктуация выброшена, каждый пробел → дефис. */
const slug = s => s
  .toLowerCase()
  .replace(/`|\*\*|\*|__/g, '')
  .replace(/[^\p{L}\p{N}\s-]/gu, '')
  .trim()
  .replace(/\s/g, '-');

/** Инлайн-разметка: сначала вырезаем `code`, потом остальное. */
function inline(text) {
  const codes = [];
  let s = text.replace(/`([^`]+)`/g, (_, code) => {
    codes.push(`<code>${esc(code)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = esc(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const external = /^https?:/.test(href);
    return `<a href="${href}"${external ? ' target="_blank" rel="noreferrer"' : ''}>${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)]);
}

/** Разбирает markdown в HTML и список заголовков для оглавления. */
function render(markdown) {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  const toc = [];
  let i = 0;

  const flushParagraph = buf => {
    if (buf.length > 0) html.push(`<p>${inline(buf.join(' '))}</p>`);
    buf.length = 0;
  };
  const paragraph = [];

  while (i < lines.length) {
    const line = lines[i];

    // блок кода
    if (line.startsWith('```')) {
      flushParagraph(paragraph);
      const lang = line.slice(3).trim();
      const body = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) body.push(lines[i++]);
      i++;
      html.push(
        `<div class="code"><div class="code-lang">${esc(lang || 'text')}</div>` +
        `<pre><code>${esc(body.join('\n'))}</code></pre></div>`,
      );
      continue;
    }

    // заголовок
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flushParagraph(paragraph);
      const level = h[1].length;
      const text = h[2].trim();
      const id = slug(text);
      if (level > 1) toc.push({ level, text, id });
      html.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      i++;
      continue;
    }

    // горизонтальная линия
    if (/^---+\s*$/.test(line)) {
      flushParagraph(paragraph);
      html.push('<hr>');
      i++;
      continue;
    }

    // цитата
    if (line.startsWith('> ')) {
      flushParagraph(paragraph);
      const quote = [];
      while (i < lines.length && lines[i].startsWith('> ')) quote.push(lines[i++].slice(2));
      html.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`);
      continue;
    }

    // таблица
    if (line.startsWith('|') && lines[i + 1]?.startsWith('|')) {
      flushParagraph(paragraph);
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(2).map(cells);
      html.push(
        '<div class="table-wrap"><table><thead><tr>' +
        head.map(c => `<th>${inline(c)}</th>`).join('') +
        '</tr></thead><tbody>' +
        body.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('') +
        '</tbody></table></div>',
      );
      continue;
    }

    // списки
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      flushParagraph(paragraph);
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items = [];
      while (i < lines.length && (/^\s*([-*]|\d+\.)\s+/.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) {
        if (/^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''));
        } else {
          items[items.length - 1] += ' ' + lines[i].trim();
        }
        i++;
      }
      const tag = ordered ? 'ol' : 'ul';
      html.push(`<${tag}>${items.map(t => `<li>${inline(t)}</li>`).join('')}</${tag}>`);
      continue;
    }

    if (line.trim() === '') {
      flushParagraph(paragraph);
      i++;
      continue;
    }

    paragraph.push(line.trim());
    i++;
  }
  flushParagraph(paragraph);
  return { html: html.join('\n'), toc };
}

const pages = DOCS.filter(([rel]) => existsSync(join(root, rel))).map(([rel, title]) => {
  const { html, toc } = render(readFileSync(join(root, rel), 'utf8'));
  return { rel, title, html, toc: toc.filter(t => t.level <= 3) };
});

const nav = pages.map((p, idx) => {
  const links = p.toc
    .map(t => `<a class="lvl${t.level}" href="#${t.id}">${t.text}</a>`)
    .join('');
  return `<details${idx === 0 ? ' open' : ''}><summary>${p.title}</summary>${links}</details>`;
}).join('');

const body = pages.map(p => `<section class="doc" id="doc-${slug(p.title)}">
<div class="doc-src">${p.rel}</div>
${p.html}
</section>`).join('\n');

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>bso5 — справочник</title>
<style>
  :root{--bg:#0f1117;--panel:#171a22;--line:#2a2f3a;--fg:#e7e9ee;--dim:#9aa3b2;--acc:#6ea8fe;--code:#1b1f28}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 -apple-system,"Segoe UI",Roboto,sans-serif}
  .layout{display:flex;align-items:flex-start;max-width:1280px;margin:0 auto}
  nav{position:sticky;top:0;flex:0 0 290px;max-height:100vh;overflow:auto;padding:20px 14px 40px;border-right:1px solid var(--line);background:var(--panel)}
  nav .brand{font-weight:700;font-size:17px;margin-bottom:2px}
  nav .sub{color:var(--dim);font-size:12px;margin-bottom:16px}
  nav details{margin:6px 0}
  nav summary{cursor:pointer;font-weight:600;padding:2px 0}
  nav a{display:block;color:var(--dim);text-decoration:none;font-size:13px;padding:2px 0 2px 10px;border-left:2px solid transparent}
  nav a:hover{color:var(--fg)}
  nav a.lvl3{padding-left:22px;font-size:12.5px}
  main{flex:1 1 auto;min-width:0;padding:28px 34px 120px}
  section.doc{padding-bottom:36px;margin-bottom:36px;border-bottom:1px solid var(--line)}
  .doc-src{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;color:var(--dim);margin-bottom:10px}
  h1{font-size:26px;margin:0 0 10px}
  h2{font-size:20px;margin:34px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--line)}
  h3{font-size:16px;margin:24px 0 8px;color:var(--acc)}
  h4{font-size:14px;margin:18px 0 6px}
  p{margin:9px 0}
  a{color:var(--acc)}
  ul,ol{margin:8px 0 8px 20px;padding:0}
  li{margin:4px 0}
  code{font-family:ui-monospace,Consolas,monospace;font-size:12.5px;background:#232936;padding:1px 5px;border-radius:4px;color:#cfe3ff}
  .code{background:var(--code);border:1px solid var(--line);border-radius:8px;margin:12px 0;overflow:hidden}
  .code-lang{font-family:ui-monospace,Consolas,monospace;font-size:11px;color:var(--dim);padding:5px 12px;border-bottom:1px solid var(--line);background:#141821}
  .code pre{margin:0;padding:12px 14px;overflow-x:auto}
  .code code{background:none;padding:0;color:#d6deeb;font-size:12.5px;line-height:1.5}
  .table-wrap{overflow-x:auto;margin:12px 0}
  table{border-collapse:collapse;width:100%;font-size:13.5px}
  th,td{text-align:left;padding:7px 10px;border-bottom:1px solid var(--line);vertical-align:top}
  th{color:var(--dim);font-size:12px;text-transform:uppercase;letter-spacing:.04em}
  blockquote{margin:12px 0;padding:8px 14px;border-left:3px solid var(--acc);background:var(--panel);color:#c8cdd7;border-radius:0 6px 6px 0}
  hr{border:0;border-top:1px solid var(--line);margin:26px 0}
  @media (max-width:900px){.layout{display:block}nav{position:static;max-height:none;border-right:0;border-bottom:1px solid var(--line)}main{padding:20px}}
</style>
</head>
<body>
<div class="layout">
<nav>
  <div class="brand">bso5</div>
  <div class="sub">справочник · 0.4.0 / 0.2.0</div>
  ${nav}
</nav>
<main>
${body}
</main>
</div>
</body>
</html>
`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, html, 'utf8');
console.log(`готово: ${OUT} (${Math.round(html.length / 1024)} kB, ${pages.length} документов)`);

/* Фрагмент без html/head/body — для публикации как artifact-страницы. */
if (process.argv.includes('--fragment')) {
  const style = html.match(/<style>[\s\S]*?<\/style>/)[0];
  const layout = html.match(/<div class="layout">[\s\S]*<\/div>\s*<\/body>/)[0].replace(/<\/body>$/, '').trimEnd();
  const fragPath = join(OUT_DIR, 'bso5-handbook-frag.html');
  const fragment = `${style}\n${layout}\n`;
  writeFileSync(fragPath, fragment, 'utf8');
  console.log(`фрагмент: ${fragPath} (${Math.round(fragment.length / 1024)} kB)`);
}
