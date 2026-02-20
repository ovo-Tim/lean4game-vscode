// This file is bundled into out/webview/panelVendor.js as an IIFE (PanelVendor).
// It exports { marked, markedKatex } for use by panel.js.
import { marked } from 'marked'
import markedKatex from 'marked-katex-extension'

export { marked, markedKatex }
