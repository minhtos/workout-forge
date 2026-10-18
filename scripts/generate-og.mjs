// Regenerates the social preview image: public/og-image.svg (source, lettering converted to outlines so it renders the
// same everywhere) and public/og-image.png (1200x630). Run with `npm run og`.
// The mark is copied from public/workout-forge-icon.svg, and the colors are the app's tokens (see DESIGN.md).
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import opentype from 'opentype.js'
import { Resvg } from '@resvg/resvg-js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WIDTH = 1200
const HEIGHT = 630
const PADDING = 100
const ICON = 360
const GAP = 80

const colors = { canvas: '#16181b', ink: '#f2f0eb', inkSubtle: '#aab1bc' }

const loadFont = (file) => {
  const buffer = readFileSync(resolve(root, 'node_modules/@fontsource', file))
  return opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
}
const titleFont = loadFont('barlow-condensed/files/barlow-condensed-latin-700-normal.woff')
const bodyFont = loadFont('barlow/files/barlow-latin-500-normal.woff')

// Faithful copy of the app icon: everything inside the root <svg> of public/workout-forge-icon.svg.
const iconSource = readFileSync(resolve(root, 'public/workout-forge-icon.svg'), 'utf8')
const iconInner = iconSource.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim()

const textX = PADDING + ICON + GAP
const textWidth = WIDTH - PADDING - textX
const iconY = (HEIGHT - ICON) / 2

/** The largest size (up to `max`) at which `text` fits in `width`. */
const fitSize = (font, text, width, max, min) => {
  for (let size = max; size >= min; size -= 1) if (font.getAdvanceWidth(text, size) <= width) return size
  return min
}
/** Greedy word wrap at a fixed size. */
const wrap = (font, text, size, width) => {
  const lines = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (line && font.getAdvanceWidth(next, size) > width) { lines.push(line); line = word } else line = next
  }
  return line ? [...lines, line] : lines
}
const outline = (font, text, x, baseline, size, fill) => `<path fill="${fill}" d="${font.getPath(text, x, baseline, size).toPathData(2)}"/>`

const title = 'Workout Forge'
const tagline = 'Plan workouts. Log training. Local-first.'
const titleSize = fitSize(titleFont, title, textWidth, 132, 60)
const taglineSize = fitSize(bodyFont, tagline, textWidth, 36, 30)
const taglineLines = bodyFont.getAdvanceWidth(tagline, taglineSize) <= textWidth ? [tagline] : wrap(bodyFont, tagline, 34, textWidth)
const taglineFontSize = taglineLines.length === 1 ? taglineSize : 34
const lineHeight = Math.round(taglineFontSize * 1.35)

// Vertically center the text block on the icon.
const titleCap = titleSize * 0.7
const blockHeight = titleCap + 36 + (taglineLines.length - 1) * lineHeight + taglineFontSize * 0.7
const titleBaseline = Math.round((HEIGHT - blockHeight) / 2 + titleCap)
const taglineBaseline = titleBaseline + 36 + Math.round(taglineFontSize * 0.7)

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="Workout Forge: plan workouts, log training, local-first">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${colors.canvas}"/>
  <svg x="${PADDING}" y="${iconY}" width="${ICON}" height="${ICON}" viewBox="0 0 512 512">${iconInner}</svg>
  ${outline(titleFont, title, textX, titleBaseline, titleSize, colors.ink)}
  ${taglineLines.map((line, index) => outline(bodyFont, line, textX, taglineBaseline + index * lineHeight, taglineFontSize, colors.inkSubtle)).join('\n  ')}
</svg>
`

writeFileSync(resolve(root, 'public/og-image.svg'), svg)
const png = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH }, background: colors.canvas }).render().asPng()
writeFileSync(resolve(root, 'public/og-image.png'), png)
console.log(`og-image.png ${WIDTH}x${HEIGHT}, ${(png.length / 1024).toFixed(1)} KB; title ${titleSize}px, tagline ${taglineFontSize}px x ${taglineLines.length} line(s)`)
