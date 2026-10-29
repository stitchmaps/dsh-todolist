/**
 * todolist — host half.
 *
 * A tiny Cordis plugin that owns persistent task state for the browser half.
 * State lives in `<DSH_HOME>/todolist/todos.json` and is exposed to the Web
 * client through a POST route registered on the shared `connection` service:
 *
 *   POST /api/todolist/state
 *     body { op: "get" }                                  -> { ok, value: state }
 *     body { op: "save", tasks: [...] }                   -> { ok, value: state }
 *
 * The route helper mirrors the pattern shipped by first-party UI plugins
 * (connection.fetch.register) so the browser can reach the host over the same
 * same-origin channel it already uses for other panel data.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'

export const name = 'todolist'

const MAX_TASKS = 2000
const MAX_TITLE = 500

function dataFile() {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  return path.join(home, 'todolist', 'todos.json')
}

function asString(value, max) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed
}

function asTime(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

function asDue(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(5, 7))
  const day = Number(value.slice(8, 10))
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return value
}

function normalizeTask(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const title = asString(raw.title, MAX_TITLE)
  if (title === '') return null
  const now = Date.now()
  const sessionId = asString(raw.sessionId, 200)
  const sessionTitle = asString(raw.sessionTitle, MAX_TITLE)
  return {
    id: asString(raw.id, 100) || randomUUID(),
    title,
    done: raw.done === true,
    due: asDue(raw.due) || null,
    sessionId: sessionId || null,
    sessionTitle: sessionTitle || null,
    createdAt: asTime(raw.createdAt) || now,
    updatedAt: asTime(raw.updatedAt) || now,
  }
}

function normalizeState(raw) {
  const tasks = []
  const seen = new Set()
  if (raw && Array.isArray(raw.tasks)) {
    for (const item of raw.tasks) {
      if (tasks.length >= MAX_TASKS) break
      const task = normalizeTask(item)
      if (task === null || seen.has(task.id)) continue
      seen.add(task.id)
      tasks.push(task)
    }
  }
  return { version: 1, tasks }
}

async function readState() {
  try {
    const text = await fs.readFile(dataFile(), 'utf8')
    return normalizeState(JSON.parse(text))
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      try { process.emitWarning(`[todolist] read state failed: ${String(error)}`) } catch {}
    }
    return { version: 1, tasks: [] }
  }
}

async function writeState(state) {
  const file = dataFile()
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf8')
  await fs.rename(tmp, file)
}

function json(payload) {
  return new Response(JSON.stringify(payload), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

async function handleState(request) {
  let body = null
  try { body = await request.json() } catch { body = null }
  const op = body && typeof body === 'object' ? body.op : undefined
  try {
    if (op === 'save' && Array.isArray(body.tasks)) {
      const state = normalizeState(body)
      await writeState(state)
      return json({ ok: true, value: state })
    }
    const state = await readState()
    return json({ ok: true, value: state })
  } catch (error) {
    return json({ ok: false, error: { code: 'todolist/io', message: String(error) } })
  }
}

export function apply(ctx) {
  try { ctx.logger?.info?.('[todolist] host active · due-date support v2') } catch {}
  ctx.inject(['connection'], (scope) => {
    let connection
    try { connection = scope.get('connection') } catch { connection = undefined }
    const register = connection && connection.fetch && typeof connection.fetch.register === 'function'
      ? connection.fetch.register.bind(connection.fetch)
      : undefined
    if (register === undefined) {
      try { ctx.logger?.warn?.('[todolist] connection.fetch.register is unavailable; /api/todolist/state not registered') } catch {}
      return
    }
    scope.effect(
      () => register({
        path: '/api/todolist/state',
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: handleState,
      }),
      'todolist: state route',
    )
  })
}
