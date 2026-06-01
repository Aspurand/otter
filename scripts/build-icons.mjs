// Renders public/otter.svg into the PNG sizes the manifest + iOS need.
// Run on demand: `node scripts/build-icons.mjs`.

import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const svg = readFileSync(resolve(root, 'public/otter.svg'))

const targets = [
  { size: 192, file: 'public/pwa-192.png' },
  { size: 512, file: 'public/pwa-512.png' },
  { size: 180, file: 'public/apple-touch-icon.png' },
  { size: 32,  file: 'public/favicon-32.png' },
]

for (const { size, file } of targets) {
  await sharp(svg).resize(size, size).png({ compressionLevel: 9 }).toFile(resolve(root, file))
  console.log(`wrote ${file} (${size}x${size})`)
}
