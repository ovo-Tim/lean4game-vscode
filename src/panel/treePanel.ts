import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { TreeData } from '../parser/types'

export class TreePanel implements vscode.Disposable {
  public static readonly viewType = 'leanGame.treePanel'

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
      TreePanel.viewType,
      'Lean Game — World Tree',
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

  update(data: TreeData): void {
    this._post({ type: 'treeUpdate', ...data })
  }

  private _post(msg: unknown): void {
    this._panel?.webview.postMessage(msg)
  }

  private _getHtml(webview: vscode.Webview): string {
    const webviewDir = vscode.Uri.joinPath(this._extensionUri, 'out', 'webview')
    const htmlPath = path.join(webviewDir.fsPath, 'tree.html')
    let html = fs.readFileSync(htmlPath, 'utf-8')

    const assetUri = (name: string) =>
      webview.asWebviewUri(vscode.Uri.joinPath(webviewDir, name)).toString()

    html = html
      .replace(/\{\{cspSource\}\}/g, webview.cspSource)
      .replace(/\{\{treeCss\}\}/g, assetUri('tree.css'))
      .replace(/\{\{treeJs\}\}/g, assetUri('tree.js'))

    return html
  }

  dispose(): void {
    this._panel?.dispose()
    this._disposables.forEach((d) => d.dispose())
    this._onMessage.dispose()
  }
}
