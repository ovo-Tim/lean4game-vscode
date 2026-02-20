"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode6 = __toESM(require("vscode"));

// src/panel/gameInfoPanel.ts
var vscode = __toESM(require("vscode"));
var path = __toESM(require("path"));
var fs = __toESM(require("fs"));
var GameInfoPanel = class _GameInfoPanel {
  constructor(_extensionUri) {
    this._extensionUri = _extensionUri;
  }
  static viewType = "leanGame.infoPanel";
  _panel;
  _disposables = [];
  _onMessage = new vscode.EventEmitter();
  onMessage = this._onMessage.event;
  createOrShow() {
    if (this._panel) {
      this._panel.reveal(vscode.ViewColumn.Two);
      return;
    }
    this._panel = vscode.window.createWebviewPanel(
      _GameInfoPanel.viewType,
      "Lean Game",
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, "out", "webview")],
        retainContextWhenHidden: true
      }
    );
    this._panel.webview.html = this._getHtml(this._panel.webview);
    this._panel.webview.onDidReceiveMessage(
      (msg) => this._onMessage.fire(msg),
      null,
      this._disposables
    );
    this._panel.onDidDispose(
      () => {
        this._panel = void 0;
      },
      null,
      this._disposables
    );
  }
  /** Send a full level update to the webview. */
  update(level, status) {
    this._post({ type: "update", level, status });
  }
  /** Update only the completion status badge. */
  updateCompletionStatus(status) {
    this._post({ type: "statusUpdate", status });
  }
  /** Update the live proof state display. */
  updateGoals(goals) {
    this._post({ type: "goalsUpdate", goals });
  }
  /** Tell the webview whether the "Next Problem" button should be enabled. */
  setHasNext(hasNext) {
    this._post({ type: "setHasNext", hasNext });
  }
  /** Show a plain "no level" state. */
  showEmpty() {
    this._post({ type: "empty" });
  }
  _post(msg) {
    this._panel?.webview.postMessage(msg);
  }
  _getHtml(webview) {
    const webviewDir = vscode.Uri.joinPath(this._extensionUri, "out", "webview");
    const htmlPath = path.join(webviewDir.fsPath, "panel.html");
    let html = fs.readFileSync(htmlPath, "utf-8");
    const assetUri = (name) => webview.asWebviewUri(vscode.Uri.joinPath(webviewDir, name)).toString();
    html = html.replace(/\{\{cspSource\}\}/g, webview.cspSource).replace(/\{\{panelCss\}\}/g, assetUri("panel.css")).replace(/\{\{katexCss\}\}/g, assetUri("katex.min.css")).replace(/\{\{katexJs\}\}/g, assetUri("katex.min.js")).replace(/\{\{panelVendorJs\}\}/g, assetUri("panelVendor.js")).replace(/\{\{panelJs\}\}/g, assetUri("panel.js"));
    return html;
  }
  dispose() {
    this._panel?.dispose();
    this._disposables.forEach((d) => d.dispose());
    this._onMessage.dispose();
  }
};

// src/panel/treePanel.ts
var vscode2 = __toESM(require("vscode"));
var path2 = __toESM(require("path"));
var fs2 = __toESM(require("fs"));
var TreePanel = class _TreePanel {
  constructor(_extensionUri) {
    this._extensionUri = _extensionUri;
  }
  static viewType = "leanGame.treePanel";
  _panel;
  _disposables = [];
  _onMessage = new vscode2.EventEmitter();
  onMessage = this._onMessage.event;
  createOrShow() {
    if (this._panel) {
      this._panel.reveal(vscode2.ViewColumn.Two);
      return;
    }
    this._panel = vscode2.window.createWebviewPanel(
      _TreePanel.viewType,
      "Lean Game \u2014 World Tree",
      vscode2.ViewColumn.Two,
      {
        enableScripts: true,
        localResourceRoots: [vscode2.Uri.joinPath(this._extensionUri, "out", "webview")],
        retainContextWhenHidden: true
      }
    );
    this._panel.webview.html = this._getHtml(this._panel.webview);
    this._panel.webview.onDidReceiveMessage(
      (msg) => this._onMessage.fire(msg),
      null,
      this._disposables
    );
    this._panel.onDidDispose(
      () => {
        this._panel = void 0;
      },
      null,
      this._disposables
    );
  }
  update(data) {
    this._post({ type: "treeUpdate", ...data });
  }
  _post(msg) {
    this._panel?.webview.postMessage(msg);
  }
  _getHtml(webview) {
    const webviewDir = vscode2.Uri.joinPath(this._extensionUri, "out", "webview");
    const htmlPath = path2.join(webviewDir.fsPath, "tree.html");
    let html = fs2.readFileSync(htmlPath, "utf-8");
    const assetUri = (name) => webview.asWebviewUri(vscode2.Uri.joinPath(webviewDir, name)).toString();
    html = html.replace(/\{\{cspSource\}\}/g, webview.cspSource).replace(/\{\{treeCss\}\}/g, assetUri("tree.css")).replace(/\{\{treeJs\}\}/g, assetUri("tree.js"));
    return html;
  }
  dispose() {
    this._panel?.dispose();
    this._disposables.forEach((d) => d.dispose());
    this._onMessage.dispose();
  }
};

// src/lean/lspIntegration.ts
var vscode3 = __toESM(require("vscode"));
function taggedTextToString(t) {
  if ("text" in t)
    return t.text;
  if ("append" in t)
    return t.append.map(taggedTextToString).join("");
  if ("tag" in t)
    return taggedTextToString(t.tag[1]);
  return "";
}
async function getLeanClient() {
  const ext = vscode3.extensions.getExtension("leanprover.lean4");
  if (!ext) {
    console.warn("lean-game-vscode: leanprover.lean4 extension not found");
    return void 0;
  }
  if (!ext.isActive) {
    await ext.activate();
  }
  try {
    const features = await ext.exports.lean4EnabledFeatures;
    return features.clientProvider.getActiveClient();
  } catch (e) {
    console.warn("lean-game-vscode: could not get Lean client:", e);
    return void 0;
  }
}
var LspIntegration = class {
  sessions = /* @__PURE__ */ new Map();
  async getGoals(uri, position) {
    const client = await getLeanClient();
    if (!client)
      return [];
    let session;
    try {
      session = await this.getOrCreateSession(client, uri);
    } catch (e) {
      console.warn("lean-game-vscode: could not create RPC session:", e);
      return [];
    }
    try {
      const result = await client.sendRequest("$/lean/rpc/call", {
        sessionId: session.sessionId,
        method: "Lean.Widget.getInteractiveGoals",
        params: { textDocument: { uri }, position },
        textDocument: { uri },
        position
      });
      return this.parseGoals(result);
    } catch (e) {
      const code = e?.code;
      if (code === -32900) {
        this.destroySession(uri);
        return this.getGoals(uri, position);
      }
      return [];
    }
  }
  async getOrCreateSession(client, uri) {
    const existing = this.sessions.get(uri);
    if (existing)
      return existing;
    const result = await client.sendRequest("$/lean/rpc/connect", { uri });
    const sessionId = result.sessionId;
    const timer = setInterval(() => {
      client.sendNotification("$/lean/rpc/keepAlive", { uri, sessionId });
    }, 1e4);
    const session = { sessionId, timer };
    this.sessions.set(uri, session);
    return session;
  }
  destroySession(uri) {
    const s = this.sessions.get(uri);
    if (s) {
      clearInterval(s.timer);
      this.sessions.delete(uri);
    }
  }
  parseGoals(result) {
    const r = result;
    if (!r?.goals)
      return [];
    return r.goals.map((g) => {
      const goal = g;
      return {
        userName: goal.userName,
        hypotheses: (goal.hyps ?? []).map((h) => ({
          names: h.names,
          type: taggedTextToString(h.type),
          val: h.val ? taggedTextToString(h.val) : void 0
        })),
        goalType: taggedTextToString(goal.type)
      };
    });
  }
  dispose() {
    for (const s of this.sessions.values()) {
      clearInterval(s.timer);
    }
    this.sessions.clear();
  }
};

// src/watcher/solutionWatcher.ts
var fs3 = __toESM(require("fs"));
var vscode4 = __toESM(require("vscode"));
var IMPORT_MARKER = "-- lean4game-imported: completed";
function getCompletionStatus(uri) {
  const diags = vscode4.languages.getDiagnostics(uri);
  const errors = diags.filter(
    (d) => d.severity === vscode4.DiagnosticSeverity.Error
  );
  const sorrys = diags.filter(
    (d) => d.severity === vscode4.DiagnosticSeverity.Warning && d.message.includes("'sorry'")
  );
  if (errors.length > 0)
    return "has-errors";
  if (sorrys.length > 0) {
    try {
      if (fs3.readFileSync(uri.fsPath, "utf-8").includes(IMPORT_MARKER))
        return "complete";
    } catch {
    }
    return "incomplete";
  }
  return "complete";
}
function checkFileContent(filePath) {
  try {
    const content = fs3.readFileSync(filePath, "utf-8");
    if (content.includes(IMPORT_MARKER))
      return "complete";
    return content.includes("sorry") ? "incomplete" : "complete";
  } catch {
    return "incomplete";
  }
}
var SolutionWatcher = class {
  constructor(panel, lsp, treePanel) {
    this.panel = panel;
    this.lsp = lsp;
    this.treePanel = treePanel;
  }
  levelIndex = /* @__PURE__ */ new Map();
  statusCache = /* @__PURE__ */ new Map();
  sortedLevels = [];
  edges = [];
  disposables = [];
  loadLevels(levels, edges) {
    this.levelIndex.clear();
    this.statusCache.clear();
    this.sortedLevels = levels;
    this.edges = edges;
    for (const level of levels) {
      this.levelIndex.set(level.solutionFilePath, level);
    }
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.disposables.push(
      vscode4.window.onDidChangeActiveTextEditor((editor) => {
        if (editor)
          this.handleEditorChange(editor);
      }),
      vscode4.languages.onDidChangeDiagnostics((e) => {
        const activeUri = vscode4.window.activeTextEditor?.document.uri;
        let activeChanged = false;
        for (const uri of e.uris) {
          if (!this.levelIndex.has(uri.fsPath))
            continue;
          const status = getCompletionStatus(uri);
          this.statusCache.set(uri.fsPath, status);
          if (activeUri && uri.toString() === activeUri.toString()) {
            activeChanged = true;
          }
        }
        if (activeChanged && activeUri) {
          const level = this.levelIndex.get(activeUri.fsPath);
          const status = this.statusCache.get(activeUri.fsPath) ?? "incomplete";
          if (level) {
            this.panel.updateCompletionStatus(status);
            if (status === "complete")
              this.panel.update(level, status);
          }
        }
        this.sendUpdates();
      }),
      vscode4.window.onDidChangeTextEditorSelection(async (e) => {
        const editor = e.textEditor;
        if (!this.levelIndex.has(editor.document.uri.fsPath))
          return;
        const pos = editor.selection.active;
        const uri = editor.document.uri.toString();
        const goals = await this.lsp.getGoals(uri, {
          line: pos.line,
          character: pos.character
        });
        this.panel.updateGoals(goals);
      })
    );
    this.sendUpdates();
    const current = vscode4.window.activeTextEditor;
    if (current)
      this.handleEditorChange(current);
  }
  /** Return all currently loaded levels in sorted order. */
  getLevels() {
    return this.sortedLevels;
  }
  /**
   * Remove cached statuses for the given file paths and re-send progress
   * updates to both panels. Call after externally modifying solution files
   * (e.g., after importing proofs from a lean4game JSON export).
   */
  invalidateAndRefresh(filePaths) {
    for (const fp of filePaths)
      this.statusCache.delete(fp);
    this.sendUpdates();
  }
  /** Return the file path of the first non-complete level, or null. */
  getNextLevelFilePath() {
    for (const level of this.sortedLevels) {
      const status = this.statusCache.get(level.solutionFilePath) ?? checkFileContent(level.solutionFilePath);
      if (status !== "complete")
        return level.solutionFilePath;
    }
    return null;
  }
  handleEditorChange(editor) {
    const level = this.levelIndex.get(editor.document.uri.fsPath);
    if (!level)
      return;
    const status = this.statusCache.get(level.solutionFilePath) ?? checkFileContent(level.solutionFilePath);
    this.panel.update(level, status);
  }
  /** Push progress to both the game panel and tree panel. */
  sendUpdates() {
    const worldMap = /* @__PURE__ */ new Map();
    let foundNext = false;
    let nextFilePath = null;
    const worldsOrdered = [];
    for (const level of this.sortedLevels) {
      if (!worldMap.has(level.world)) {
        worldMap.set(level.world, { completed: 0, total: 0, levels: [] });
        worldsOrdered.push(level.world);
      }
      const entry = worldMap.get(level.world);
      const status = this.statusCache.get(level.solutionFilePath) ?? checkFileContent(level.solutionFilePath);
      const isNext = !foundNext && status !== "complete";
      if (isNext) {
        foundNext = true;
        nextFilePath = level.solutionFilePath;
      }
      if (status === "complete")
        entry.completed++;
      entry.total++;
      entry.levels.push({
        level: level.level,
        title: level.title,
        filePath: level.solutionFilePath,
        status,
        isNext
      });
    }
    const worlds = worldsOrdered.map((world) => {
      const e = worldMap.get(world);
      return { world, levels: e.levels, completed: e.completed, total: e.total };
    });
    this.treePanel.update({ worlds, edges: this.edges, nextFilePath });
    this.panel.setHasNext(nextFilePath !== null);
  }
  clear() {
    this.levelIndex.clear();
    this.statusCache.clear();
    this.sortedLevels = [];
    this.edges = [];
    this.panel.showEmpty();
  }
  dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
};

// src/commands/registerCommands.ts
var fs7 = __toESM(require("fs"));
var vscode5 = __toESM(require("vscode"));

// src/parser/leanGameParser.ts
var fs4 = __toESM(require("fs"));
var path3 = __toESM(require("path"));
function tryCloseSingleLine(rest) {
  let result = "";
  let i = 0;
  while (i < rest.length) {
    const ch = rest[i];
    if (ch === "\\" && i + 1 < rest.length) {
      result += rest[i + 1];
      i += 2;
      continue;
    }
    if (ch === '"') {
      return result;
    }
    result += ch;
    i++;
  }
  return null;
}
function extractLeanString(lines, startIdx, lineRest) {
  const trimmed = lineRest.trimStart();
  if (!trimmed.startsWith('"')) {
    return { value: null, multiLine: false, endIdx: startIdx };
  }
  const afterQuote = trimmed.slice(1);
  const single = tryCloseSingleLine(afterQuote);
  if (single !== null) {
    return { value: single, multiLine: false, endIdx: startIdx };
  }
  let accum = afterQuote + "\n";
  let i = startIdx + 1;
  while (i < lines.length) {
    const line = lines[i];
    const closed = tryCloseSingleLine(line);
    if (closed !== null) {
      accum += closed;
      const value2 = accum.replace(/^\n/, "").replace(/\n$/, "");
      return { value: value2, multiLine: true, endIdx: i };
    }
    accum += line + "\n";
    i++;
  }
  const value = accum.replace(/^\n/, "").replace(/\n$/, "");
  return { value, multiLine: true, endIdx: i - 1 };
}
var TOP_LEVEL_KEYWORDS = /* @__PURE__ */ new Set([
  "import",
  "World",
  "Level",
  "Title",
  "Introduction",
  "Conclusion",
  "Statement",
  "NewTactic",
  "NewTheorem",
  "NewLemma",
  "NewDefinition",
  "TacticDoc",
  "TheoremDoc",
  "LemmaDoc",
  "DefinitionDoc",
  "Dependency",
  "MakeGame",
  "open",
  "section",
  "namespace",
  "variable",
  "set_option"
]);
function isTopLevelKeyword(line) {
  const word = line.match(/^([A-Za-z_][A-Za-z0-9_]*)/)?.[1];
  return word ? TOP_LEVEL_KEYWORDS.has(word) : false;
}
function extractHints(proofLines) {
  const hints = [];
  let i = 0;
  while (i < proofLines.length) {
    const line = proofLines[i];
    const hintMatch = line.match(/^\s*Hint\s*(.*)$/);
    if (!hintMatch) {
      i++;
      continue;
    }
    let rest = hintMatch[1];
    let hidden = false;
    let strict = false;
    while (true) {
      const optMatch = rest.match(/^\s*\(\s*(hidden|strict)\s*:=\s*(true|false)\s*\)\s*(.*)$/);
      if (!optMatch)
        break;
      if (optMatch[1] === "hidden")
        hidden = optMatch[2] === "true";
      if (optMatch[1] === "strict")
        strict = optMatch[2] === "true";
      rest = optMatch[3];
    }
    rest = rest.trimStart();
    if (!rest.startsWith('"')) {
      i++;
      continue;
    }
    const afterQuote = rest.slice(1);
    const single = tryCloseSingleLine(afterQuote);
    if (single !== null) {
      hints.push({ text: single, hidden, strict });
      i++;
      continue;
    }
    let accum = afterQuote + "\n";
    i++;
    let closed = false;
    while (i < proofLines.length) {
      const pl = proofLines[i];
      const closedStr = tryCloseSingleLine(pl);
      if (closedStr !== null) {
        accum += closedStr;
        hints.push({ text: accum.replace(/^\n/, "").replace(/\n$/, ""), hidden, strict });
        i++;
        closed = true;
        break;
      }
      accum += pl + "\n";
      i++;
    }
    if (!closed) {
      hints.push({ text: accum.replace(/^\n/, "").replace(/\n$/, ""), hidden, strict });
    }
  }
  return hints;
}
function extractStatementAndProof(lines, startIdx) {
  let sigLines = [];
  let i = startIdx;
  while (i < lines.length) {
    const line = lines[i];
    sigLines.push(line);
    if (line.trimEnd().endsWith(":= by")) {
      break;
    }
    if (line.includes(":= by")) {
      break;
    }
    i++;
  }
  const signature = sigLines.join("\n");
  i++;
  const proofLines = [];
  while (i < lines.length) {
    const line = lines[i];
    if (line.length > 0 && line[0] !== " " && line[0] !== "	" && isTopLevelKeyword(line)) {
      break;
    }
    if (line.startsWith("/--")) {
      break;
    }
    proofLines.push(line);
    i++;
  }
  return { signature, proofLines, endIdx: i - 1 };
}
function parseLevelFile(sourceFilePath, solutionFilePath) {
  const content = fs4.readFileSync(sourceFilePath, "utf-8");
  const lines = content.split("\n");
  let world = "";
  let level = 0;
  let title = "";
  let introduction = "";
  let conclusion = "";
  let statementDocstring = "";
  let statementSignature = "";
  let hints = [];
  let hasStatement = false;
  let pendingDocstring = "";
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === "") {
      i++;
      continue;
    }
    if (trimmed.startsWith("--") && !trimmed.startsWith("/--")) {
      i++;
      continue;
    }
    if (trimmed.startsWith("/--")) {
      const docLines = [line];
      if (!trimmed.endsWith("-/")) {
        i++;
        while (i < lines.length) {
          const dl = lines[i];
          docLines.push(dl);
          if (dl.trimEnd().endsWith("-/")) {
            break;
          }
          i++;
        }
      }
      let raw = docLines.join("\n");
      raw = raw.replace(/^\/--\s?/, "").replace(/-\/$/, "").trim();
      pendingDocstring = raw;
      i++;
      continue;
    }
    if (trimmed.startsWith("import ")) {
      pendingDocstring = "";
      i++;
      continue;
    }
    if (trimmed.startsWith("World ")) {
      const rest = trimmed.slice("World ".length);
      const res = extractLeanString(lines, i, rest);
      if (res.value !== null)
        world = res.value;
      i = res.endIdx + 1;
      pendingDocstring = "";
      continue;
    }
    if (trimmed.startsWith("Level ")) {
      const num = parseInt(trimmed.slice("Level ".length).trim(), 10);
      if (!isNaN(num))
        level = num;
      pendingDocstring = "";
      i++;
      continue;
    }
    if (trimmed.startsWith("Title ")) {
      const rest = trimmed.slice("Title ".length);
      const res = extractLeanString(lines, i, rest);
      if (res.value !== null)
        title = res.value;
      i = res.endIdx + 1;
      pendingDocstring = "";
      continue;
    }
    if (trimmed.startsWith("Introduction ")) {
      const rest = trimmed.slice("Introduction ".length);
      const res = extractLeanString(lines, i, rest);
      if (res.value !== null)
        introduction = res.value;
      i = res.endIdx + 1;
      pendingDocstring = "";
      continue;
    }
    if (trimmed.startsWith("Conclusion ")) {
      const rest = trimmed.slice("Conclusion ".length);
      const res = extractLeanString(lines, i, rest);
      if (res.value !== null)
        conclusion = res.value;
      i = res.endIdx + 1;
      pendingDocstring = "";
      continue;
    }
    if (trimmed.startsWith("Statement") && (trimmed.length === 9 || /^Statement[\s(:]/.test(trimmed))) {
      hasStatement = true;
      statementDocstring = pendingDocstring;
      pendingDocstring = "";
      const result = extractStatementAndProof(lines, i);
      statementSignature = result.signature;
      hints = extractHints(result.proofLines);
      i = result.endIdx + 1;
      continue;
    }
    pendingDocstring = "";
    i++;
  }
  if (!hasStatement)
    return null;
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
    conclusion
  };
}
function findLeanFiles(dir) {
  const results = [];
  if (!fs4.existsSync(dir))
    return results;
  for (const entry of fs4.readdirSync(dir, { withFileTypes: true })) {
    const full = path3.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.includes(" "))
        results.push(...findLeanFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".lean")) {
      results.push(full);
    }
  }
  return results;
}
function computeSolutionPath(sourceFilePath, gameRoot) {
  const levelsDir = path3.join(gameRoot, "Game", "Levels");
  const relative2 = path3.relative(levelsDir, sourceFilePath);
  return path3.join(gameRoot, "Solutions", relative2);
}
function parseGameDirectory(gameRoot) {
  const levelsDir = path3.join(gameRoot, "Game", "Levels");
  const files = findLeanFiles(levelsDir);
  const levels = [];
  for (const file of files) {
    const solutionPath = computeSolutionPath(file, gameRoot);
    try {
      const data = parseLevelFile(file, solutionPath);
      if (data)
        levels.push(data);
    } catch (e) {
      console.error(`lean-game-vscode: failed to parse ${file}:`, e);
    }
  }
  levels.sort((a, b) => {
    if (a.world !== b.world)
      return a.world.localeCompare(b.world);
    return a.level - b.level;
  });
  return levels;
}

// src/parser/gameLeanParser.ts
var fs5 = __toESM(require("fs"));
var path4 = __toESM(require("path"));
function findGameLean(gameRoot) {
  const dirName = path4.basename(gameRoot);
  for (const candidate of ["Game.lean", `${dirName}.lean`]) {
    const p = path4.join(gameRoot, candidate);
    if (fs5.existsSync(p))
      return p;
  }
  return null;
}
function parseGameDependencies(gameRoot, levels) {
  const gameLean = findGameLean(gameRoot);
  if (!gameLean)
    return [];
  const content = fs5.readFileSync(gameLean, "utf-8");
  const explicitEdges = [];
  for (const line of content.split("\n")) {
    const m = line.match(/^Dependency\s+(\S+)\s+(?:→|->)\s+(\S+)/);
    if (m)
      explicitEdges.push({ from: m[1], to: m[2] });
  }
  const worldDir = /* @__PURE__ */ new Map();
  for (const level of levels) {
    if (worldDir.has(level.world))
      continue;
    const m = level.sourceFilePath.match(/Game[/\\]Levels[/\\]([^/\\]+)/);
    if (m)
      worldDir.set(level.world, m[1]);
  }
  const groupMap = /* @__PURE__ */ new Map();
  for (const [world, dir] of worldDir) {
    const m = dir.match(/^[Ll](\d+)/);
    if (!m)
      continue;
    const g = parseInt(m[1]);
    if (!groupMap.has(g))
      groupMap.set(g, /* @__PURE__ */ new Set());
    groupMap.get(g).add(world);
  }
  if (groupMap.size === 0)
    return explicitEdges;
  const isPsetDir = (world) => /pset/i.test(worldDir.get(world) ?? "");
  const groups = /* @__PURE__ */ new Map();
  for (const [g, worldSet] of groupMap) {
    const sorted = Array.from(worldSet).sort((a, b) => {
      const pa = isPsetDir(a), pb = isPsetDir(b);
      if (pa !== pb)
        return pa ? 1 : -1;
      return (worldDir.get(a) ?? "").localeCompare(worldDir.get(b) ?? "");
    });
    groups.set(g, sorted);
  }
  const groupNums = Array.from(groups.keys()).sort((a, b) => a - b);
  const hasExplicitPred = /* @__PURE__ */ new Set();
  for (const e of explicitEdges)
    hasExplicitPred.add(e.to);
  function anchor(worldList) {
    return worldList.find((w) => !hasExplicitPred.has(w)) ?? worldList[0] ?? null;
  }
  const implicitEdges = [];
  for (let gi = 0; gi < groupNums.length; gi++) {
    const worlds = groups.get(groupNums[gi]);
    const prevAnchor = gi > 0 ? anchor(groups.get(groupNums[gi - 1])) : null;
    for (let wi = 0; wi < worlds.length; wi++) {
      const world = worlds[wi];
      if (hasExplicitPred.has(world))
        continue;
      if (gi === 0) {
        if (wi > 0)
          implicitEdges.push({ from: worlds[0], to: world });
      } else {
        if (prevAnchor && prevAnchor !== world) {
          implicitEdges.push({ from: prevAnchor, to: world });
        }
      }
    }
  }
  return [...explicitEdges, ...implicitEdges];
}

// src/generator/solutionGenerator.ts
var fs6 = __toESM(require("fs"));
var path5 = __toESM(require("path"));
function computeImportPath(sourceFilePath) {
  const m = sourceFilePath.match(/[/\\](Game[/\\]Levels[/\\].+)$/);
  if (!m)
    return "Game.Metadata";
  return m[1].replace(/\.lean$/, "").replace(/[/\\]/g, ".");
}
function statementToTheorem(sig) {
  return sig.replace(
    /^Statement(\s+[A-Za-z_][A-Za-z0-9_'.]*)?(?=\s|\(|:)/m,
    "theorem lean_game_solution"
  );
}
function generateSolutionContent(level) {
  const importPath = computeImportPath(level.sourceFilePath);
  const lines = [
    "-- Auto-generated by lean-game-vscode. Edit the proof below.",
    `import ${importPath}`,
    ""
  ];
  if (level.statementDocstring) {
    lines.push(`/-- ${level.statementDocstring} -/`);
  }
  const sig = statementToTheorem(level.statementSignature.trimEnd());
  lines.push(sig);
  lines.push("  sorry");
  lines.push("");
  return lines.join("\n");
}
function generateSolutionFile(level, overwrite = false) {
  const filePath = level.solutionFilePath;
  try {
    if (fs6.existsSync(filePath) && !overwrite) {
      return "exists";
    }
    fs6.mkdirSync(path5.dirname(filePath), { recursive: true });
    fs6.writeFileSync(filePath, generateSolutionContent(level), "utf-8");
    return "created";
  } catch (e) {
    console.error(`lean-game-vscode: failed to write ${filePath}:`, e);
    return "error";
  }
}
function generateAllSolutions(levels, overwrite = false) {
  let created = 0;
  let skipped = 0;
  let errors = 0;
  for (const level of levels) {
    const result = generateSolutionFile(level, overwrite);
    if (result === "created")
      created++;
    else if (result === "exists")
      skipped++;
    else
      errors++;
  }
  return { created, skipped, errors };
}

// src/commands/registerCommands.ts
function wireMessageHandlers(panel, treePanel, watcher) {
  panel.onMessage((msg) => {
    if (msg.type === "showTree") {
      treePanel.createOrShow();
    } else if (msg.type === "nextLevel") {
      const fp = watcher.getNextLevelFilePath();
      if (fp) {
        void vscode5.commands.executeCommand("vscode.open", vscode5.Uri.file(fp), {
          viewColumn: vscode5.ViewColumn.One,
          preserveFocus: false
        });
        panel.createOrShow();
      }
    }
  });
  treePanel.onMessage((msg) => {
    if (msg.type === "openLevel" && typeof msg.filePath === "string") {
      void vscode5.commands.executeCommand("vscode.open", vscode5.Uri.file(msg.filePath), {
        viewColumn: vscode5.ViewColumn.One,
        preserveFocus: false
      });
      panel.createOrShow();
    } else if (msg.type === "jumpToNext") {
      const fp = watcher.getNextLevelFilePath();
      if (fp) {
        void vscode5.commands.executeCommand("vscode.open", vscode5.Uri.file(fp), {
          viewColumn: vscode5.ViewColumn.One,
          preserveFocus: false
        });
        panel.createOrShow();
      }
    }
  });
}
function registerCommands(context, panel, treePanel, watcher) {
  context.subscriptions.push(
    vscode5.commands.registerCommand("leanGame.openGame", async () => {
      const uris = await vscode5.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: "Select Game Root",
        title: "Select Lean Game Root Directory"
      });
      if (!uris || uris.length === 0)
        return;
      const gameRoot = uris[0].fsPath;
      await loadGame(gameRoot, panel, treePanel, watcher, false);
      await vscode5.workspace.getConfiguration("leanGame").update("gameRootPath", gameRoot, vscode5.ConfigurationTarget.Global);
    }),
    vscode5.commands.registerCommand("leanGame.showPanel", () => {
      panel.createOrShow();
    }),
    vscode5.commands.registerCommand("leanGame.showTree", () => {
      treePanel.createOrShow();
    }),
    vscode5.commands.registerCommand("leanGame.importProgress", async () => {
      const gameRoot = vscode5.workspace.getConfiguration("leanGame").get("gameRootPath");
      if (!gameRoot?.trim()) {
        vscode5.window.showWarningMessage('No game loaded. Use "Lean Game: Open Game" first.');
        return;
      }
      const levels = watcher.getLevels();
      if (levels.length === 0) {
        vscode5.window.showWarningMessage('No levels loaded. Use "Lean Game: Open Game" first.');
        return;
      }
      const uris = await vscode5.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        openLabel: "Import",
        title: "Select lean4game progress JSON export",
        filters: { "JSON files": ["json"] }
      });
      if (!uris || uris.length === 0)
        return;
      let worldData;
      try {
        const raw = fs7.readFileSync(uris[0].fsPath, "utf-8");
        const parsed = JSON.parse(raw);
        if (!parsed.data || typeof parsed.data !== "object") {
          throw new Error('JSON is missing a top-level "data" field.');
        }
        worldData = parsed.data;
      } catch (e) {
        vscode5.window.showErrorMessage(`Failed to parse progress JSON: ${e.message}`);
        return;
      }
      const lookup = /* @__PURE__ */ new Map();
      for (const level of levels) {
        lookup.set(`${level.world}:${level.level}`, level);
      }
      let imported = 0;
      let skipped = 0;
      let missing = 0;
      const importedPaths = [];
      for (const [world, levelMap] of Object.entries(worldData)) {
        for (const [key, entry] of Object.entries(levelMap)) {
          const levelNum = parseInt(key);
          if (isNaN(levelNum) || typeof entry !== "object")
            continue;
          if (!entry.completed) {
            skipped++;
            continue;
          }
          const level = lookup.get(`${world}:${levelNum}`);
          if (!level) {
            missing++;
            continue;
          }
          if (writeImportedProof(level.solutionFilePath, entry.code ?? "")) {
            importedPaths.push(level.solutionFilePath);
            imported++;
          } else {
            missing++;
          }
        }
      }
      watcher.invalidateAndRefresh(importedPaths);
      const parts = [`Imported ${imported} level${imported !== 1 ? "s" : ""}.`];
      if (skipped > 0)
        parts.push(`${skipped} incomplete in JSON (skipped).`);
      if (missing > 0)
        parts.push(`${missing} not found in current game.`);
      vscode5.window.showInformationMessage(parts.join("  "));
    }),
    vscode5.commands.registerCommand("leanGame.regenerateSolutions", async () => {
      const gameRoot = vscode5.workspace.getConfiguration("leanGame").get("gameRootPath");
      if (!gameRoot) {
        vscode5.window.showWarningMessage('No game loaded. Use "Lean Game: Open Game" first.');
        return;
      }
      const answer = await vscode5.window.showWarningMessage(
        "This will overwrite all auto-generated solution stubs. Your proofs will be replaced with `sorry`. Continue?",
        { modal: true },
        "Overwrite"
      );
      if (answer !== "Overwrite")
        return;
      await loadGame(gameRoot, panel, treePanel, watcher, true);
    })
  );
}
async function loadGame(gameRoot, panel, treePanel, watcher, overwrite) {
  await vscode5.window.withProgress(
    { location: vscode5.ProgressLocation.Notification, title: "Lean Game", cancellable: false },
    async (progress) => {
      progress.report({ message: "Parsing levels\u2026" });
      const levels = parseGameDirectory(gameRoot);
      if (levels.length === 0) {
        vscode5.window.showWarningMessage(
          `No levels with statements found in ${gameRoot}/Game/Levels/`
        );
        return;
      }
      progress.report({ message: "Parsing dependencies\u2026" });
      const edges = parseGameDependencies(gameRoot, levels);
      progress.report({ message: `Generating ${levels.length} solution stubs\u2026` });
      const stats = generateAllSolutions(levels, overwrite);
      progress.report({ message: "Loading level index\u2026" });
      watcher.loadLevels(levels, edges);
      treePanel.createOrShow();
      vscode5.window.showInformationMessage(
        `Lean Game loaded: ${levels.length} levels across ${new Set(levels.map((l) => l.world)).size} worlds. ${stats.created} solution files created, ${stats.skipped} already existed.`
      );
    }
  );
}
var IMPORT_MARKER2 = "-- lean4game-imported: completed";
function writeImportedProof(filePath, code) {
  try {
    if (!fs7.existsSync(filePath))
      return false;
    const content = fs7.readFileSync(filePath, "utf-8");
    const byMarker = ":= by\n";
    const idx = content.lastIndexOf(byMarker);
    if (idx === -1)
      return false;
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      if (!content.includes("sorry") || content.includes(IMPORT_MARKER2))
        return false;
      fs7.writeFileSync(
        filePath,
        content.slice(0, idx + byMarker.length) + `  ${IMPORT_MARKER2}
  sorry
`,
        "utf-8"
      );
    } else {
      const indented = trimmedCode.split("\n").map((line) => line ? "  " + line : "").join("\n");
      fs7.writeFileSync(
        filePath,
        content.slice(0, idx + byMarker.length) + indented + "\n",
        "utf-8"
      );
    }
    return true;
  } catch {
    return false;
  }
}

// src/extension.ts
function activate(context) {
  const panel = new GameInfoPanel(context.extensionUri);
  const treePanel = new TreePanel(context.extensionUri);
  const lsp = new LspIntegration();
  const watcher = new SolutionWatcher(panel, lsp, treePanel);
  context.subscriptions.push(panel, treePanel, lsp, watcher);
  wireMessageHandlers(panel, treePanel, watcher);
  registerCommands(context, panel, treePanel, watcher);
  const gameRootPath = vscode6.workspace.getConfiguration("leanGame").get("gameRootPath");
  if (gameRootPath && gameRootPath.trim() !== "") {
    void loadGame(gameRootPath, panel, treePanel, watcher, false);
  }
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
