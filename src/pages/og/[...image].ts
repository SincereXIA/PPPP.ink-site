// Retypeset's astro-og-canvas currently declares support through Astro 6.
// Keep local generated sharing cards on Astro 7 without overriding peer checks.
import { getCollection } from 'astro:content'
import { Resvg } from '@resvg/resvg-js'
import type { CollectionEntry } from 'astro:content'
import { getPostDescription } from '@/utils/description'
export async function getStaticPaths() {
  return (await getCollection('posts')).map(post => ({ params: { image: post.id + '.png' }, props: { post } }))
}
const escape = (s: string) => s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]!))
export async function GET({ props }: { props: { post: CollectionEntry<'posts'> } }) {
  const { post } = props
  const title = [...post.data.title]
  const lines = [title.slice(0, 22).join(''), title.slice(22, 44).join('')].filter(Boolean)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#f2f1f5"/><text x="80" y="100" font-family="Noto Sans SC" fill="#555" font-size="26">PPPP.ink · 粉墨</text>${lines.map((line, i) => `<text x="80" y="${230+i*80}" font-family="Noto Sans SC" font-weight="bold" fill="#242326" font-size="42">${escape(line)}</text>`).join('')}<text x="80" y="470" font-family="Noto Sans SC" fill="#555" font-size="24">${escape([...getPostDescription(post, 'og')].slice(0, 40).join(''))}</text><text x="80" y="560" font-family="Noto Sans SC" fill="#777" font-size="20">www.pppp.ink</text></svg>`
  const png = new Resvg(svg, { font: { fontFiles: ['./static/fonts/NotoSansSC-Regular.otf', './static/fonts/NotoSansSC-Bold.otf'], loadSystemFonts: false } }).render().asPng()
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } })
}
