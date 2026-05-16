import { corsHeaders } from '../_shared/cors.ts'

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN')

  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token && verifyToken && token === verifyToken) {
      return new Response(challenge ?? '', {
        status: 200,
        headers: corsHeaders,
      })
    }

    return jsonResponse({ error: 'No fue posible verificar el webhook.' }, 403)
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido.' }, 405)
  }

  try {
    const payload = await req.json()

    console.log('whatsapp-webhook', JSON.stringify(payload))

    return jsonResponse({
      ok: true,
      message: 'Webhook recibido.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado.'
    return jsonResponse({ error: message }, 400)
  }
})
