import * as fs from 'fs'
import * as vscode from 'vscode'
import { CompletionStatus, LevelData, WorldEdge } from '../parser/types'
import { GameInfoPanel } from '../panel/gameInfoPanel'
import { TreePanel } from '../panel/treePanel'
import { LspIntegration } from '../lean/lspIntegration'

// ─── Completion detection ─────────────────────────────────────────────────────

/** Marker written by the JSON importer for levels completed in lean4game without captured code. */
const IMPORT_MARKER = '-- lean4game-imported: completed'

function getCompletionStatus(uri: vscode.Uri): CompletionStatus {
  const diags = vscode.languages.getDiagnostics(uri)
  const errors = diags.filter(
    (d) => d.severity === vscode.DiagnosticSeverity.Error,
  )
  const sorrys = diags.filter(
    (d) =>
      d.severity === vscode.DiagnosticSeverity.Warning &&
      d.message.includes("'sorry'"),
  )
  if (errors.length > 0) return 'has-errors'
  if (sorrys.length > 0) {
    // If the file carries the import marker, treat it as complete even with sorry
    try {
      if (fs.readFileSync(uri.fsPath, 'utf-8').includes(IMPORT_MARKER)) return 'complete'
    } catch { /* ignore */ }
    return 'incomplete'
  }
  return 'complete'
}

/**
 * Fast file-content check for files Lean hasn't processed yet.
 * Returns 'incomplete' if the file contains `sorry`, 'complete' otherwise.
 */
function checkFileContent(filePath: string): CompletionStatus {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    if (content.includes(IMPORT_MARKER)) return 'complete'
    return content.includes('sorry') ? 'incomplete' : 'complete'
  } catch {
    return 'incomplete'
  }
}

// ─── SolutionWatcher ─────────────────────────────────────────────────────────

export class SolutionWatcher implements vscode.Disposable {
  private levelIndex  = new Map<string, LevelData>()
  private statusCache = new Map<string, CompletionStatus>()
  private sortedLevels: LevelData[] = []
  private edges: WorldEdge[] = []
  private disposables: vscode.Disposable[] = []

  constructor(
    private readonly panel:     GameInfoPanel,
    private readonly lsp:       LspIntegration,
    private readonly treePanel: TreePanel,
  ) {}

  loadLevels(levels: LevelData[], edges: WorldEdge[]): void {
    this.levelIndex.clear()
    this.statusCache.clear()
    this.sortedLevels = levels
    this.edges = edges

    for (const level of levels) {
      this.levelIndex.set(level.solutionFilePath, level)
    }

    this.disposables.forEach((d) => d.dispose())
    this.disposables = []

    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) this.handleEditorChange(editor)
      }),

      vscode.languages.onDidChangeDiagnostics((e) => {
        const activeUri = vscode.window.activeTextEditor?.document.uri
        let activeChanged = false

        for (const uri of e.uris) {
          if (!this.levelIndex.has(uri.fsPath)) continue
          const status = getCompletionStatus(uri)
          this.statusCache.set(uri.fsPath, status)
          if (activeUri && uri.toString() === activeUri.toString()) {
            activeChanged = true
          }
        }

        if (activeChanged && activeUri) {
          const level  = this.levelIndex.get(activeUri.fsPath)
          const status = this.statusCache.get(activeUri.fsPath) ?? 'incomplete'
          if (level) {
            this.panel.updateCompletionStatus(status)
            if (status === 'complete') this.panel.update(level, status)
          }
        }

        this.sendUpdates()
      }),

      vscode.window.onDidChangeTextEditorSelection(async (e) => {
        const editor = e.textEditor
        if (!this.levelIndex.has(editor.document.uri.fsPath)) return
        const pos = editor.selection.active
        const uri = editor.document.uri.toString()
        const goals = await this.lsp.getGoals(uri, {
          line: pos.line,
          character: pos.character,
        })
        this.panel.updateGoals(goals)
      }),
    )

    this.sendUpdates()
    const current = vscode.window.activeTextEditor
    if (current) this.handleEditorChange(current)
  }

  /** Return all currently loaded levels in sorted order. */
  getLevels(): LevelData[] {
    return this.sortedLevels
  }

  /**
   * Remove cached statuses for the given file paths and re-send progress
   * updates to both panels. Call after externally modifying solution files
   * (e.g., after importing proofs from a lean4game JSON export).
   */
  invalidateAndRefresh(filePaths: string[]): void {
    for (const fp of filePaths) this.statusCache.delete(fp)
    this.sendUpdates()
  }

  /** Return the file path of the first non-complete level, or null. */
  getNextLevelFilePath(): string | null {
    for (const level of this.sortedLevels) {
      const status =
        this.statusCache.get(level.solutionFilePath) ??
        checkFileContent(level.solutionFilePath)
      if (status !== 'complete') return level.solutionFilePath
    }
    return null
  }

  private handleEditorChange(editor: vscode.TextEditor): void {
    const level = this.levelIndex.get(editor.document.uri.fsPath)
    if (!level) return  // non-solution file — keep last panel content
    const status =
      this.statusCache.get(level.solutionFilePath) ??
      checkFileContent(level.solutionFilePath)
    this.panel.update(level, status)
  }

  /** Push progress to both the game panel and tree panel. */
  private sendUpdates(): void {
    const worldMap = new Map<string, { completed: number; total: number; levels: any[] }>()

    let foundNext    = false
    let nextFilePath: string | null = null

    const worldsOrdered: string[] = []
    for (const level of this.sortedLevels) {
      if (!worldMap.has(level.world)) {
        worldMap.set(level.world, { completed: 0, total: 0, levels: [] })
        worldsOrdered.push(level.world)
      }
      const entry  = worldMap.get(level.world)!
      const status = this.statusCache.get(level.solutionFilePath) ?? checkFileContent(level.solutionFilePath)
      const isNext = !foundNext && status !== 'complete'
      if (isNext) { foundNext = true; nextFilePath = level.solutionFilePath }
      if (status === 'complete') entry.completed++
      entry.total++
      entry.levels.push({
        level:    level.level,
        title:    level.title,
        filePath: level.solutionFilePath,
        status,
        isNext,
      })
    }

    const worlds = worldsOrdered.map((world) => {
      const e = worldMap.get(world)!
      return { world, levels: e.levels, completed: e.completed, total: e.total }
    })

    // Tree panel: full graph data
    this.treePanel.update({ worlds, edges: this.edges, nextFilePath })

    // Game panel: just whether there is a next level
    this.panel.setHasNext(nextFilePath !== null)
  }

  clear(): void {
    this.levelIndex.clear()
    this.statusCache.clear()
    this.sortedLevels = []
    this.edges = []
    this.panel.showEmpty()
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose())
  }
}
