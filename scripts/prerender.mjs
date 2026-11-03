// Injects the prerendered landing and the FAQPage structured data into dist/index.html.
// Run after `vite build` and `vite build --ssr src/prerender.tsx --outDir dist-ssr` (see the build script in package.json).
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const htmlPath = new URL('../dist/index.html', import.meta.url)
const { render, faqJsonLd } = await import(pathToFileURL(new URL('../dist-ssr/prerender.js', import.meta.url).pathname).href)

let html = readFileSync(htmlPath, 'utf8')

// The wrapper lets the returning-visitor guard in index.html hide the landing before first paint; createRoot drops it on mount.
const root = '<div id="root"></div>'
if (!html.includes(root)) throw new Error('prerender: empty #root not found in dist/index.html')
html = html.replace(root, () => `<div id="root"><div class="prerendered">${render()}</div></div>`)

// Add the FAQPage node, generated from the same array the page renders, to the static @graph.
const ldPattern = /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/
const match = html.match(ldPattern)
if (!match) throw new Error('prerender: JSON-LD script not found in dist/index.html')
const data = JSON.parse(match[2])
data['@graph'].push(faqJsonLd())
const json = JSON.stringify(data, null, 2).replaceAll('<', '\\u003c')
html = html.replace(ldPattern, () => `${match[1]}\n${json}\n${match[3]}`)

writeFileSync(htmlPath, html)
console.log('prerender: landing + FAQPage JSON-LD injected into dist/index.html')
