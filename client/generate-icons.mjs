import sharp from '/home/daniel/soccerscore/soccer-tracker/client/node_modules/sharp/lib/index.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(join(__dirname, 'public/icons/icon.svg'));
const out = join(__dirname, 'public/icons');

const sizes = [
  { name: 'icon-16.png',  size: 16  },
  { name: 'icon-32.png',  size: 32  },
  { name: 'icon-180.png', size: 180 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
];

for (const { name, size } of sizes) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(join(out, name));
  console.log(`✓ ${name}`);
}
