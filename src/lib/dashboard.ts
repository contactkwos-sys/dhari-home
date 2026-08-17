import type {
  DnoMaster,
  LowStockItem,
  Order,
  Platform,
  StockMovement,
  StockRow,
} from '../types'

export type DashboardStats = {
  totalStockValue: number
  totalDesigns: number
  pendingOrders: number
  monthSales: number
}

export type SizeSlice = { name: string; value: number }
export type TopSeller = {
  dno: DnoMaster
  qtySold: number
  revenue: number
}
export type PlatformShare = {
  platform: Platform | string
  amount: number
  pct: number
}

export function computeDashboardStats(
  dnos: DnoMaster[],
  stockRows: StockRow[],
  orders: Order[],
): DashboardStats {
  const totalStockValue = stockRows.reduce((sum, r) => {
    const rate = Number(r.dno.purchase_rate ?? 0)
    return sum + rate * r.balance
  }, 0)

  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const monthSales = orders.reduce((sum, o) => {
    const d = new Date(o.order_date + 'T00:00:00')
    if (d.getFullYear() !== y || d.getMonth() !== m) return sum
    return sum + Number(o.pieces) * Number(o.sale_rate)
  }, 0)

  return {
    totalStockValue,
    totalDesigns: dnos.length,
    pendingOrders: orders.filter((o) => o.payment_status === 'COD Pending')
      .length,
    monthSales,
  }
}

export function stockBySize(stockRows: StockRow[]): {
  slices: SizeSlice[]
  totalPcs: number
} {
  const map = new Map<string, number>()
  for (const r of stockRows) {
    map.set(r.size, (map.get(r.size) ?? 0) + Math.max(0, r.balance))
  }
  const slices = [...map.entries()].map(([name, value]) => ({ name, value }))
  const totalPcs = slices.reduce((s, x) => s + x.value, 0)
  return { slices, totalPcs }
}

export function topSellingDesigns(
  dnos: DnoMaster[],
  orders: Order[],
  limit = 5,
): TopSeller[] {
  const byId = new Map<string, { qty: number; revenue: number }>()
  for (const o of orders) {
    const cur = byId.get(o.dno_id) ?? { qty: 0, revenue: 0 }
    cur.qty += o.pieces
    cur.revenue += o.pieces * Number(o.sale_rate)
    byId.set(o.dno_id, cur)
  }
  const dnoMap = new Map(dnos.map((d) => [d.id, d]))
  return [...byId.entries()]
    .map(([id, v]) => ({
      dno: dnoMap.get(id)!,
      qtySold: v.qty,
      revenue: v.revenue,
    }))
    .filter((x) => x.dno)
    .sort((a, b) => b.qtySold - a.qtySold || b.revenue - a.revenue)
    .slice(0, limit)
}

export function salesByMarketplace(orders: Order[]): PlatformShare[] {
  const map = new Map<string, number>()
  let total = 0
  for (const o of orders) {
    const amt = o.pieces * Number(o.sale_rate)
    map.set(o.platform, (map.get(o.platform) ?? 0) + amt)
    total += amt
  }
  return [...map.entries()]
    .map(([platform, amount]) => ({
      platform,
      amount,
      pct: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
}

export function movementRunningBalance(
  movements: StockMovement[],
  dnoId: string,
  size: string,
): number {
  return movements
    .filter((m) => m.dno_id === dnoId && m.size === size)
    .reduce((bal, m) => bal + (m.type === 'IN' ? m.qty : -m.qty), 0)
}

export function enrichMovementsWithBalance(
  movements: StockMovement[],
): Array<StockMovement & { balance_after: number }> {
  // movements are newest-first from API; compute chronologically then re-attach
  const chrono = [...movements].reverse()
  const bal = new Map<string, number>()
  const withBal: Array<StockMovement & { balance_after: number }> = []
  for (const m of chrono) {
    const key = `${m.dno_id}::${m.size}`
    const next = (bal.get(key) ?? 0) + (m.type === 'IN' ? m.qty : -m.qty)
    bal.set(key, next)
    withBal.push({ ...m, balance_after: next })
  }
  return withBal.reverse()
}

export function sortLowStockWorstFirst(items: LowStockItem[]): LowStockItem[] {
  return [...items].sort(
    (a, b) =>
      a.balance - b.balance ||
      a.dno.dno_number.localeCompare(b.dno.dno_number) ||
      a.size.localeCompare(b.size),
  )
}
