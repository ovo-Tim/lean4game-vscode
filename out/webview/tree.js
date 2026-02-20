;(function () {
  'use strict'

  const vscode   = acquireVsCodeApi()
  const svg      = document.getElementById('tree-svg')
  const emptyMsg = document.getElementById('empty-msg')
  const progress = document.getElementById('overall-progress')
  const btnNext  = document.getElementById('btn-jump-next')

  const SVG_NS = 'http://www.w3.org/2000/svg'

  // ── lean4game orbital metrics ───────────────────────────────────────────────
  // Ported from lean4game/client/src/components/world_tree.tsx
  const DOT_R  = 11   // level dot radius (px)
  const NMIN   = 5    // minimum orbit slots
  const NMAX   = 16   // orbital density cap
  const H_GAP  = 60   // horizontal gap between node footprints
  const V_GAP  = 80   // vertical gap between layers (below label box)
  const LABEL_H  = 22  // label box height
  const LABEL_PX = 10  // label horizontal padding
  const MARGIN   = 28  // canvas edge margin

  const C_COMPLETE = '#388a34'
  const C_UNLOCKED = '#1976d2'
  const C_LOCKED   = '#888888'
  const C_ERROR    = '#be1100'

  /** Compute orbital geometry for a world with the given number of levels. */
  function metrics(numLevels) {
    const N      = Math.max(numLevels, NMIN)
    const beta   = 2 * Math.PI / Math.min(N + 2, NMAX + 1)
    const R_orbit = 1.1 * DOT_R / Math.sin(beta / 2)
    const R_world = R_orbit - 1.2 * DOT_R
    const outerR  = R_orbit + DOT_R + 6   // circular footprint radius
    return { beta, R_orbit, R_world, outerR }
  }

  function isComplete(world) {
    return world?.total > 0 && world.completed === world.total
  }

  function nodeColor(world, unlockedSet) {
    if (isComplete(world)) return C_COMPLETE
    if (!world || unlockedSet.has(world.world)) return C_UNLOCKED
    return C_LOCKED
  }

  // ── Layered layout ──────────────────────────────────────────────────────────
  function computeLayout(worldMap, edges) {
    const allIds = new Set(worldMap.keys())
    for (const e of edges) { allIds.add(e.from); allIds.add(e.to) }
    const ids = Array.from(allIds)

    const preds = new Map(ids.map(id => [id, []]))
    for (const e of edges) preds.get(e.to)?.push(e.from)

    // Longest-path layer assignment with cycle guard
    const layers = new Map(), visiting = new Set()
    function layerOf(id) {
      if (layers.has(id)) return layers.get(id)
      if (visiting.has(id)) return 0
      visiting.add(id)
      const ps = preds.get(id) || []
      const L  = ps.length ? Math.max(...ps.map(layerOf)) + 1 : 0
      visiting.delete(id)
      layers.set(id, L)
      return L
    }
    ids.forEach(layerOf)

    const maxL   = Math.max(...layers.values(), 0)
    const byLayer = Array.from({ length: maxL + 1 }, () => [])
    for (const id of ids) byLayer[layers.get(id) ?? 0].push(id)

    // Barycenter ordering within each layer (one top-down pass)
    const xRank = new Map()
    byLayer[0].sort().forEach((id, i) => xRank.set(id, i))
    for (let l = 1; l <= maxL; l++) {
      byLayer[l].sort((a, b) => {
        const bar = n => {
          const ps = preds.get(n) || []
          return ps.length ? ps.reduce((s, p) => s + (xRank.get(p) ?? 0), 0) / ps.length : 0
        }
        return bar(a) - bar(b)
      })
      byLayer[l].forEach((id, i) => xRank.set(id, i))
    }

    // Assign pixel centers (cx, cy) using circular footprints
    const pos = new Map()
    let layerTopY = MARGIN
    for (let l = 0; l <= maxL; l++) {
      const layer = byLayer[l]
      const maxOR = layer.reduce(
        (m, id) => Math.max(m, metrics((worldMap.get(id)?.levels ?? []).length).outerR),
        0,
      )
      const cy = layerTopY + maxOR  // circle center Y for this layer

      let cx = MARGIN
      for (const id of layer) {
        const { outerR } = metrics((worldMap.get(id)?.levels ?? []).length)
        cx += outerR
        pos.set(id, { cx, cy })
        cx += outerR + H_GAP
      }

      layerTopY = cy + maxOR + LABEL_H + V_GAP
    }

    return pos
  }

  // ── SVG element helper ──────────────────────────────────────────────────────
  function el(tag, attrs, text) {
    const e = document.createElementNS(SVG_NS, tag)
    if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
    if (text != null) e.textContent = text
    return e
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  function render(worlds, edges) {
    svg.innerHTML = ''

    if (!worlds?.length) {
      svg.classList.add('hidden')
      emptyMsg.classList.remove('hidden')
      return
    }
    svg.classList.remove('hidden')
    emptyMsg.classList.add('hidden')

    const worldMap = new Map(worlds.map(w => [w.world, w]))

    // Determine which worlds are unlocked:
    // a world is unlocked when all its predecessors are complete (or it has none)
    const allIds = new Set(worldMap.keys())
    for (const e of edges) { allIds.add(e.from); allIds.add(e.to) }
    const predsMap = new Map()
    for (const id of allIds) predsMap.set(id, [])
    for (const e of edges) predsMap.get(e.to)?.push(e.from)

    const unlockedSet = new Set()
    for (const id of allIds) {
      if ((predsMap.get(id) || []).every(p => isComplete(worldMap.get(p)))) {
        unlockedSet.add(id)
      }
    }

    const pos = computeLayout(worldMap, edges)

    // ── Edges ──────────────────────────────────────────────────────────────
    const edgeG = el('g')
    for (const e of edges) {
      const p1 = pos.get(e.from), p2 = pos.get(e.to)
      if (!p1 || !p2) continue
      const { outerR: or1 } = metrics((worldMap.get(e.from)?.levels ?? []).length)
      const { outerR: or2 } = metrics((worldMap.get(e.to)?.levels   ?? []).length)
      const x1 = p1.cx, y1 = p1.cy + or1
      const x2 = p2.cx, y2 = p2.cy - or2
      const mid = (y1 + y2) / 2
      const done = isComplete(worldMap.get(e.from))
      edgeG.appendChild(el('path', {
        d: `M ${x1} ${y1} C ${x1} ${mid},${x2} ${mid},${x2} ${y2}`,
        fill: 'none',
        stroke: done ? C_COMPLETE : '#666',
        'stroke-width': done ? 3.5 : 2,
        opacity: done ? 0.85 : 0.45,
      }))
    }
    svg.appendChild(edgeG)

    // ── World nodes ────────────────────────────────────────────────────────
    const nodeG = el('g')
    for (const [id, { cx, cy }] of pos) {
      const world  = worldMap.get(id)
      const levels = world?.levels ?? []
      const { beta, R_orbit, R_world, outerR } = metrics(levels.length)
      const color = nodeColor(world, unlockedSet)

      const g = el('g', { class: 'world-node' })

      // ── World bubble ──
      g.appendChild(el('circle', { cx, cy, r: R_world, fill: color, opacity: 0.85 }))

      // Completion count in bubble center
      if (world?.total > 0) {
        g.appendChild(el('text', {
          x: cx, y: cy + 5,
          'text-anchor': 'middle', 'dominant-baseline': 'middle',
          'font-size': 13, 'font-weight': 'bold',
          fill: '#fff', 'pointer-events': 'none',
        }, `${world.completed}/${world.total}`))
      }

      // ── Level dots in circular orbit ──
      // Level numbers are 1-indexed in the game DSL; use lvl.level for angle
      for (const lvl of levels) {
        const angle = lvl.level * beta
        const dcx = cx + Math.sin(angle) * R_orbit
        const dcy = cy - Math.cos(angle) * R_orbit

        let fill, stroke, sw
        if (lvl.status === 'complete') {
          fill = C_COMPLETE; stroke = C_COMPLETE; sw = 1
        } else if (lvl.status === 'has-errors') {
          fill = C_ERROR; stroke = C_ERROR; sw = 1
        } else {
          fill = 'rgba(255,255,255,0.08)'
          stroke = lvl.isNext ? C_UNLOCKED : 'rgba(255,255,255,0.35)'
          sw = lvl.isNext ? 2.5 : 1.5
        }

        const dot = el('circle', {
          cx: dcx, cy: dcy, r: DOT_R,
          fill, stroke, 'stroke-width': sw,
          class: 'level-dot',
        })
        const tip = document.createElementNS(SVG_NS, 'title')
        tip.textContent = `Level ${lvl.level}${lvl.title ? ': ' + lvl.title : ''}`
        dot.appendChild(tip)
        dot.addEventListener('click', () =>
          vscode.postMessage({ type: 'openLevel', filePath: lvl.filePath }))
        g.appendChild(dot)

        // Level number inside dot
        const solid = lvl.status === 'complete' || lvl.status === 'has-errors'
        g.appendChild(el('text', {
          x: dcx, y: dcy + 4,
          'text-anchor': 'middle',
          'font-size': 8, 'font-weight': 'bold',
          fill: solid ? '#fff' : 'rgba(255,255,255,0.65)',
          'pointer-events': 'none',
        }, lvl.level))
      }

      // ── Colored label box below circle ──
      const lblY = cy + outerR + 3
      const lblW = Math.max(id.length * 7.5 + LABEL_PX * 2, R_world * 2 + 16)
      g.appendChild(el('rect', {
        x: cx - lblW / 2, y: lblY, width: lblW, height: LABEL_H,
        rx: 4, fill: color, opacity: 0.9,
      }))
      g.appendChild(el('text', {
        x: cx, y: lblY + LABEL_H / 2 + 4.5,
        'text-anchor': 'middle',
        'font-size': 11, 'font-weight': 600,
        fill: '#fff',
        'font-family': 'var(--vscode-font-family,sans-serif)',
        'pointer-events': 'none',
      }, id))

      nodeG.appendChild(g)
    }
    svg.appendChild(nodeG)

    // Size the SVG canvas
    let maxX = 0, maxY = 0
    for (const [id, { cx, cy }] of pos) {
      const { outerR } = metrics((worldMap.get(id)?.levels ?? []).length)
      maxX = Math.max(maxX, cx + outerR)
      maxY = Math.max(maxY, cy + outerR + LABEL_H + 8)
    }
    svg.setAttribute('width',  maxX + MARGIN)
    svg.setAttribute('height', maxY + MARGIN)

    // Scroll into view of the next incomplete level
    const nextWorld = worlds.find(w => w.levels.some(l => l.isNext))
    if (nextWorld) {
      const p = pos.get(nextWorld.world)
      if (p) {
        requestAnimationFrame(() => {
          const { outerR } = metrics((worldMap.get(nextWorld.world)?.levels ?? []).length)
          document.getElementById('tree-container')
            .scrollTo({ top: Math.max(0, p.cy - outerR - 60), behavior: 'smooth' })
        })
      }
    }
  }

  // ── Events ──────────────────────────────────────────────────────────────────
  btnNext.addEventListener('click', () => vscode.postMessage({ type: 'jumpToNext' }))

  window.addEventListener('message', (event) => {
    const msg = event.data
    if (msg.type !== 'treeUpdate') return

    const worlds    = msg.worlds ?? []
    const edges     = msg.edges  ?? []
    const total     = worlds.reduce((s, w) => s + w.total, 0)
    const completed = worlds.reduce((s, w) => s + w.completed, 0)
    progress.textContent = total > 0 ? `${completed} / ${total} complete` : 'No game loaded'
    btnNext.classList.toggle('hidden', !msg.nextFilePath)
    render(worlds, edges)
  })
})()
