import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const TARGETS = ['index.html', 'src'];
const TEXT_EXTENSIONS = new Set(['.html', '.css', '.js', '.mjs', '.json']);
const FORBIDDEN = [
  { name: 'src/asset', pattern: /src\/asset/ },
  { name: '../asset', pattern: /\.\.\/asset/ },
  { name: './asset', pattern: /\.\/asset/ },
  { name: 'quoted relative asset path', pattern: /['"]asset\// },
];

async function* walk(entry) {
  const full = path.join(ROOT, entry);
  const stat = await import('node:fs/promises').then(fs => fs.lstat(full));
  if (stat.isSymbolicLink()) {
    if (entry === 'src/asset') throw new Error('src/asset symlink is not allowed');
    return;
  }
  if (stat.isDirectory()) {
    for (const child of await readdir(full)) {
      if (child === 'node_modules' || child === 'dist' || child === '.git' || child === '.omx') continue;
      yield* walk(path.join(entry, child));
    }
    return;
  }
  if (TEXT_EXTENSIONS.has(path.extname(entry))) yield entry;
}

const violations = [];
for (const target of TARGETS) {
  for await (const file of walk(target)) {
    const text = await readFile(path.join(ROOT, file), 'utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const rule of FORBIDDEN) {
        if (rule.pattern.test(line)) {
          violations.push(`${file}:${index + 1}: forbidden ${rule.name}: ${line.trim()}`);
        }
      }
    });
  }
}

if (violations.length > 0) {
  console.error('Forbidden asset paths found:\n' + violations.join('\n'));
  process.exit(1);
}

console.log('Asset path check passed: no /src/asset or relative asset paths in runtime sources.');
