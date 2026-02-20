import * as vscode from 'vscode'
import { GameInfoPanel } from './panel/gameInfoPanel'
import { TreePanel } from './panel/treePanel'
import { LspIntegration } from './lean/lspIntegration'
import { SolutionWatcher } from './watcher/solutionWatcher'
import { registerCommands, wireMessageHandlers, loadGame } from './commands/registerCommands'

export function activate(context: vscode.ExtensionContext): void {
  const panel     = new GameInfoPanel(context.extensionUri)
  const treePanel = new TreePanel(context.extensionUri)
  const lsp       = new LspIntegration()
  const watcher   = new SolutionWatcher(panel, lsp, treePanel)

  context.subscriptions.push(panel, treePanel, lsp, watcher)

  wireMessageHandlers(panel, treePanel, watcher)
  registerCommands(context, panel, treePanel, watcher)

  // Auto-load if a game root path is configured
  const gameRootPath = vscode.workspace
    .getConfiguration('leanGame')
    .get<string>('gameRootPath')

  if (gameRootPath && gameRootPath.trim() !== '') {
    void loadGame(gameRootPath, panel, treePanel, watcher, false)
  }
}

export function deactivate(): void {
  // Cleanup handled via context.subscriptions
}
