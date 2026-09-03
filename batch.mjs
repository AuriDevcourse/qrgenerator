#!/usr/bin/env node
/*
 * batch.mjs: generate one SVG per row of a CSV.
 * For the case the web app is bad at: 300 badge codes, one per attendee.
 *
 *   node batch.mjs people.csv --col url --name-col name --out ./out --ec H
 *
 * SVG only, deliberately: it is vector, so it prints at any size, and it needs
 * no rasteriser. Convert with `rsvg-convert -w 1024 in.svg -o out.png` if you
 * need bitmaps.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const R = createRequire(import.meta.url)('./qr-render.js');

// ---- args ----------------------------------------------------------------

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--'));
const flag = (name, fallback) => {
  const i = argv.indexOf('--' + name);
  return i === -1 ? fallback : argv[i + 1];
};

if (!file) {
  console.error(`usage: node batch.mjs <csv> [options]

  --col <name>        column holding the payload            (default: url)
  --name-col <name>   column used for the output filename   (default: row number)
  --type <kind>       url | text | vcard | wifi             (default: url)
  --out <dir>         output directory                      (default: ./out)
  --ec <L|M|Q|H>      error correction level                (default: M)
  --style <s>         square | rounded | dots               (default: square)
  --eyes <s>          square | rounded | circle             (default: square)
  --margin <n>        quiet zone in modules                 (default: 4)
  --fg <hex> --bg <hex>
`);
  process.exit(1);
}

const opt = {
  col: flag('col', 'url'),
  nameCol: flag('name-col', null),
  type: flag('type', 'url'),
  out: resolve(flag('out', './out')),
  ec: (flag('ec', 'M') || 'M').toUpperCase(),
  style: flag('style', 'square'),
  eyeStyle: flag('eyes', 'square'),
  margin: Number(flag('margin', 4)),
  fg: flag('fg', '#000000'),
  bg: flag('bg', '#ffffff')
};

// ---- csv -----------------------------------------------------------------

// Small but correct: handles quoted fields, embedded commas, "" escapes, CRLF.
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const rows = parseCsv(readFileSync(file, 'utf8'));
if (!rows.length) { console.error('empty csv'); process.exit(1); }

const header = rows[0].map((h) => h.trim());
const idx = header.indexOf(opt.col);
if (idx === -1) {
  console.error(`column "${opt.col}" not found. Columns: ${header.join(', ')}`);
  process.exit(1);
}
const nameIdx = opt.nameCol ? header.indexOf(opt.nameCol) : -1;
if (opt.nameCol && nameIdx === -1) {
  console.error(`column "${opt.nameCol}" not found. Columns: ${header.join(', ')}`);
  process.exit(1);
}

// ---- generate ------------------------------------------------------------

mkdirSync(opt.out, { recursive: true });

// Danish and Lithuanian names are the normal case here, so transliterate rather
// than strip: "Søren Å" -> "soeren-aa", not "s-ren".
const FOLD = { 'æ': 'ae', 'ø': 'oe', 'å': 'aa', 'ß': 'ss', 'đ': 'd', 'ł': 'l' };
const slug = (s, i) =>
  (String(s || '').trim().toLowerCase()
    .replace(/[æøåßđł]/g, (c) => FOLD[c])
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'row-' + i).slice(0, 60);

let made = 0;
const problems = [];

rows.slice(1).forEach((row, i) => {
  const raw = (row[idx] || '').trim();
  if (!raw) { problems.push(`row ${i + 2}: empty ${opt.col}`); return; }

  const build = R.payload[opt.type];
  if (!build) { problems.push(`unknown --type ${opt.type}`); return; }

  // For row-shaped types, hand the whole row over keyed by column name.
  const fields = {};
  header.forEach((h, c) => { fields[h] = row[c]; });
  if (opt.type === 'url') fields.url = raw;
  if (opt.type === 'text') fields.text = raw;

  const text = build(fields);
  const bytes = R.utf8len(text);
  if (bytes > R.MAX_BYTES[opt.ec]) {
    problems.push(`row ${i + 2}: ${bytes} bytes exceeds EC-${opt.ec} limit of ${R.MAX_BYTES[opt.ec]}`);
    return;
  }

  const svg = R.svg(text, { ...opt, px: 1024 });
  const name = slug(nameIdx > -1 ? row[nameIdx] : '', i + 1) + '.svg';
  writeFileSync(join(opt.out, name), svg);
  made++;
});

console.log(`${made} code${made === 1 ? '' : 's'} written to ${opt.out}`);
if (problems.length) {
  console.log(`\n${problems.length} skipped:`);
  problems.forEach((p) => console.log('  ' + p));
  process.exitCode = 1;
}
