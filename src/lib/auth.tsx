import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { loginWithPin as apiLoginWithPin } from './api'
import { supabase } from './supabase'
import type { AppRole } from '../types'

type AuthState = {
  session: Session | null
  role: AppRole | null
  loading: boolean
  isOwner: boolean
  isWarehouse: boolean
  loginWithPin: (role: AppRole, pin: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

function roleFromSession(session: Session | null): AppRole | null {
  const name = (session?.user?.user_metadata as { role_name?: string } | undefined)
    ?.role_name
  if (name === 'Owner' || name === 'Warehouse') return name
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (mounted) setSession(data.session)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const loginWithPin = useCallback(async (role: AppRole, pin: string) => {
    const result = await apiLoginWithPin(role, pin)
    const { data } = await supabase.auth.getSession()
    setSession(data.session)
    if (!roleFromSession(data.session) && result.role) {
      // Session may lag metadata; keep role via refresh
      await supabase.auth.refreshSession()
      const again = await supabase.auth.getSession()
      setSession(again.data.session)
    }
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
  }, [])

  const role = roleFromSession(session)

  const value = useMemo(
    () => ({
      session,
      role,
      loading,
      isOwner: role === 'Owner',
      isWarehouse: role === 'Warehouse',
      loginWithPin,
      logout,
    }),
    [session, role, loading, loginWithPin, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
