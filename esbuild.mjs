import * as esbuild from 'esbuild'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Clean out/
fs.rmSync(path.join(__dirname, 'out'), { recursive: true, force: true })
fs.mkdirSync(path.join(__dirname, 'out', 'webview'), { recursive: true })

// Build extension
await esbuild.build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'out/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  minify: false,
})

// Copy webview static files
const webviewSrc = path.join(__dirname, 'src', 'panel', 'webview')
const webviewDst = path.join(__dirname, 'out', 'webview')

for (const file of ['panel.html', 'panel.css', 'panel.js', 'tree.html', 'tree.css', 'tree.js']) {
  fs.copyFileSync(path.join(webviewSrc, file), path.join(webviewDst, file))
}

// Copy KaTeX assets from node_modules
const katexDist = path.join(__dirname, 'node_modules', 'katex', 'dist')
if (fs.existsSync(katexDist)) {
  fs.copyFileSync(
    path.join(katexDist, 'katex.min.css'),
    path.join(webviewDst, 'katex.min.css'),
  )
  fs.copyFileSync(
    path.join(katexDist, 'katex.min.js'),
    path.join(webviewDst, 'katex.min.js'),
  )
  // Copy fonts
  const fontsDir = path.join(katexDist, 'fonts')
  const fontsDst = path.join(webviewDst, 'fonts')
  fs.mkdirSync(fontsDst, { recursive: true })
  for (const f of fs.readdirSync(fontsDir)) {
    fs.copyFileSync(path.join(fontsDir, f), path.join(fontsDst, f))
  }
}

// Bundle marked + marked-katex-extension for webview
await esbuild.build({
  entryPoints: ['src/panel/webview/panelVendor.ts'],
  bundle: true,
  outfile: 'out/webview/panelVendor.js',
  format: 'iife',
  globalName: 'PanelVendor',
  platform: 'browser',
  target: 'es2020',
  minify: true,
})

console.log('Build complete.')
