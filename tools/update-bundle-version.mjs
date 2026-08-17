import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const bundle = await readFile('app.bundle.js');
const hash = createHash('sha256').update(bundle).digest('hex').slice(0, 12);
const html = await readFile('index.html', 'utf8');
await writeFile('index.html', html.replace(/app\.bundle\.js\?v=[^"']+/, `app.bundle.js?v=${hash}`));
