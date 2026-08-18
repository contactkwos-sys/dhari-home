import { supabase } from './supabase'
import {
  compressImageFile,
  isPhotoUploadError,
  PhotoTooLargeError,
} from './compressImage'
import type {
  AppRole,
  DnoMaster,
  DnoSize,
  LowStockItem,
  Manufacturer,
  Order,
  Platform,
  PaymentStatus,
  StockMovement,
  StockRow,
} from '../types'

export async function fetchDnos(): Promise<DnoMaster[]> {
  const { data, error } = await supabase
    .from('dno_master')
    .select('*')
    .order('dno_number')
  if (error) throw error
  return (data ?? []).map(normalizeDno)
}

function normalizeDno(row: DnoMaster): DnoMaster {
  return {
    ...row,
    low_stock_threshold:
      row.low_stock_threshold == null ? 10 : Number(row.low_stock_threshold),
  }
}

export async function updateDno(
  id: string,
  patch: Partial<Omit<DnoMaster, 'id' | 'dno_number'>>,
): Promise<DnoMaster> {
  const payload = sanitizeDnoPatch(patch)
  const { data, error } = await supabase
    .from('dno_master')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  if (!data) throw new Error('Update returned no row — check RLS UPDATE/SELECT on dno_master')
  return normalizeDno(data)
}

export async function createDno(input: {
  dno_number: string
  manufacturer: Manufacturer
  other_manufacturer_name?: string | null
  purchase_rate?: number | null
  category?: string | null
  hsn_code?: string | null
  gst_rate?: number
  date_added?: string
  photo_url?: string | null
  low_stock_threshold?: number
}): Promise<DnoMaster> {
  const dno_number = input.dno_number.trim()
  if (!dno_number) throw new Error('DNO number is required')

  const row = {
    dno_number,
    manufacturer: input.manufacturer,
    other_manufacturer_name:
      input.manufacturer === 'Other'
        ? input.other_manufacturer_name?.trim() || null
        : null,
    purchase_rate:
      input.purchase_rate == null || Number.isNaN(Number(input.purchase_rate))
        ? null
        : Number(input.purchase_rate),
    category: input.category?.trim() || null,
    hsn_code: input.hsn_code?.trim() || '6304',
    gst_rate:
      input.gst_rate == null || Number.isNaN(Number(input.gst_rate))
        ? 12
        : Number(input.gst_rate),
    date_added: input.date_added || todayISO(),
    photo_url: input.photo_url ?? null,
    low_stock_threshold:
      input.low_stock_threshold == null ||
      Number.isNaN(Number(input.low_stock_threshold))
        ? 10
        : Math.max(0, Math.floor(Number(input.low_stock_threshold))),
  }

  const { data, error } = await supabase
    .from('dno_master')
    .insert(row)
    .select('*')
    .single()
  if (error) throw error
  if (!data) throw new Error('Insert returned no row — check RLS INSERT/SELECT on dno_master')
  return normalizeDno(data)
}

function sanitizeDnoPatch(
  patch: Partial<Omit<DnoMaster, 'id' | 'dno_number'>>,
): Partial<Omit<DnoMaster, 'id' | 'dno_number'>> {
  const out: Partial<Omit<DnoMaster, 'id' | 'dno_number'>> = { ...patch }
  if ('category' in out) out.category = out.category?.trim() || null
  if ('hsn_code' in out) out.hsn_code = out.hsn_code?.trim() || null
  if ('other_manufacturer_name' in out) {
    out.other_manufacturer_name = out.other_manufacturer_name?.trim() || null
  }
  if ('purchase_rate' in out && out.purchase_rate != null) {
    out.purchase_rate = Number(out.purchase_rate)
    if (Number.isNaN(out.purchase_rate)) out.purchase_rate = null
  }
  if ('gst_rate' in out && out.gst_rate != null) {
    out.gst_rate = Number(out.gst_rate)
  }
  if ('low_stock_threshold' in out && out.low_stock_threshold != null) {
    out.low_stock_threshold = Math.max(
      0,
      Math.floor(Number(out.low_stock_threshold)),
    )
  }
  // Size lives on stock_movements / orders — never send it on dno_master
  delete (out as { size?: unknown }).size
  return out
}

export async function uploadDnoPhoto(
  dnoId: string,
  dnoNumber: string,
  file: File,
): Promise<string> {
  let toUpload: File
  try {
    toUpload = await compressImageFile(file)
  } catch (e) {
    if (e instanceof PhotoTooLargeError) throw e
    // Compression failed unexpectedly — try original if within limit
    if (file.size > 10 * 1024 * 1024) throw new PhotoTooLargeError()
    toUpload = file
  }

  const path = `${dnoNumber}/${Date.now()}.jpg`
  const { error: uploadError } = await supabase.storage
    .from('dno-photos')
    .upload(path, toUpload, {
      upsert: true,
      contentType: toUpload.type || 'image/jpeg',
    })
  if (uploadError) {
    if (isPhotoUploadError(uploadError)) throw new PhotoTooLargeError()
    throw uploadError
  }

  const { data } = supabase.storage.from('dno-photos').getPublicUrl(path)
  const photo_url = data.publicUrl
  await updateDno(dnoId, { photo_url })
  return photo_url
}

export async function clearDnoPhoto(dnoId: string): Promise<DnoMaster> {
  return updateDno(dnoId, { photo_url: null })
}

export async function deleteDno(id: string): Promise<void> {
  const { count: orderCount, error: orderErr } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('dno_id', id)
  if (orderErr) throw orderErr
  if ((orderCount ?? 0) > 0) {
    throw new Error(
      'Cannot delete this DNO — it has orders. Remove related orders first.',
    )
  }

  const { error: moveErr } = await supabase
    .from('stock_movements')
    .delete()
    .eq('dno_id', id)
  if (moveErr) throw moveErr

  const { error } = await supabase.from('dno_master').delete().eq('id', id)
  if (error) throw error
}

export async function updateStockMovement(
  id: string,
  patch: {
    dno_id?: string
    size?: DnoSize
    type?: 'IN' | 'OUT'
    qty?: number
    date?: string
    note?: string | null
  },
): Promise<StockMovement> {
  const payload: Record<string, unknown> = { ...patch }
  if (payload.qty != null) {
    const qty = Math.floor(Number(payload.qty))
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error('Quantity must be a positive whole number')
    }
    payload.qty = qty
  }
  if (payload.note !== undefined) {
    payload.note =
      typeof payload.note === 'string' ? payload.note.trim() || null : null
  }

  const { data, error } = await supabase
    .from('stock_movements')
    .update(payload)
    .eq('id', id)
    .select('*, dno_master(dno_number)')
    .single()
  if (error) throw error
  if (!data) throw new Error('Update returned no row — check RLS on stock_movements')
  return data as StockMovement
}

export async function deleteStockMovement(id: string): Promise<void> {
  const { error } = await supabase.from('stock_movements').delete().eq('id', id)
  if (error) throw error
}

export async function fetchStockMovements(): Promise<StockMovement[]> {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('*, dno_master(dno_number)')
    .order('date', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw error
  return (data ?? []) as StockMovement[]
}

export async function addStockIn(input: {
  dno_id: string
  size: DnoSize
  qty: number
  date?: string
  note?: string | null
}): Promise<StockMovement> {
  if (!input.dno_id) throw new Error('DNO is required')
  if (input.size !== '5ft x 4ft' && input.size !== '7ft x 4ft') {
    throw new Error('Size must be 5ft x 4ft or 7ft x 4ft')
  }
  const qty = Math.floor(Number(input.qty))
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error('Quantity must be a positive whole number')
  }

  const date = input.date || todayISO()
  const note = input.note?.trim() || null

  // Prefer RPC (security definer) when available — clearer errors / RLS-safe
  const { data: rpcData, error: rpcError } = await supabase.rpc('add_stock_in', {
    p_dno_id: input.dno_id,
    p_size: input.size,
    p_qty: qty,
    p_date: date,
    p_note: note,
  })

  if (!rpcError && rpcData) {
    const row = rpcData as StockMovement
    const { data: joined } = await supabase
      .from('stock_movements')
      .select('*, dno_master(dno_number)')
      .eq('id', row.id)
      .maybeSingle()
    return (joined as StockMovement) ?? row
  }

  // Fallback to direct insert if RPC not deployed yet
  if (rpcError && !/could not find the function|PGRST202/i.test(rpcError.message)) {
    throw rpcError
  }

  const { data, error } = await supabase
    .from('stock_movements')
    .insert({
      dno_id: input.dno_id,
      size: input.size,
      type: 'IN',
      qty,
      date,
      note,
    })
    .select('*, dno_master(dno_number)')
    .single()
  if (error) throw error
  if (!data) {
    throw new Error(
      'Stock insert returned no row — check RLS INSERT/SELECT on stock_movements and that size column exists',
    )
  }
  return data as StockMovement
}

export async function getStockBalance(
  dnoId: string,
  size: DnoSize,
): Promise<number> {
  const { data, error } = await supabase.rpc('dno_size_stock_balance', {
    p_dno_id: dnoId,
    p_size: size,
  })
  if (error) throw error
  return Number(data ?? 0)
}

export async function fetchStockRows(): Promise<StockRow[]> {
  const [dnos, movements] = await Promise.all([
    fetchDnos(),
    fetchStockMovements(),
  ])
  const dnoById = new Map(dnos.map((d) => [d.id, d]))
  const keys = new Map<string, { dno_id: string; size: DnoSize }>()

  for (const m of movements) {
    const key = `${m.dno_id}::${m.size}`
    if (!keys.has(key)) keys.set(key, { dno_id: m.dno_id, size: m.size })
  }

  const rows: StockRow[] = []
  for (const { dno_id, size } of keys.values()) {
    const dno = dnoById.get(dno_id)
    if (!dno) continue
    const mine = movements.filter((m) => m.dno_id === dno_id && m.size === size)
    const inbound = mine
      .filter((m) => m.type === 'IN')
      .reduce((s, m) => s + m.qty, 0)
    const outbound = mine
      .filter((m) => m.type === 'OUT')
      .reduce((s, m) => s + m.qty, 0)
    rows.push({ dno, size, inbound, outbound, balance: inbound - outbound })
  }

  rows.sort((a, b) => {
    const byDno = a.dno.dno_number.localeCompare(b.dno.dno_number)
    if (byDno !== 0) return byDno
    return a.size.localeCompare(b.size)
  })
  return rows
}

export async function fetchLowStockItems(): Promise<LowStockItem[]> {
  const rows = await fetchStockRows()
  return rows
    .filter((r) => r.balance <= (r.dno.low_stock_threshold ?? 10))
    .map((r) => ({
      dno: r.dno,
      size: r.size,
      balance: r.balance,
      threshold: r.dno.low_stock_threshold ?? 10,
    }))
    .sort((a, b) => a.balance - b.balance || a.dno.dno_number.localeCompare(b.dno.dno_number))
}

export async function fetchOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, dno_master(dno_number, hsn_code, gst_rate, category, photo_url)')
    .order('order_date', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw error
  return (data ?? []) as Order[]
}

export async function createOrder(input: {
  order_date: string
  dno_id: string
  size: DnoSize
  platform: Platform
  platform_order_id?: string | null
  pieces: number
  sale_rate: number
  buyer_name?: string | null
  buyer_state?: string | null
  courier?: string | null
  awb_number?: string | null
  payment_status: PaymentStatus
  invoice_no?: string | null
}): Promise<Order> {
  const { data, error } = await supabase.rpc('create_order_with_stock', {
    p_order_date: input.order_date,
    p_dno_id: input.dno_id,
    p_platform: input.platform,
    p_platform_order_id: input.platform_order_id ?? null,
    p_pieces: input.pieces,
    p_sale_rate: input.sale_rate,
    p_buyer_name: input.buyer_name ?? null,
    p_buyer_state: input.buyer_state ?? null,
    p_courier: input.courier ?? null,
    p_awb_number: input.awb_number ?? null,
    p_payment_status: input.payment_status,
    p_invoice_no: input.invoice_no ?? null,
    p_size: input.size,
  })
  if (error) throw error
  return data as Order
}

export async function loginWithPin(
  role: AppRole,
  pin: string,
): Promise<{ role: AppRole }> {
  const { data, error } = await supabase.functions.invoke('pin-login', {
    body: { role, pin },
  })
  if (error) {
    const bodyError = (data as { error?: string } | null)?.error
    const ctx = (error as { context?: Response }).context
    let gatewayMessage: string | undefined
    if (!bodyError && ctx && typeof ctx.json === 'function') {
      try {
        const payload = (await ctx.clone().json()) as { error?: string }
        gatewayMessage = payload.error
      } catch {
        /* ignore */
      }
    }
    throw new Error(bodyError ?? gatewayMessage ?? error.message ?? 'Login failed')
  }
  if (data?.error) throw new Error(String(data.error))
  if (!data?.access_token || !data?.refresh_token) {
    throw new Error('No session returned from pin-login')
  }
  const { error: setErr } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  })
  if (setErr) throw setErr
  return { role: (data.role as AppRole) || role }
}

export async function resetRolePin(role: AppRole, pin: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('pin-reset', {
    body: { role, pin },
  })
  if (error) {
    const bodyError = (data as { error?: string } | null)?.error
    throw new Error(bodyError ?? error.message ?? 'PIN reset failed')
  }
  if (data?.error) throw new Error(String(data.error))
}

export function formatMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n)
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}
