import * as fs from 'fs'
import * as path from 'path'
import { GameHint, LevelData } from './types'

// ─── String extraction helpers ───────────────────────────────────────────────

/**
 * Try to close a Lean string starting right after the opening `"`.
 * Returns the string value (unescaped) if the closing `"` is on this
 * same line, or `null` if the string continues onto the next line.
 */
function tryCloseSingleLine(rest: string): string | null {
  let result = ''
  let i = 0
  while (i < rest.length) {
    const ch = rest[i]
    if (ch === '\\' && i + 1 < rest.length) {
      // escape sequence
      result += rest[i + 1]
      i += 2
      continue
    }
    if (ch === '"') {
      return result
    }
    result += ch
    i++
  }
  return null // no closing quote on this line
}

/**
 * Extract a Lean string starting at `lineRest` (the text after the keyword +
 * space, e.g. the `"..."` part of `Title "Problem 1"`).
 *
 * - Trims leading/trailing whitespace from lineRest.
 * - If it starts with `"` tries single-line extraction.
 * - If single-line fails (multi-line string), sets `multiLineAccum` state and
 *   returns `{ value: null, multiLine: true }` so the caller can switch modes.
 * - If the line doesn't start with `"` returns `{ value: null, multiLine: false }`.
 */
interface ExtractResult {
  value: string | null
  multiLine: boolean
  /** The index of the line that closed the string (for single-line = startIdx) */
  endIdx: number
}

function extractLeanString(
  lines: string[],
  startIdx: number,
  lineRest: string,
): ExtractResult {
  const trimmed = lineRest.trimStart()
  if (!trimmed.startsWith('"')) {
    return { value: null, multiLine: false, endIdx: startIdx }
  }

  const afterQuote = trimmed.slice(1)
  const single = tryCloseSingleLine(afterQuote)
  if (single !== null) {
    return { value: single, multiLine: false, endIdx: startIdx }
  }

  // Multi-line: accumulate until we find a line containing the closing "
  // Handles both:
  //   "                ← closing " on its own line (standard Lean multi-line)
  //   ...content..."  ← closing " at end of a content line
  let accum = afterQuote + '\n'
  let i = startIdx + 1
  while (i < lines.length) {
    const line = lines[i]
    const closed = tryCloseSingleLine(line)
    if (closed !== null) {
      // This line contains the closing "
      accum += closed
      const value = accum.replace(/^\n/, '').replace(/\n$/, '')
      return { value, multiLine: true, endIdx: i }
    }
    accum += line + '\n'
    i++
  }
  // unterminated string — return what we have
  const value = accum.replace(/^\n/, '').replace(/\n$/, '')
  return { value, multiLine: true, endIdx: i - 1 }
}

// ─── Top-level keyword detector ──────────────────────────────────────────────

const TOP_LEVEL_KEYWORDS = new Set([
  'import',
  'World',
  'Level',
  'Title',
  'Introduction',
  'Conclusion',
  'Statement',
  'NewTactic',
  'NewTheorem',
  'NewLemma',
  'NewDefinition',
  'TacticDoc',
  'TheoremDoc',
  'LemmaDoc',
  'DefinitionDoc',
  'Dependency',
  'MakeGame',
  'open',
  'section',
  'namespace',
  'variable',
  'set_option',
])

function isTopLevelKeyword(line: string): boolean {
  const word = line.match(/^([A-Za-z_][A-Za-z0-9_]*)/)?.[1]
  return word ? TOP_LEVEL_KEYWORDS.has(word) : false
}

// ─── Hint extraction ─────────────────────────────────────────────────────────

/**
 * Extract Hint blocks from proof body lines.
 * Handles: `Hint "..."`, `Hint (hidden := true) "..."`, `Hint (strict := true) "..."`
 */
function extractHints(proofLines: string[]): GameHint[] {
  const hints: GameHint[] = []
  let i = 0
  while (i < proofLines.length) {
    const line = proofLines[i]
    const hintMatch = line.match(/^\s*Hint\s*(.*)$/)
    if (!hintMatch) { i++; continue }

    let rest = hintMatch[1]
    let hidden = false
    let strict = false

    // Parse options like (hidden := true) (strict := true)
    while (true) {
      const optMatch = rest.match(/^\s*\(\s*(hidden|strict)\s*:=\s*(true|false)\s*\)\s*(.*)$/)
      if (!optMatch) break
      if (optMatch[1] === 'hidden') hidden = optMatch[2] === 'true'
      if (optMatch[1] === 'strict') strict = optMatch[2] === 'true'
      rest = optMatch[3]
    }

    rest = rest.trimStart()
    if (!rest.startsWith('"')) { i++; continue }

    const afterQuote = rest.slice(1)
    const single = tryCloseSingleLine(afterQuote)
    if (single !== null) {
      hints.push({ text: single, hidden, strict })
      i++
      continue
    }

    // Multi-line hint — closing " may be on its own line or end a content line
    let accum = afterQuote + '\n'
    i++
    let closed = false
    while (i < proofLines.length) {
      const pl = proofLines[i]
      const closedStr = tryCloseSingleLine(pl)
      if (closedStr !== null) {
        accum += closedStr
        hints.push({ text: accum.replace(/^\n/, '').replace(/\n$/, ''), hidden, strict })
        i++
        closed = true
        break
      }
      accum += pl + '\n'
      i++
    }
    if (!closed) {
      // unterminated — push what we have
      hints.push({ text: accum.replace(/^\n/, '').replace(/\n$/, ''), hidden, strict })
    }
  }
  return hints
}

// ─── Statement extraction ────────────────────────────────────────────────────

interface StatementResult {
  signature: string      // "Statement ... := by"
  proofLines: string[]   // lines of the proof body
  endIdx: number         // last line index consumed
}

/**
 * Extract the Statement block starting at `startIdx`.
 * The line at startIdx begins with "Statement".
 * Accumulates until ":= by" is found at end of a line, then collects
 * proof body lines until the next top-level keyword at column 0.
 */
function extractStatementAndProof(
  lines: string[],
  startIdx: number,
): StatementResult {
  // Accumulate signature lines until ":= by"
  let sigLines: string[] = []
  let i = startIdx

  while (i < lines.length) {
    const line = lines[i]
    sigLines.push(line)
    if (line.trimEnd().endsWith(':= by')) {
      break
    }
    // Also handle `:= by` followed by a tactic on the same line after it
    if (line.includes(':= by')) {
      break
    }
    i++
  }

  const signature = sigLines.join('\n')
  i++ // move past the := by line

  // Collect proof body: lines until next top-level keyword at column 0
  const proofLines: string[] = []
  while (i < lines.length) {
    const line = lines[i]
    // A line starting at col 0 with a known keyword ends the proof
    if (line.length > 0 && line[0] !== ' ' && line[0] !== '\t' && isTopLevelKeyword(line)) {
      break
    }
    // Also a /-- docstring at col 0
    if (line.startsWith('/--')) {
      break
    }
    proofLines.push(line)
    i++
  }

  return { signature, proofLines, endIdx: i - 1 }
}

// ─── Main parser ─────────────────────────────────────────────────────────────

/**
 * Parse a Lean game level file and return its LevelData.
 * Returns null if the file has no `Statement` (e.g. world intro files).
 */
export function parseLevelFile(
  sourceFilePath: string,
  solutionFilePath: string,
): LevelData | null {
  const content = fs.readFileSync(sourceFilePath, 'utf-8')
  const lines = content.split('\n')

  let world = ''
  let level = 0
  let title = ''
  let introduction = ''
  let conclusion = ''
  let statementDocstring = ''
  let statementSignature = ''
  let hints: GameHint[] = []
  let hasStatement = false

  let pendingDocstring = ''

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // ── Skip blank lines ──
    if (trimmed === '') {
      i++
      continue
    }

    // ── Comments (non-docstring) ──
    if (trimmed.startsWith('--') && !trimmed.startsWith('/--')) {
      i++
      continue
    }

    // ── Docstring /-- ... -/ ──
    if (trimmed.startsWith('/--')) {
      const docLines: string[] = [line]
      if (!trimmed.endsWith('-/')) {
        i++
        while (i < lines.length) {
          const dl = lines[i]
          docLines.push(dl)
          if (dl.trimEnd().endsWith('-/')) {
            break
          }
          i++
        }
      }
      // Strip /-- and -/ markers
      let raw = docLines.join('\n')
      raw = raw.replace(/^\/--\s?/, '').replace(/-\/$/, '').trim()
      pendingDocstring = raw
      i++
      continue
    }

    // ── import ──
    if (trimmed.startsWith('import ')) {
      pendingDocstring = ''
      i++
      continue
    }

    // ── World ──
    if (trimmed.startsWith('World ')) {
      const rest = trimmed.slice('World '.length)
      const res = extractLeanString(lines, i, rest)
      if (res.value !== null) world = res.value
      i = res.endIdx + 1
      pendingDocstring = ''
      continue
    }

    // ── Level ──
    if (trimmed.startsWith('Level ')) {
      const num = parseInt(trimmed.slice('Level '.length).trim(), 10)
      if (!isNaN(num)) level = num
      pendingDocstring = ''
      i++
      continue
    }

    // ── Title ──
    if (trimmed.startsWith('Title ')) {
      const rest = trimmed.slice('Title '.length)
      const res = extractLeanString(lines, i, rest)
      if (res.value !== null) title = res.value
      i = res.endIdx + 1
      pendingDocstring = ''
      continue
    }

    // ── Introduction ──
    if (trimmed.startsWith('Introduction ')) {
      const rest = trimmed.slice('Introduction '.length)
      const res = extractLeanString(lines, i, rest)
      if (res.value !== null) introduction = res.value
      i = res.endIdx + 1
      pendingDocstring = ''
      continue
    }

    // ── Conclusion ──
    if (trimmed.startsWith('Conclusion ')) {
      const rest = trimmed.slice('Conclusion '.length)
      const res = extractLeanString(lines, i, rest)
      if (res.value !== null) conclusion = res.value
      i = res.endIdx + 1
      pendingDocstring = ''
      continue
    }

    // ── Statement ──
    if (trimmed.startsWith('Statement') && (trimmed.length === 9 || /^Statement[\s(:]/.test(trimmed))) {
      hasStatement = true
      statementDocstring = pendingDocstring
      pendingDocstring = ''

      const result = extractStatementAndProof(lines, i)
      statementSignature = result.signature
      hints = extractHints(result.proofLines)
      i = result.endIdx + 1
      continue
    }

    // ── Everything else (TacticDoc, NewTactic, etc.) — skip ──
    pendingDocstring = ''
    i++
  }

  if (!hasStatement) return null

  return {
    sourceFilePath,
    solutionFilePath,
    world,
    level,
    title,
    introduction,
    statementDocstring,
    statementSignature,
    hints,
    conclusion,
  }
}

// ─── Game directory scanner ───────────────────────────────────────────────────

/**
 * Recursively find all .lean files under `levelsDir`.
 */
function findLeanFiles(dir: string): string[] {
  const results: string[] = []
  if (!fs.existsSync(dir)) return results
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      // Skip directories with spaces — they are copies/backups, not valid Lean modules
      if (!entry.name.includes(' ')) results.push(...findLeanFiles(full))
    } else if (entry.isFile() && entry.name.endsWith('.lean')) {
      results.push(full)
    }
  }
  return results
}

/**
 * Compute the solution file path for a given source file.
 *
 * Source:   <gameRoot>/Game/Levels/<rest>.lean
 * Solution: <gameRoot>/Solutions/<rest>.lean
 */
function computeSolutionPath(sourceFilePath: string, gameRoot: string): string {
  const levelsDir = path.join(gameRoot, 'Game', 'Levels')
  const relative = path.relative(levelsDir, sourceFilePath)
  return path.join(gameRoot, 'Solutions', relative)
}

/**
 * Parse all level files in a game directory.
 * Returns only files that contain a Statement.
 */
export function parseGameDirectory(gameRoot: string): LevelData[] {
  const levelsDir = path.join(gameRoot, 'Game', 'Levels')
  const files = findLeanFiles(levelsDir)

  const levels: LevelData[] = []
  for (const file of files) {
    const solutionPath = computeSolutionPath(file, gameRoot)
    try {
      const data = parseLevelFile(file, solutionPath)
      if (data) levels.push(data)
    } catch (e) {
      console.error(`lean-game-vscode: failed to parse ${file}:`, e)
    }
  }

  // Sort by world name then level number
  levels.sort((a, b) => {
    if (a.world !== b.world) return a.world.localeCompare(b.world)
    return a.level - b.level
  })

  return levels
}
