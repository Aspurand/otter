// Thin data-access layer over Supabase.
//
// Why this exists: we have previously hit a silent deadlock in the supabase-js v2
// SDK on plain CRUD calls. Every data call in the app goes through this layer so
// switching transports is a one-line change (set VITE_DB_USE_FETCH=1, or flip
// `transport` below). Auth and Realtime stay on the SDK.
//
// API: db.select(table, opts), db.insert(table, row, opts), db.update(table, patch, opts),
//      db.remove(table, opts), db.rpc(name, args). All return { data, error }.

import { supabase } from './supabase.js'
import { env } from './env.js'

const transport = env.USE_FETCH_TRANSPORT ? 'fetch' : 'sdk'

// ---------- shared helpers ----------

async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token ?? env.SUPABASE_ANON_KEY
  return {
    apikey: env.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function fetchError(res) {
  const text = await res.text()
  try {
    const j = JSON.parse(text)
    return new Error(j.message ?? text)
  } catch {
    return new Error(text)
  }
}

function buildQS({ select = '*', match, gt, gte, lt, lte, order, limit, range } = {}) {
  const p = new URLSearchParams()
  p.set('select', select)
  if (match) {
    for (const [k, v] of Object.entries(match)) {
      if (v === null) p.append(k, 'is.null')
      else if (Array.isArray(v)) p.append(k, `in.(${v.map((x) => encodeURIComponent(String(x))).join(',')})`)
      else p.append(k, `eq.${v}`)
    }
  }
  if (gt)    for (const [k, v] of Object.entries(gt))    p.append(k, `gt.${v}`)
  if (gte)   for (const [k, v] of Object.entries(gte))   p.append(k, `gte.${v}`)
  if (lt)    for (const [k, v] of Object.entries(lt))    p.append(k, `lt.${v}`)
  if (lte)   for (const [k, v] of Object.entries(lte))   p.append(k, `lte.${v}`)
  if (order) p.set('order', `${order.column}.${order.ascending === false ? 'desc' : 'asc'}`)
  if (limit != null) p.set('limit', String(limit))
  if (range) {
    p.set('offset', String(range.from))
    if (range.to != null) p.set('limit', String(range.to - range.from + 1))
  }
  return p.toString()
}

// ---------- fetch transport (PostgREST direct) ----------

async function fetchSelect(table, opts = {}) {
  const url = `${env.SUPABASE_URL}/rest/v1/${table}?${buildQS(opts)}`
  const res = await fetch(url, { headers: await authHeaders() })
  if (!res.ok) return { data: null, error: await fetchError(res) }
  return { data: await res.json(), error: null }
}

async function fetchInsert(table, row) {
  const url = `${env.SUPABASE_URL}/rest/v1/${table}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...(await authHeaders()), Prefer: 'return=representation' },
    body: JSON.stringify(Array.isArray(row) ? row : [row]),
  })
  if (!res.ok) return { data: null, error: await fetchError(res) }
  const arr = await res.json()
  return { data: Array.isArray(row) ? arr : arr[0], error: null }
}

async function fetchUpdate(table, patch, { match }) {
  const qs = buildQS({ select: '*', match })
  const url = `${env.SUPABASE_URL}/rest/v1/${table}?${qs}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { ...(await authHeaders()), Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) return { data: null, error: await fetchError(res) }
  return { data: await res.json(), error: null }
}

async function fetchRemove(table, { match }) {
  const qs = buildQS({ select: '*', match })
  const url = `${env.SUPABASE_URL}/rest/v1/${table}?${qs}`
  const res = await fetch(url, { method: 'DELETE', headers: await authHeaders() })
  if (!res.ok) return { data: null, error: await fetchError(res) }
  return { data: null, error: null }
}

async function fetchRpc(name, args) {
  const url = `${env.SUPABASE_URL}/rest/v1/rpc/${name}`
  const res = await fetch(url, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(args ?? {}),
  })
  if (!res.ok) return { data: null, error: await fetchError(res) }
  return { data: await res.json(), error: null }
}

// ---------- SDK transport ----------

async function sdkSelect(table, { select = '*', match, gt, gte, lt, lte, order, limit, range } = {}) {
  let q = supabase.from(table).select(select)
  if (match) {
    for (const [k, v] of Object.entries(match)) {
      if (v === null) q = q.is(k, null)
      else if (Array.isArray(v)) q = q.in(k, v)
      else q = q.eq(k, v)
    }
  }
  if (gt)    for (const [k, v] of Object.entries(gt))    q = q.gt(k, v)
  if (gte)   for (const [k, v] of Object.entries(gte))   q = q.gte(k, v)
  if (lt)    for (const [k, v] of Object.entries(lt))    q = q.lt(k, v)
  if (lte)   for (const [k, v] of Object.entries(lte))   q = q.lte(k, v)
  if (order) q = q.order(order.column, { ascending: order.ascending !== false })
  if (limit != null) q = q.limit(limit)
  if (range) q = q.range(range.from, range.to)
  return q
}

async function sdkInsert(table, row) {
  return supabase.from(table).insert(row).select()
}

async function sdkUpdate(table, patch, { match }) {
  let q = supabase.from(table).update(patch)
  for (const [k, v] of Object.entries(match)) {
    if (v === null) q = q.is(k, null)
    else if (Array.isArray(v)) q = q.in(k, v)
    else q = q.eq(k, v)
  }
  return q.select()
}

async function sdkRemove(table, { match }) {
  let q = supabase.from(table).delete()
  for (const [k, v] of Object.entries(match)) {
    if (v === null) q = q.is(k, null)
    else if (Array.isArray(v)) q = q.in(k, v)
    else q = q.eq(k, v)
  }
  return q
}

async function sdkRpc(name, args) {
  return supabase.rpc(name, args)
}

// ---------- public API ----------

const impl =
  transport === 'fetch'
    ? { select: fetchSelect, insert: fetchInsert, update: fetchUpdate, remove: fetchRemove, rpc: fetchRpc }
    : { select: sdkSelect, insert: sdkInsert, update: sdkUpdate, remove: sdkRemove, rpc: sdkRpc }

export const db = {
  transport,
  select: (table, opts) => impl.select(table, opts),
  insert: (table, row, opts) => impl.insert(table, row, opts),
  update: (table, patch, opts) => impl.update(table, patch, opts),
  remove: (table, opts) => impl.remove(table, opts),
  rpc: (name, args) => impl.rpc(name, args),
}
