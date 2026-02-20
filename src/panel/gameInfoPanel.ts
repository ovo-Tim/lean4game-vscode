import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { CompletionStatus, GoalState, LevelData } from '../parser/types'

export class GameInfoPanel implements vscode.Disposable {
  public static readonly viewType = 'leanGame.infoPanel'

  private _panel: vscode.WebviewPanel | undefined
  private _disposables: vscode.Disposable[] = []

  private readonly _onMessage = new vscode.EventEmitter<Record<string, unknown>>()
  readonly onMessage = this._onMessage.event

  constructor(private readonly _extensionUri: vscode.Uri) {}

  createOrShow(): void {
    if (this._panel) {
      this._panel.reveal(vscode.ViewColumn.Two)
      return
    }

    this._panel = vscode.window.createWebviewPanel(
      GameInfoPanel.viewType,
      'Lean Game',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'out', 'webview')],
        retainContextWhenHidden: true,
      },
    )

    this._panel.webview.html = this._getHtml(this._panel.webview)

    this._panel.webview.onDidReceiveMessage(
      (msg) => this._onMessage.fire(msg as Record<string, unknown>),
      null,
      this._disposables,
    )

    this._panel.onDidDispose(
      () => { this._panel = undefined },
      null,
      this._disposables,
    )
  }

  /** Send a full level update to the webview. */
  update(level: LevelData, status: CompletionStatus): void {
    this._post({ type: 'update', level, status })
  }

  /** Update only the completion status badge. */
  updateCompletionStatus(status: CompletionStatus): void {
    this._post({ type: 'statusUpdate', status })
  }

  /** Update the live proof state display. */
  updateGoals(goals: GoalState[]): void {
    this._post({ type: 'goalsUpdate', goals })
  }

  /** Tell the webview whether the "Next Problem" button should be enabled. */
  setHasNext(hasNext: boolean): void {
    this._post({ type: 'setHasNext', hasNext })
  }

  /** Show a plain "no level" state. */
  showEmpty(): void {
    this._post({ type: 'empty' })
  }

  private _post(msg: unknown): void {
    this._panel?.webview.postMessage(msg)
  }

  private _getHtml(webview: vscode.Webview): string {
    const webviewDir = vscode.Uri.joinPath(this._extensionUri, 'out', 'webview')

    const htmlPath = path.join(webviewDir.fsPath, 'panel.html')
    let html = fs.readFileSync(htmlPath, 'utf-8')

    const assetUri = (name: string) =>
      webview.asWebviewUri(vscode.Uri.joinPath(webviewDir, name)).toString()

    html = html
      .replace(/\{\{cspSource\}\}/g, webview.cspSource)
      .replace(/\{\{panelCss\}\}/g, assetUri('panel.css'))
      .replace(/\{\{katexCss\}\}/g, assetUri('katex.min.css'))
      .replace(/\{\{katexJs\}\}/g, assetUri('katex.min.js'))
      .replace(/\{\{panelVendorJs\}\}/g, assetUri('panelVendor.js'))
      .replace(/\{\{panelJs\}\}/g, assetUri('panel.js'))

    return html
  }

  dispose(): void {
    this._panel?.dispose()
    this._disposables.forEach((d) => d.dispose())
    this._onMessage.dispose()
  }
}
