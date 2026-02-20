import * as fs from 'fs'
import * as path from 'path'
import { LevelData, WorldEdge } from './types'

/**
 * Find the main game .lean file (Game.lean or <DirName>.lean).
 */
function findGameLean(gameRoot: string): string | null {
  const dirName = path.basename(gameRoot)
  for (const candidate of ['Game.lean', `${dirName}.lean`]) {
    const p = path.join(gameRoot, candidate)
    if (fs.existsSync(p)) return p
  }
  return null
}

/**
 * Parse `Dependency X → Y` declarations from the game's main .lean file,
 * then supplement with implicit ordering edges inferred from world positions.
 *
 * Many Lean games only declare "non-obvious" prerequisites explicitly.
 * The sequential ordering (L1 → L2 → L3 …) is implicit in the directory
 * naming convention used under Game/Levels/.
 *
 * Algorithm for implicit edges:
 *   – Map each world to its source directory using the parsed level paths
 *     (e.g., world "L3Pset" lives in "…/Game/Levels/L3Pset/").
 *   – Extract the leading L<N> numeric prefix (e.g., L3) from that directory name.
 *   – Group worlds by prefix number.  Within each group, sort so that
 *     non-Pset directories (lectures, stories, …) come before Pset directories
 *     — this matches the typical game authoring order.
 *   – For each world with no explicit predecessor:
 *       • Worlds in the first group: the very first world is the root; the
 *         rest depend on it (they are siblings one level below the opener).
 *       • Worlds in later groups N: depend on the "anchor" of group N-1,
 *         where anchor = first world in that group with no explicit predecessor
 *         (falling back to the very first world if all have predecessors).
 *
 * This places all no-predecessor worlds in the same L<N> group at the same
 * depth as siblings, giving the expected L1 → [L2 worlds] → [L3 worlds] …
 * layered structure without requiring every dependency to be declared.
 */
export function parseGameDependencies(gameRoot: string, levels: LevelData[]): WorldEdge[] {
  const gameLean = findGameLean(gameRoot)
  if (!gameLean) return []

  const content = fs.readFileSync(gameLean, 'utf-8')

  // ── 1. Explicit Dependency edges ────────────────────────────────────────────
  const explicitEdges: WorldEdge[] = []
  for (const line of content.split('\n')) {
    const m = line.match(/^Dependency\s+(\S+)\s+(?:→|->)\s+(\S+)/)
    if (m) explicitEdges.push({ from: m[1], to: m[2] })
  }

  // ── 2. World → source directory (from parsed levels' file paths) ────────────
  // sourceFilePath: …/Game/Levels/<dir>/<file>.lean  →  capture <dir>
  const worldDir = new Map<string, string>()  // world name → directory name
  for (const level of levels) {
    if (worldDir.has(level.world)) continue
    const m = level.sourceFilePath.match(/Game[/\\]Levels[/\\]([^/\\]+)/)
    if (m) worldDir.set(level.world, m[1])
  }

  // ── 3. Group worlds by L<N> prefix of their source directory ───────────────
  const groupMap = new Map<number, Set<string>>()
  for (const [world, dir] of worldDir) {
    const m = dir.match(/^[Ll](\d+)/)
    if (!m) continue
    const g = parseInt(m[1])
    if (!groupMap.has(g)) groupMap.set(g, new Set())
    groupMap.get(g)!.add(world)
  }

  if (groupMap.size === 0) return explicitEdges

  // ── 4. Sort within each group: lecture/story directories first, Pset last ──
  // Matching on the directory name (not the world name) keeps this robust.
  const isPsetDir = (world: string) => /pset/i.test(worldDir.get(world) ?? '')

  const groups = new Map<number, string[]>()
  for (const [g, worldSet] of groupMap) {
    const sorted = Array.from(worldSet).sort((a, b) => {
      const pa = isPsetDir(a), pb = isPsetDir(b)
      if (pa !== pb) return pa ? 1 : -1   // non-Pset first
      // alphabetical within each sub-group
      return (worldDir.get(a) ?? '').localeCompare(worldDir.get(b) ?? '')
    })
    groups.set(g, sorted)
  }

  const groupNums = Array.from(groups.keys()).sort((a, b) => a - b)

  // ── 5. Track which worlds already have an explicit predecessor ──────────────
  const hasExplicitPred = new Set<string>()
  for (const e of explicitEdges) hasExplicitPred.add(e.to)

  // ── 6. Anchor = first world in a group without an explicit predecessor ──────
  function anchor(worldList: string[]): string | null {
    return worldList.find(w => !hasExplicitPred.has(w)) ?? worldList[0] ?? null
  }

  // ── 7. Generate implicit edges ──────────────────────────────────────────────
  const implicitEdges: WorldEdge[] = []

  for (let gi = 0; gi < groupNums.length; gi++) {
    const worlds     = groups.get(groupNums[gi])!
    const prevAnchor = gi > 0 ? anchor(groups.get(groupNums[gi - 1])!) : null

    for (let wi = 0; wi < worlds.length; wi++) {
      const world = worlds[wi]
      if (hasExplicitPred.has(world)) continue  // already has a declared predecessor

      if (gi === 0) {
        // First group: the very first world is the root; later ones depend on it
        if (wi > 0) implicitEdges.push({ from: worlds[0], to: world })
      } else {
        // Later groups: all no-predecessor worlds → depend on prev-group anchor
        if (prevAnchor && prevAnchor !== world) {
          implicitEdges.push({ from: prevAnchor, to: world })
        }
      }
    }
  }

  return [...explicitEdges, ...implicitEdges]
}
