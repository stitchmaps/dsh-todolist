/**
 * todolist — host half.
 *
 * Owns persistent task state for the browser half and a reminder scheduler
 * that pushes to personal DingTalk (group robot webhook or enterprise work
 * notification) N hours before a task's due time.
 *
 * State lives in `<DSH_HOME>/todolist/todos.json`:
 *   { version: 2, tasks: [...], config: {...} }
 *
 * Browser API (POST /api/todolist/state):
 *   { op: 'get' }                        -> { ok, value: state }
 *   { op: 'save', tasks: [...] }         -> saves tasks (keeps config)
 *   { op: 'saveConfig', config: {...} }  -> saves config (keeps tasks)
 *   { op: 'testNotify', config?: {...} } -> sends a test DingTalk message
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { randomUUID, createHmac } from 'node:crypto'

export const name = 'todolist'

const MAX_TASKS = 2000
const MAX_TITLE = 500
const MAX_REMIND_HOURS = 168
const RETRY_MS = 5 * 60 * 1000
const TICK_MS = 60 * 1000

const DEFAULT_CONFIG = {
  version: 1,
  dingtalk: {
    mode: 'webhook',
    webhookUrl: '',
    webhookSecret: '',
    appKey: '',
    appSecret: '',
    agentId: '',
    userIds: '',
    atMobiles: '',
  },
  defaultRemindHours: null,
}

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

function asRemindHours(value) {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(MAX_REMIND_HOURS, Math.floor(n)))
}

function pad2(n) { return n < 10 ? '0' + n : String(n) }

function validDateTime(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(text)
  if (!m) return false
  const year = Number(m[1]), month = Number(m[2]), day = Number(m[3]), hour = Number(m[4]), minute = Number(m[5])
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return false
  const date = new Date(year, month - 1, day, hour, minute)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

/** Normalize a due value to `YYYY-MM-DDTHH:00` (hour precision). Legacy date-only -> 23:00. */
function asDue(value) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return validDateTime(text + 'T23:00') ? text + 'T23:00' : null
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})$/.exec(text)
  if (!m) return null
  return validDateTime(`${m[1]}T${m[2]}:00`) ? `${m[1]}T${m[2]}:00` : null
}

function dueMs(due) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(due || '')
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])).getTime()
}

function normalizeTask(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const title = asString(raw.title, MAX_TITLE)
  if (title === '') return null
  const now = Date.now()
  const sessionId = asString(raw.sessionId, 200)
  const sessionTitle = asString(raw.sessionTitle, MAX_TITLE)
  const due = asDue(raw.due)
  const remindHours = asRemindHours(raw.remindHours)
  const reminderDue = asDue(raw.reminderDue)
  return {
    id: asString(raw.id, 100) || randomUUID(),
    title,
    done: raw.done === true,
    due,
    remindHours,
    remindedAt: due !== null && reminderDue === due ? asTime(raw.remindedAt) || null : null,
    reminderDue: due !== null && reminderDue === due ? due : null,
    sessionId: sessionId || null,
    sessionTitle: sessionTitle || null,
    createdAt: asTime(raw.createdAt) || now,
    updatedAt: asTime(raw.updatedAt) || now,
  }
}

function normalizeDingTalk(raw) {
  const d = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  return {
    mode: d.mode === 'worknotice' ? 'worknotice' : 'webhook',
    webhookUrl: asString(d.webhookUrl, 2000),
    webhookSecret: asString(d.webhookSecret, 500),
    appKey: asString(d.appKey, 200),
    appSecret: asString(d.appSecret, 500),
    agentId: asString(d.agentId, 100),
    userIds: asString(d.userIds, 1000),
    atMobiles: asString(d.atMobiles, 1000),
  }
}

function normalizeConfig(raw) {
  const c = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  return {
    version: 1,
    dingtalk: normalizeDingTalk(c.dingtalk),
    defaultRemindHours: asRemindHours(c.defaultRemindHours),
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
  return { version: 2, tasks, config: normalizeConfig(raw && raw.config) }
}

let ioChain = Promise.resolve()
function withLock(fn) {
  const run = ioChain.then(fn, fn)
  ioChain = run.then(() => undefined, () => undefined)
  return run
}

async function readState() {
  try {
    const text = await fs.readFile(dataFile(), 'utf8')
    return normalizeState(JSON.parse(text))
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      try { process.emitWarning(`[todolist] read state failed: ${String(error)}`) } catch {}
    }
    return normalizeState(null)
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

// ---------------------------------------------------------------------------
// DingTalk adapters
// ---------------------------------------------------------------------------

function readyFor(config) {
  const d = config && config.dingtalk
  if (!d) return false
  if (d.mode === 'worknotice') return Boolean(d.appKey && d.appSecret && d.agentId && d.userIds)
  return Boolean(d.webhookUrl) && /^https:\/\//i.test(d.webhookUrl)
}

function dingTalkSign(secret, timestamp) {
  return createHmac('sha256', secret).update(`${timestamp}\n${secret}`).digest('base64')
}

async function sendWebhook(config, text) {
  const d = config.dingtalk
  if (!/^https:\/\//i.test(d.webhookUrl)) throw new Error('webhook URL must be https')
  let url = d.webhookUrl
  if (d.webhookSecret) {
    const timestamp = Date.now()
    const sign = encodeURIComponent(dingTalkSign(d.webhookSecret, timestamp))
    url += `${url.includes('?') ? '&' : '?'}timestamp=${timestamp}&sign=${sign}`
  }
  const mobiles = d.atMobiles.split(',').map((s) => s.trim()).filter(Boolean)
  const content = mobiles.length > 0 ? `${text}\n\n${mobiles.map((m) => '@' + m).join(' ')}` : text
  const body = { msgtype: 'text', text: { content }, at: { atMobiles: mobiles, isAtAll: false } }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data || data.errcode !== 0) {
    throw new Error(`dingtalk webhook failed: ${data ? data.errmsg : 'HTTP ' + res.status}`)
  }
}

let tokenCache = { key: '', token: '', expiresAt: 0 }

async function accessToken(d) {
  const key = `${d.appKey}\n${d.appSecret}`
  const now = Date.now()
  if (tokenCache.key === key && tokenCache.token && tokenCache.expiresAt > now + 60_000) return tokenCache.token
  const url = `https://oapi.dingtalk.com/gettoken?appkey=${encodeURIComponent(d.appKey)}&appsecret=${encodeURIComponent(d.appSecret)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  const data = await res.json().catch(() => null)
  if (!data || data.errcode !== 0 || !data.access_token) {
    throw new Error(`dingtalk gettoken failed: ${data ? data.errmsg : 'HTTP ' + res.status}`)
  }
  tokenCache = { key, token: data.access_token, expiresAt: now + Math.max(60, Number(data.expires_in) || 7200) * 1000 }
  return tokenCache.token
}

async function sendWorkNotice(config, text) {
  const d = config.dingtalk
  const token = await accessToken(d)
  const body = new URLSearchParams()
  body.set('agent_id', d.agentId)
  body.set('userid_list', d.userIds)
  body.set('msg', JSON.stringify({ msgtype: 'text', text: { content: text } }))
  const res = await fetch(`https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2?access_token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(15000),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data || data.errcode !== 0) {
    throw new Error(`dingtalk work notice failed: ${data ? data.errmsg : 'HTTP ' + res.status}`)
  }
}

async function pushText(config, text) {
  if (!readyFor(config)) throw new Error('DingTalk is not configured')
  if (config.dingtalk.mode === 'worknotice') return sendWorkNotice(config, text)
  return sendWebhook(config, text)
}

// ---------------------------------------------------------------------------
// Reminder scheduler
// ---------------------------------------------------------------------------

const attempts = new Map()

function formatDueLabel(due) {
  return due ? due.replace('T', ' ') : ''
}

function reminderText(task, now) {
  const dms = dueMs(task.due)
  const late = dms !== null && now > dms
  const lines = ['【待办提醒】' + task.title, '截止：' + formatDueLabel(task.due)]
  if (late) {
    lines.push('状态：已逾期')
  } else if (dms !== null) {
    const hours = Math.max(0, Math.round((dms - now) / 3_600_000))
    lines.push('距离截止约 ' + hours + ' 小时')
  }
  if (task.sessionTitle) lines.push('关联会话：' + task.sessionTitle)
  lines.push('（来自 DSH 待办清单）')
  return lines.join('\n')
}

async function reminderTick(ctx) {
  let snapshot
  try { snapshot = await withLock(readState) } catch { return }
  const config = snapshot.config
  if (!readyFor(config)) return
  const now = Date.now()
  const candidates = []
  for (const task of snapshot.tasks) {
    if (task.done || !task.due) continue
    const effective = task.remindHours !== null ? task.remindHours : config.defaultRemindHours
    if (effective === null || effective === undefined || effective <= 0) continue
    if (task.reminderDue === task.due && task.remindedAt) continue
    const dms = dueMs(task.due)
    if (dms === null) continue
    const remindAt = dms - effective * 3_600_000
    // Send within [remindAt, due + 2h]; skip ancient tasks after app downtime.
    if (now < remindAt || now > dms + 2 * 3_600_000) continue
    candidates.push({ task, text: reminderText(task, now) })
  }
  for (const item of candidates) {
    const key = item.task.id + '|' + item.task.due
    const last = attempts.get(key) || 0
    if (now - last < RETRY_MS) continue
    attempts.set(key, now)
    try {
      await pushText(config, item.text)
      await withLock(async () => {
        const state = await readState()
        const target = state.tasks.find((t) => t.id === item.task.id)
        if (target && target.due === item.task.due) {
          target.remindedAt = Date.now()
          target.reminderDue = target.due
          await writeState(state)
        }
      })
      attempts.delete(key)
      try { ctx.logger?.info?.(`[todolist] reminder sent: ${item.task.title}`) } catch {}
    } catch (error) {
      try { ctx.logger?.warn?.(`[todolist] reminder failed: ${String(error)}`) } catch {}
    }
  }
}

// ---------------------------------------------------------------------------
// HTTP route
// ---------------------------------------------------------------------------

async function handleState(request) {
  let body = null
  try { body = await request.json() } catch { body = null }
  const op = body && typeof body === 'object' ? body.op : undefined
  try {
    if (op === 'save' && Array.isArray(body.tasks)) {
      const tasks = normalizeState({ tasks: body.tasks }).tasks
      const state = await withLock(async () => {
        const current = await readState()
        const next = { version: 2, tasks, config: current.config }
        await writeState(next)
        return next
      })
      return json({ ok: true, value: state })
    }
    if (op === 'saveConfig') {
      const config = normalizeConfig(body.config)
      const state = await withLock(async () => {
        const current = await readState()
        const next = { version: 2, tasks: current.tasks, config }
        await writeState(next)
        return next
      })
      return json({ ok: true, value: state })
    }
    if (op === 'testNotify') {
      const stored = await withLock(readState)
      const config = body && body.config ? normalizeConfig(body.config) : stored.config
      await pushText(config, '【待办提醒·测试】钉钉推送配置成功。\n（来自 DSH 待办清单）')
      return json({ ok: true })
    }
    const state = await withLock(readState)
    return json({ ok: true, value: state })
  } catch (error) {
    return json({ ok: false, error: { code: 'todolist/io', message: String(error) } })
  }
}

export function apply(ctx) {
  try { ctx.logger?.info?.('[todolist] host active · due-time & dingtalk reminders v0.2') } catch {}
  ctx.inject(['connection'], (scope) => {
    let connection
    try { connection = scope.get('connection') } catch { connection = undefined }
    const register = connection && connection.fetch && typeof connection.fetch.register === 'function'
      ? connection.fetch.register.bind(connection.fetch)
      : undefined
    if (register === undefined) {
      try { ctx.logger?.warn?.('[todolist] connection.fetch.register unavailable; /api/todolist/state not registered') } catch {}
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
  ctx.effect(() => {
    let stopped = false
    const timer = setInterval(() => { if (!stopped) reminderTick(ctx).catch(() => {}) }, TICK_MS)
    const first = setTimeout(() => { if (!stopped) reminderTick(ctx).catch(() => {}) }, 12_000)
    return () => { stopped = true; clearInterval(timer); clearTimeout(first) }
  }, 'todolist: reminder scheduler')
}
