import * as fs from 'fs'
import * as vscode from 'vscode'
import { parseGameDirectory } from '../parser/leanGameParser'
import { parseGameDependencies } from '../parser/gameLeanParser'
import { generateAllSolutions } from '../generator/solutionGenerator'
import { GameInfoPanel } from '../panel/gameInfoPanel'
import { TreePanel } from '../panel/treePanel'
import { SolutionWatcher } from '../watcher/solutionWatcher'

/** Wire cross-panel message handlers (called once after all panels are created). */
export function wireMessageHandlers(
  panel:      GameInfoPanel,
  treePanel:  TreePanel,
  watcher:    SolutionWatcher,
): void {
  // Game panel → extension
  panel.onMessage((msg) => {
    if (msg.type === 'showTree') {
      treePanel.createOrShow()
    } else if (msg.type === 'nextLevel') {
      const fp = watcher.getNextLevelFilePath()
      if (fp) {
        void vscode.commands.executeCommand('vscode.open', vscode.Uri.file(fp), {
          viewColumn: vscode.ViewColumn.One,
          preserveFocus: false,
        })
        panel.createOrShow()
      }
    }
    // 'openFile' messages are no longer sent from game panel (nav only uses showTree / nextLevel)
  })

  // Tree panel → extension
  treePanel.onMessage((msg) => {
    if (msg.type === 'openLevel' && typeof msg.filePath === 'string') {
      void vscode.commands.executeCommand('vscode.open', vscode.Uri.file(msg.filePath), {
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: false,
      })
      panel.createOrShow()
    } else if (msg.type === 'jumpToNext') {
      const fp = watcher.getNextLevelFilePath()
      if (fp) {
        void vscode.commands.executeCommand('vscode.open', vscode.Uri.file(fp), {
          viewColumn: vscode.ViewColumn.One,
          preserveFocus: false,
        })
        panel.createOrShow()
      }
    }
  })
}

export function registerCommands(
  context:   vscode.ExtensionContext,
  panel:     GameInfoPanel,
  treePanel: TreePanel,
  watcher:   SolutionWatcher,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('leanGame.openGame', async () => {
      const uris = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: 'Select Game Root',
        title: 'Select Lean Game Root Directory',
      })
      if (!uris || uris.length === 0) return

      const gameRoot = uris[0].fsPath
      await loadGame(gameRoot, panel, treePanel, watcher, false)

      await vscode.workspace
        .getConfiguration('leanGame')
        .update('gameRootPath', gameRoot, vscode.ConfigurationTarget.Global)
    }),

    vscode.commands.registerCommand('leanGame.showPanel', () => {
      panel.createOrShow()
    }),

    vscode.commands.registerCommand('leanGame.showTree', () => {
      treePanel.createOrShow()
    }),

    vscode.commands.registerCommand('leanGame.importProgress', async () => {
      // Ensure a game is loaded
      const gameRoot = vscode.workspace
        .getConfiguration('leanGame')
        .get<string>('gameRootPath')
      if (!gameRoot?.trim()) {
        vscode.window.showWarningMessage('No game loaded. Use "Lean Game: Open Game" first.')
        return
      }

      const levels = watcher.getLevels()
      if (levels.length === 0) {
        vscode.window.showWarningMessage('No levels loaded. Use "Lean Game: Open Game" first.')
        return
      }

      // File picker for JSON
      const uris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        openLabel: 'Import',
        title: 'Select lean4game progress JSON export',
        filters: { 'JSON files': ['json'] },
      })
      if (!uris || uris.length === 0) return

      // Parse JSON — expect { data: { WorldName: { "1": { code, completed }, … }, … } }
      let worldData: Record<string, Record<string, { code?: string; completed?: boolean }>>
      try {
        const raw    = fs.readFileSync(uris[0].fsPath, 'utf-8')
        const parsed = JSON.parse(raw)
        if (!parsed.data || typeof parsed.data !== 'object') {
          throw new Error('JSON is missing a top-level "data" field.')
        }
        worldData = parsed.data
      } catch (e: any) {
        vscode.window.showErrorMessage(`Failed to parse progress JSON: ${e.message}`)
        return
      }

      // Build lookup: "WorldName:levelNumber" → LevelData
      const lookup = new Map<string, typeof levels[0]>()
      for (const level of levels) {
        lookup.set(`${level.world}:${level.level}`, level)
      }

      let imported = 0
      let skipped  = 0
      let missing  = 0
      const importedPaths: string[] = []

      for (const [world, levelMap] of Object.entries(worldData)) {
        for (const [key, entry] of Object.entries(levelMap)) {
          // Skip non-numeric keys like "readIntro"
          const levelNum = parseInt(key)
          if (isNaN(levelNum) || typeof entry !== 'object') continue

          if (!entry.completed) {
            skipped++
            continue
          }

          const level = lookup.get(`${world}:${levelNum}`)
          if (!level) { missing++; continue }

          if (writeImportedProof(level.solutionFilePath, entry.code ?? '')) {
            importedPaths.push(level.solutionFilePath)
            imported++
          } else {
            missing++
          }
        }
      }

      // Refresh the tree / panel status for touched files
      watcher.invalidateAndRefresh(importedPaths)

      const parts = [`Imported ${imported} level${imported !== 1 ? 's' : ''}.`]
      if (skipped > 0)  parts.push(`${skipped} incomplete in JSON (skipped).`)
      if (missing > 0)  parts.push(`${missing} not found in current game.`)
      vscode.window.showInformationMessage(parts.join('  '))
    }),

    vscode.commands.registerCommand('leanGame.regenerateSolutions', async () => {
      const gameRoot = vscode.workspace
        .getConfiguration('leanGame')
        .get<string>('gameRootPath')
      if (!gameRoot) {
        vscode.window.showWarningMessage('No game loaded. Use "Lean Game: Open Game" first.')
        return
      }

      const answer = await vscode.window.showWarningMessage(
        'This will overwrite all auto-generated solution stubs. Your proofs will be replaced with `sorry`. Continue?',
        { modal: true },
        'Overwrite',
      )
      if (answer !== 'Overwrite') return

      await loadGame(gameRoot, panel, treePanel, watcher, true)
    }),
  )
}

export async function loadGame(
  gameRoot:  string,
  panel:     GameInfoPanel,
  treePanel: TreePanel,
  watcher:   SolutionWatcher,
  overwrite: boolean,
): Promise<void> {
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Lean Game', cancellable: false },
    async (progress) => {
      progress.report({ message: 'Parsing levels…' })
      const levels = parseGameDirectory(gameRoot)

      if (levels.length === 0) {
        vscode.window.showWarningMessage(
          `No levels with statements found in ${gameRoot}/Game/Levels/`,
        )
        return
      }

      progress.report({ message: 'Parsing dependencies…' })
      const edges = parseGameDependencies(gameRoot, levels)

      progress.report({ message: `Generating ${levels.length} solution stubs…` })
      const stats = generateAllSolutions(levels, overwrite)

      progress.report({ message: 'Loading level index…' })
      watcher.loadLevels(levels, edges)
      treePanel.createOrShow()

      vscode.window.showInformationMessage(
        `Lean Game loaded: ${levels.length} levels across ${new Set(levels.map(l => l.world)).size} worlds. ` +
          `${stats.created} solution files created, ${stats.skipped} already existed.`,
      )
    },
  )
}

/**
 * Write an imported proof into a solution file.
 *
 * Finds the `:= by` marker in the file and replaces everything after it
 * with the imported tactic code (each line indented by two spaces).
 * Returns true if the file was successfully updated.
 */
/**
 * Marker inserted before `sorry` for levels that were completed in lean4game
 * but whose proof code was not captured in the export.
 * The watcher's `checkFileContent` and `getCompletionStatus` recognise this
 * marker and report the level as 'complete' despite the presence of `sorry`.
 */
const IMPORT_MARKER = '-- lean4game-imported: completed'

/**
 * Write an imported proof into a solution file.
 *
 * Finds the `:= by` marker in the file and replaces everything after it:
 *   – If `code` is non-empty: use the actual tactic lines (2-space indented).
 *   – If `code` is empty: write IMPORT_MARKER + sorry so the watcher treats
 *     the level as complete even though Lean would still warn about sorry.
 *
 * Skips files that already have a real proof (no `sorry` and no import marker)
 * so that user-written proofs are never overwritten by a marker-only import.
 *
 * Returns true if the file was successfully updated.
 */
function writeImportedProof(filePath: string, code: string): boolean {
  try {
    if (!fs.existsSync(filePath)) return false

    const content = fs.readFileSync(filePath, 'utf-8')
    const byMarker = ':= by\n'
    const idx = content.lastIndexOf(byMarker)
    if (idx === -1) return false

    const trimmedCode = code.trim()

    if (!trimmedCode) {
      // No proof code captured — write the import marker before sorry.
      // Skip if the file already has a real proof or the marker.
      if (!content.includes('sorry') || content.includes(IMPORT_MARKER)) return false
      fs.writeFileSync(
        filePath,
        content.slice(0, idx + byMarker.length) + `  ${IMPORT_MARKER}\n  sorry\n`,
        'utf-8',
      )
    } else {
      // Actual proof code — indent and write it.
      const indented = trimmedCode
        .split('\n')
        .map(line => (line ? '  ' + line : ''))
        .join('\n')
      fs.writeFileSync(
        filePath,
        content.slice(0, idx + byMarker.length) + indented + '\n',
        'utf-8',
      )
    }

    return true
  } catch {
    return false
  }
}
