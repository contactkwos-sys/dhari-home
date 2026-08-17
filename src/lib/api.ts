import { supabase } from './supabase'
import type {
  DnoMaster,
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
  return data ?? []
}

export async function updateDno(
  id: string,
  patch: Partial<DnoMaster>,
): Promise<DnoMaster> {
  const { data, error } = await supabase
    .from('dno_master')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function createDno(input: {
  dno_number: string
  size: string
  manufacturer: Manufacturer
  other_manufacturer_name?: string | null
  purchase_rate?: number | null
  category?: string | null
  hsn_code?: string | null
  gst_rate?: number
  date_added?: string
  photo_url?: string | null
}): Promise<DnoMaster> {
  const { data, error } = await supabase
    .from('dno_master')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function uploadDnoPhoto(
  dnoId: string,
  dnoNumber: string,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${dnoNumber}/${Date.now()}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from('dno-photos')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('dno-photos').getPublicUrl(path)
  const photo_url = data.publicUrl
  await updateDno(dnoId, { photo_url })
  return photo_url
}

export async function fetchStockMovements(): Promise<StockMovement[]> {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('*, dno_master(dno_number, size)')
    .order('date', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw error
  return (data ?? []) as StockMovement[]
}

export async function addStockMovement(input: {
  dno_id: string
  type: 'IN' | 'OUT'
  qty: number
  date: string
  note?: string | null
}): Promise<StockMovement> {
  if (input.type === 'OUT') {
    const bal = await getStockBalance(input.dno_id)
    if (bal < input.qty) {
      throw new Error(`Insufficient stock: available ${bal}, requested ${input.qty}`)
    }
  }
  const { data, error } = await supabase
    .from('stock_movements')
    .insert(input)
    .select('*, dno_master(dno_number, size)')
    .single()
  if (error) throw error
  return data as StockMovement
}

export async function getStockBalance(dnoId: string): Promise<number> {
  const { data, error } = await supabase.rpc('dno_stock_balance', {
    p_dno_id: dnoId,
  })
  if (error) throw error
  return Number(data ?? 0)
}

export async function fetchStockRows(): Promise<StockRow[]> {
  const [dnos, movements] = await Promise.all([
    fetchDnos(),
    fetchStockMovements(),
  ])
  return dnos.map((dno) => {
    const mine = movements.filter((m) => m.dno_id === dno.id)
    const inbound = mine
      .filter((m) => m.type === 'IN')
      .reduce((s, m) => s + m.qty, 0)
    const outbound = mine
      .filter((m) => m.type === 'OUT')
      .reduce((s, m) => s + m.qty, 0)
    return { dno, inbound, outbound, balance: inbound - outbound }
  })
}

export async function fetchOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, dno_master(dno_number, size, hsn_code, gst_rate, category)')
    .order('order_date', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw error
  return (data ?? []) as Order[]
}

export async function createOrder(input: {
  order_date: string
  dno_id: string
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
  })
  if (error) throw error
  return data as Order
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
