import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

type RoleName = 'Owner' | 'Warehouse'

function bytesToB64(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes)
  let s = ''
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i])
  return btoa(s)
}

async function hashPin(pin: string): Promise<string> {
  const iterations = 100000
  const salt = crypto.getRandomValues(new Uint8Array(16))
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
  return `pbkdf2$sha256$${iterations}$${bytesToB64(salt.buffer)}$${bytesToB64(bits)}`
}

function authPasswordFromPin(pin: string): string {
  return `${pin}${pin}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || serviceKey

    // Caller must be an authenticated Owner
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const callerRole =
      (userData.user.user_metadata as { role_name?: string } | undefined)?.role_name
    if (callerRole !== 'Owner') {
      return new Response(JSON.stringify({ error: 'Only Owner can change PINs' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { role, pin } = await req.json()
    if (role !== 'Owner' && role !== 'Warehouse') {
      return new Response(JSON.stringify({ error: 'Invalid role' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!/^\d{4}$/.test(String(pin))) {
      return new Response(JSON.stringify({ error: 'PIN must be 4 digits' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const pin_hash = await hashPin(String(pin))
    const authPassword = authPasswordFromPin(String(pin))

    const { data: existing } = await admin
      .from('app_role_pins')
      .select('auth_user_id')
      .eq('role', role as RoleName)
      .maybeSingle()

    const { error: upErr } = await admin.from('app_role_pins').upsert({
      role,
      pin_hash,
      auth_user_id: existing?.auth_user_id ?? null,
      updated_at: new Date().toISOString(),
    })
    if (upErr) throw upErr

    if (existing?.auth_user_id) {
      await admin.auth.admin.updateUserById(existing.auth_user_id, {
        password: authPassword,
        user_metadata: {
          role_name: role,
          full_name: role,
          pin_hash,
        },
      })
    }

    return new Response(JSON.stringify({ ok: true, role }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'PIN reset failed'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
