import type { AppRole } from '../types'

export type AppTab = {
  to: string
  label: string
  end: boolean
  roles: readonly AppRole[]
}

export const APP_TABS: readonly AppTab[] = [
  { to: '/', label: 'Dashboard', end: true, roles: ['Owner'] },
  { to: '/dno', label: 'DNO Master', end: false, roles: ['Owner'] },
  { to: '/stock', label: 'Warehouse', end: false, roles: ['Owner', 'Warehouse'] },
  { to: '/orders', label: 'Orders', end: false, roles: ['Owner', 'Warehouse'] },
  { to: '/bill', label: 'Bill', end: false, roles: ['Owner'] },
] as const

export function tabsForRole(role: AppRole): AppTab[] {
  return APP_TABS.filter((t) => t.roles.includes(role))
}
