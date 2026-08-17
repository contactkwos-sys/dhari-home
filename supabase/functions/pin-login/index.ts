import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

type RoleName = 'Owner' | 'Warehouse'

type PinHashParts = {
  iterations: number
  saltB64: string
  hashB64: string
}

function parsePinHash(stored: string): PinHashParts {
  const parts = stored.split('$')
  if (parts.length !== 5 || parts[0] !== 'pbkdf2' || parts[1] !== 'sha256') {
    throw new Error('Unsupported pin_hash format')
  }
  return {
    iterations: Number(parts[2]),
    saltB64: parts[3],
    hashB64: parts[4],
  }
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToB64(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes)
  let s = ''
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i])
  return btoa(s)
}

async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const { iterations, saltB64, hashB64 } = parsePinHash(stored)
  const salt = b64ToBytes(saltB64)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256,
  )
  return bytesToB64(bits) === hashB64
}

function authPasswordFromPin(pin: string): string {
  return `${pin}${pin}`
}

function roleEmail(role: RoleName): string {
  return `${role.toLowerCase()}@dhari.local`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const role = String(body.role || '') as RoleName
    const pin = String(body.pin || '')

    if (role !== 'Owner' && role !== 'Warehouse') {
      return new Response(JSON.stringify({ error: 'Invalid role' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!/^\d{4}$/.test(pin)) {
      return new Response(JSON.stringify({ error: 'PIN must be 4 digits' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || serviceKey
    const admin = createClient(supabaseUrl, serviceKey)

    const { data: row, error: rowErr } = await admin
      .from('app_role_pins')
      .select('role, pin_hash, auth_user_id')
      .eq('role', role)
      .maybeSingle()
    if (rowErr) throw rowErr
    if (!row?.pin_hash) {
      return new Response(JSON.stringify({ error: 'PIN not configured for role' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const ok = await verifyPin(pin, row.pin_hash)
    if (!ok) {
      return new Response(JSON.stringify({ error: 'Invalid PIN' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authPassword = authPasswordFromPin(pin)
    const email = roleEmail(role)
    const meta = {
      role_name: role,
      full_name: role,
      pin_hash: row.pin_hash,
    }

    let userId = row.auth_user_id as string | null

    if (userId) {
      const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
        password: authPassword,
        email_confirm: true,
        user_metadata: meta,
      })
      if (updErr) {
        // Stale id — recreate below
        userId = null
      }
    }

    if (!userId) {
      const { data: listed } = await admin.auth.admin.listUsers({ perPage: 200 })
      const existing = (listed?.users || []).find((u) => {
        const m = (u.user_metadata || {}) as Record<string, string>
        return m.role_name === role || u.email === email
      })
      if (existing) {
        userId = existing.id
        await admin.auth.admin.updateUserById(userId, {
          password: authPassword,
          email_confirm: true,
          user_metadata: meta,
        })
      } else {
        const { data: created, error: cErr } = await admin.auth.admin.createUser({
          email,
          password: authPassword,
          email_confirm: true,
          user_metadata: meta,
        })
        if (cErr) throw cErr
        userId = created.user!.id
      }
      await admin
        .from('app_role_pins')
        .update({ auth_user_id: userId, updated_at: new Date().toISOString() })
        .eq('role', role)
    }

    const passwordClient = createClient(supabaseUrl, anonKey)
    const { data: pwSession, error: pwErr } = await passwordClient.auth.signInWithPassword({
      email,
      password: authPassword,
    })
    if (!pwErr && pwSession.session) {
      return new Response(
        JSON.stringify({
          access_token: pwSession.session.access_token,
          refresh_token: pwSession.session.refresh_token,
          role,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })
    if (linkErr) throw linkErr

    const tokenHash =
      (linkData as { properties?: { hashed_token?: string }; hashed_token?: string }).properties
        ?.hashed_token ||
      (linkData as { hashed_token?: string }).hashed_token
    if (!tokenHash) {
      return new Response(JSON.stringify({ error: 'Failed to create session token' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: sessionData, error: otpErr } = await admin.auth.verifyOtp({
      type: 'email',
      token_hash: tokenHash,
    })
    if (otpErr) throw otpErr

    return new Response(
      JSON.stringify({
        access_token: sessionData.session?.access_token,
        refresh_token: sessionData.session?.refresh_token,
        role,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
