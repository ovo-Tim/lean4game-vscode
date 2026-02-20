// panel.js — runs inside the Lean Game VSCode WebView
// PanelVendor is the IIFE global from panelVendor.js

(function () {
  'use strict'

  const vscode = acquireVsCodeApi()

  // ── Set up marked with KaTeX ────────────────────────────────────────────
  const { marked, markedKatex } = window.PanelVendor

  marked.use(
    markedKatex({
      throwOnError: false,
      output: 'html',
    }),
  )

  // ── DOM refs ────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id)

  const statusBar      = $('status-bar')
  const statusIcon     = $('status-icon')
  const statusText     = $('status-text')
  const content        = $('content')
  const emptyState     = $('empty-state')

  const levelWorldLevel  = $('level-world-level')
  const levelTitle       = $('level-title')
  const introContent     = $('intro-content')
  const goalsContent     = $('goals-content')
  const sectionHints     = $('section-hints')
  const hintsContent     = $('hints-content')
  const btnShowHidden    = $('btn-show-hidden')
  const hiddenHintsContent = $('hidden-hints-content')
  const sectionConclusion  = $('section-conclusion')
  const conclusionContent  = $('conclusion-content')

  const navButtons   = $('nav-buttons')
  const btnTreeView  = $('btn-tree-view')
  const btnNextLevel = $('btn-next-level')

  // ── State ───────────────────────────────────────────────────────────────
  let hiddenHintsVisible = false

  // ── Helpers ─────────────────────────────────────────────────────────────
  function renderMarkdown(text) {
    if (!text) return ''
    return marked.parse(text)
  }

  function setStatus(status) {
    statusBar.className = 'status-bar ' + status
    if (status === 'complete') {
      statusIcon.textContent = '✓'
      statusText.textContent = 'Level complete!'
    } else if (status === 'has-errors') {
      statusIcon.textContent = '✗'
      statusText.textContent = 'Has errors'
    } else {
      statusIcon.textContent = '…'
      statusText.textContent = 'Working…'
    }
  }

  function renderGoals(goals) {
    if (!goals || goals.length === 0) {
      goalsContent.className = 'goals-empty'
      goalsContent.innerHTML =
        'Move cursor into a <code>by</code> block to see goals'
      return
    }

    goalsContent.className = ''
    const fragments = goals.map((goal, idx) => {
      let html = '<div class="goal-block">'

      if (goal.userName) {
        html += `<div class="goal-username">Goal: ${escapeHtml(goal.userName)}</div>`
      }

      if (goal.hypotheses && goal.hypotheses.length > 0) {
        html += '<div class="hypotheses">'
        for (const h of goal.hypotheses) {
          const names  = h.names.join(' ')
          const valPart = h.val ? ` := ${h.val}` : ''
          html += `<div class="hyp-row">
            <span class="hyp-names">${escapeHtml(names)}</span>
            <span class="hyp-sep">:</span>
            <span class="hyp-type">${escapeHtml(h.type)}${escapeHtml(valPart)}</span>
          </div>`
        }
        html += '</div>'
      }

      html += `<div class="goal-turnstile">
        <span class="turnstile-symbol">⊢</span>
        <span class="goal-type-text">${escapeHtml(goal.goalType)}</span>
      </div>`

      html += '</div>'
      if (idx < goals.length - 1) html += '<hr class="goal-separator" />'
      return html
    })

    goalsContent.innerHTML = fragments.join('')
  }

  function renderHints(hints) {
    const visible = hints.filter((h) => !h.hidden)
    const hidden  = hints.filter((h) => h.hidden)

    if (visible.length === 0 && hidden.length === 0) {
      sectionHints.classList.add('hidden')
      return
    }

    sectionHints.classList.remove('hidden')

    hintsContent.innerHTML = visible
      .map((h) => `<div class="hint-item">${renderMarkdown(h.text)}</div>`)
      .join('')

    if (hidden.length > 0) {
      btnShowHidden.classList.remove('hidden')
      hiddenHintsContent.innerHTML = hidden
        .map((h) => `<div class="hint-item hidden-hint">${renderMarkdown(h.text)}</div>`)
        .join('')
    } else {
      btnShowHidden.classList.add('hidden')
      hiddenHintsContent.classList.add('hidden')
    }
  }

  function escapeHtml(str) {
    if (!str) return ''
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  // ── Nav button handlers ─────────────────────────────────────────────────
  btnTreeView.addEventListener('click', () => {
    vscode.postMessage({ type: 'showTree' })
  })

  btnNextLevel.addEventListener('click', () => {
    vscode.postMessage({ type: 'nextLevel' })
  })

  // ── Hints toggle ────────────────────────────────────────────────────────
  btnShowHidden.addEventListener('click', () => {
    hiddenHintsVisible = !hiddenHintsVisible
    if (hiddenHintsVisible) {
      hiddenHintsContent.classList.remove('hidden')
      btnShowHidden.textContent = 'Hide extra help'
    } else {
      hiddenHintsContent.classList.add('hidden')
      btnShowHidden.textContent = 'Show more help'
    }
  })

  // ── Message handling ────────────────────────────────────────────────────
  window.addEventListener('message', (event) => {
    const msg = event.data

    if (msg.type === 'empty') {
      content.classList.add('hidden')
      navButtons.classList.add('hidden')
      emptyState.classList.remove('hidden')
      statusBar.className = 'status-bar'
      statusIcon.textContent = ''
      statusText.textContent = 'No level loaded'
      return
    }

    if (msg.type === 'update') {
      const { level, status } = msg

      content.classList.remove('hidden')
      emptyState.classList.add('hidden')
      navButtons.classList.remove('hidden')

      levelWorldLevel.textContent = `${level.world} · Level ${level.level}`
      levelTitle.textContent = level.title
      introContent.innerHTML = renderMarkdown(level.introduction)

      // Reset hints
      hiddenHintsVisible = false
      hiddenHintsContent.classList.add('hidden')
      btnShowHidden.textContent = 'Show more help'
      renderHints(level.hints || [])

      // Conclusion
      if (status === 'complete' && level.conclusion) {
        sectionConclusion.classList.remove('hidden')
        conclusionContent.innerHTML = renderMarkdown(level.conclusion)
      } else {
        sectionConclusion.classList.add('hidden')
      }

      setStatus(status)

      // Reset goals
      goalsContent.className = 'goals-empty'
      goalsContent.innerHTML =
        'Move cursor into a <code>by</code> block to see goals'
      return
    }

    if (msg.type === 'statusUpdate') {
      setStatus(msg.status)
      if (msg.status === 'complete') {
        sectionConclusion.classList.remove('hidden')
      } else {
        sectionConclusion.classList.add('hidden')
      }
      return
    }

    if (msg.type === 'goalsUpdate') {
      renderGoals(msg.goals)
      return
    }

    if (msg.type === 'setHasNext') {
      if (msg.hasNext) {
        btnNextLevel.classList.remove('hidden')
      } else {
        btnNextLevel.classList.add('hidden')
      }
      return
    }
  })
})()
