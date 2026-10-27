// Regenerates the social preview image: public/og-image.svg (source, lettering converted to outlines so it renders the
// same everywhere) and public/og-image.png (1200x630). Run with `npm run og`.
// Composition: plate mark centered above the wordmark and tagline on charcoal #12151a (see DESIGN.md, Brand mark).
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import opentype from 'opentype.js'
import { Resvg } from '@resvg/resvg-js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WIDTH = 1200
const HEIGHT = 630
const MARK = 220

const colors = { canvas: '#12151a', ink: '#f2f0eb', inkSubtle: '#aab1bc' }

const loadFont = (file) => {
  const buffer = readFileSync(resolve(root, 'node_modules/@fontsource', file))
  return opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
}
const titleFont = loadFont('barlow-condensed/files/barlow-condensed-latin-700-normal.woff')
const bodyFont = loadFont('barlow/files/barlow-latin-500-normal.woff')

// Faithful copy of the brand mark: everything inside the root <svg> of public/plate-mark.svg.
const markSource = readFileSync(resolve(root, 'public/plate-mark.svg'), 'utf8')
const markInner = markSource.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim()

// `tracking` is letter-spacing in em. NOTE: opentype.js getPath with the
// letterSpacing option corrupts glyph layout partway through a string (the
// R in FORGE collapsed and later glyphs vanished), so tracked text is drawn
// glyph by glyph with advances summed by hand.
const outline = (font, text, size, baseline, fill, tracking = 0) => {
  if (!tracking) {
    const width = font.getAdvanceWidth(text, size)
    const x = (WIDTH - width) / 2
    return `<path fill="${fill}" d="${font.getPath(text, x, baseline, size).toPathData(2)}"/>`
  }
  const trackPx = tracking * size
  const advances = [...text].map((ch) => font.getAdvanceWidth(ch, size))
  const width = advances.reduce((a, b) => a + b, 0) + trackPx * (text.length - 1)
  let x = (WIDTH - width) / 2
  const parts = [...text].map((ch, i) => {
    const d = font.getPath(ch, x, baseline, size).toPathData(2)
    x += advances[i] + trackPx
    return d
  })
  return `<path fill="${fill}" d="${parts.join(" ")}"/>`
}

// Centered stack: mark, WORKOUT FORGE wordmark, tagline.
const title = 'WORKOUT FORGE'
const tagline = 'Get measurably stronger, week after week.'
const titleSize = 96
const taglineSize = 36
const markY = 118
const titleBaseline = markY + MARK + 40 + Math.round(titleSize * 0.7)
const taglineBaseline = titleBaseline + 40 + Math.round(taglineSize * 0.7)

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="Workout Forge: get measurably stronger, week after week">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${colors.canvas}"/>
  <svg x="${(WIDTH - MARK) / 2}" y="${markY}" width="${MARK}" height="${MARK}" viewBox="0 0 100 100">${markInner}</svg>
  ${outline(titleFont, title, titleSize, titleBaseline, colors.ink, 0.06)}
  ${outline(bodyFont, tagline, taglineSize, taglineBaseline, colors.inkSubtle)}
</svg>
`

writeFileSync(resolve(root, 'public/og-image.svg'), svg)
const png = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH }, background: colors.canvas }).render().asPng()
writeFileSync(resolve(root, 'public/og-image.png'), png)
console.log(`og-image.png ${WIDTH}x${HEIGHT}, ${(png.length / 1024).toFixed(1)} KB`)
