// Renders the PWA icons from public/plate-mark.svg onto the charcoal tile (#12151a) with resvg. Run with `npm run icons`.
//   icon-192.png, icon-512.png  purpose "any": mark at 72% of the tile.
//   icon-512-maskable.png       purpose "maskable": same 72% mark; its visible ring is ~65% of the tile, inside the 80% safe zone.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const charcoal = '#12151a'
const source = readFileSync(resolve(root, 'public/plate-mark.svg'), 'utf8')
const inner = source.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim()

const render = (size, markShare, file) => {
  const mark = size * markShare
  const offset = (size - mark) / 2
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${charcoal}"/><svg x="${offset}" y="${offset}" width="${mark}" height="${mark}" viewBox="0 0 100 100">${inner}</svg></svg>`
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng()
  writeFileSync(resolve(root, 'public/icons', file), png)
  console.log(`${file} ${size}x${size}, ${(png.length / 1024).toFixed(1)} KB`)
}

mkdirSync(resolve(root, 'public/icons'), { recursive: true })
render(192, 0.72, 'icon-192.png')
render(512, 0.72, 'icon-512.png')
render(512, 0.72, 'icon-512-maskable.png')
