import * as vscode from 'vscode'
import { GoalState } from '../parser/types'

// ─── TaggedText helpers ───────────────────────────────────────────────────────

type TaggedText<T> =
  | { text: string }
  | { append: TaggedText<T>[] }
  | { tag: [T, TaggedText<T>] }

function taggedTextToString(t: TaggedText<unknown>): string {
  if ('text' in t) return t.text
  if ('append' in t) return (t as { append: TaggedText<unknown>[] }).append.map(taggedTextToString).join('')
  if ('tag' in t) return taggedTextToString((t as { tag: [unknown, TaggedText<unknown>] }).tag[1])
  return ''
}

// ─── Lean client access ───────────────────────────────────────────────────────

interface LeanClientLike {
  sendRequest(method: string, params: unknown): Promise<unknown>
  sendNotification(method: string, params: unknown): void | Promise<void>
}

interface LeanExports {
  lean4EnabledFeatures: Promise<{
    clientProvider: {
      getActiveClient(): LeanClientLike | undefined
    }
  }>
}

async function getLeanClient(): Promise<LeanClientLike | undefined> {
  const ext = vscode.extensions.getExtension<LeanExports>('leanprover.lean4')
  if (!ext) {
    console.warn('lean-game-vscode: leanprover.lean4 extension not found')
    return undefined
  }
  if (!ext.isActive) {
    await ext.activate()
  }
  try {
    const features = await ext.exports.lean4EnabledFeatures
    return features.clientProvider.getActiveClient()
  } catch (e) {
    console.warn('lean-game-vscode: could not get Lean client:', e)
    return undefined
  }
}

// ─── RPC session management ───────────────────────────────────────────────────

interface Session {
  sessionId: string
  timer: ReturnType<typeof setInterval>
}

// ─── LspIntegration ──────────────────────────────────────────────────────────

export class LspIntegration implements vscode.Disposable {
  private sessions = new Map<string, Session>()

  async getGoals(
    uri: string,
    position: { line: number; character: number },
  ): Promise<GoalState[]> {
    const client = await getLeanClient()
    if (!client) return []

    let session: Session
    try {
      session = await this.getOrCreateSession(client, uri)
    } catch (e) {
      console.warn('lean-game-vscode: could not create RPC session:', e)
      return []
    }

    try {
      const result = await client.sendRequest('$/lean/rpc/call', {
        sessionId: session.sessionId,
        method: 'Lean.Widget.getInteractiveGoals',
        params: { textDocument: { uri }, position },
        textDocument: { uri },
        position,
      })
      return this.parseGoals(result)
    } catch (e: unknown) {
      const code = (e as { code?: number })?.code
      if (code === -32900) {
        // RpcNeedsReconnect
        this.destroySession(uri)
        return this.getGoals(uri, position)
      }
      // Suppress noise from cursor outside proof, file not ready, etc.
      return []
    }
  }

  private async getOrCreateSession(
    client: LeanClientLike,
    uri: string,
  ): Promise<Session> {
    const existing = this.sessions.get(uri)
    if (existing) return existing

    const result = (await client.sendRequest('$/lean/rpc/connect', { uri })) as {
      sessionId: string
    }
    const sessionId = result.sessionId

    const timer = setInterval(() => {
      client.sendNotification('$/lean/rpc/keepAlive', { uri, sessionId })
    }, 10_000)

    const session: Session = { sessionId, timer }
    this.sessions.set(uri, session)
    return session
  }

  private destroySession(uri: string) {
    const s = this.sessions.get(uri)
    if (s) {
      clearInterval(s.timer)
      this.sessions.delete(uri)
    }
  }

  private parseGoals(result: unknown): GoalState[] {
    const r = result as { goals?: unknown[] } | null
    if (!r?.goals) return []

    return r.goals.map((g: unknown) => {
      const goal = g as {
        userName?: string
        hyps?: Array<{
          names: string[]
          type: TaggedText<unknown>
          val?: TaggedText<unknown>
        }>
        type: TaggedText<unknown>
      }

      return {
        userName: goal.userName,
        hypotheses: (goal.hyps ?? []).map((h) => ({
          names: h.names,
          type: taggedTextToString(h.type),
          val: h.val ? taggedTextToString(h.val) : undefined,
        })),
        goalType: taggedTextToString(goal.type),
      }
    })
  }

  dispose() {
    for (const s of this.sessions.values()) {
      clearInterval(s.timer)
    }
    this.sessions.clear()
  }
}
