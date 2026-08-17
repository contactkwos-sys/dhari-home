import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { fetchLowStockItems } from '../lib/api'
import type { LowStockItem } from '../types'
import { useAuth } from '../lib/auth'

type LowStockState = {
  items: LowStockItem[]
  count: number
  refresh: () => Promise<void>
}

const LowStockContext = createContext<LowStockState | null>(null)

export function LowStockProvider({ children }: { children: ReactNode }) {
  const { role } = useAuth()
  const [items, setItems] = useState<LowStockItem[]>([])

  const refresh = useCallback(async () => {
    if (!role) {
      setItems([])
      return
    }
    try {
      setItems(await fetchLowStockItems())
    } catch {
      /* keep previous */
    }
  }, [role])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), 60_000)
    return () => window.clearInterval(id)
  }, [refresh])

  return (
    <LowStockContext.Provider value={{ items, count: items.length, refresh }}>
      {children}
    </LowStockContext.Provider>
  )
}

export function useLowStock() {
  const ctx = useContext(LowStockContext)
  if (!ctx) throw new Error('useLowStock must be used within LowStockProvider')
  return ctx
}
