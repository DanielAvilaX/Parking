import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type TemplateParameter = {
  type?: 'text'
  text: string
}

type SendWhatsAppPayload = {
  to: string
  mode?: 'text' | 'template'
  text?: string
  templateName?: string
  templateLanguageCode?: string
  templateParameters?: TemplateParameter[]
  metadata?: Record<string, unknown>
}

function getPublishableKey() {
  const publishableKeys = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')

  if (publishableKeys) {
    try {
      const parsed = JSON.parse(publishableKeys)
      return parsed.default ?? Object.values(parsed)[0]
    } catch (_error) {
      // Fallback to legacy env names below.
    }
  }

  return (
    Deno.env.get('SUPABASE_ANON_KEY')
    ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
    ?? null
  )
}

function normalizeWhatsAppNumber(value: string) {
  return value.replace(/[^\d]/g, '')
}

function buildTemplateComponents(parameters: TemplateParameter[] = []) {
  if (!parameters.length) {
    return undefined
  }

  return [
    {
      type: 'body',
      parameters: parameters.map((parameter) => ({
        type: parameter.type ?? 'text',
        text: parameter.text,
      })),
    },
  ]
}

async function requireAuthenticatedUser(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const publishableKey = getPublishableKey()
  const authHeader = req.headers.get('Authorization')

  if (!supabaseUrl || !publishableKey || !authHeader) {
    return null
  }

  const supabase = createClient(supabaseUrl, String(publishableKey), {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  })

  const { data, error } = await supabase.auth.getUser()

  if (error) {
    throw new Error(`No fue posible validar la sesión: ${error.message}`)
  }

  return data.user ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método no permitido.' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }

  try {
    const currentUser = await requireAuthenticatedUser(req)

    if (!currentUser) {
      return new Response(
        JSON.stringify({ error: 'Sesión no válida o ausente.' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const {
      to,
      mode = 'template',
      text,
      templateName,
      templateLanguageCode = Deno.env.get('WHATSAPP_DEFAULT_TEMPLATE_LANGUAGE') ?? 'es_CO',
      templateParameters = [],
      metadata = {},
    } = await req.json() as SendWhatsAppPayload

    if (!to) {
      throw new Error('El número destino es obligatorio.')
    }

    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
    const apiVersion = Deno.env.get('WHATSAPP_API_VERSION') ?? 'v23.0'

    if (!accessToken || !phoneNumberId) {
      throw new Error('Faltan secretos de WhatsApp en la función.')
    }

    let outboundPayload: Record<string, unknown>

    if (mode === 'text') {
      if (!text?.trim()) {
        throw new Error('El cuerpo del mensaje es obligatorio en modo text.')
      }

      outboundPayload = {
        messaging_product: 'whatsapp',
        to: normalizeWhatsAppNumber(to),
        type: 'text',
        text: {
          body: text.trim(),
          preview_url: false,
        },
      }
    } else {
      if (!templateName?.trim()) {
        throw new Error('El nombre del template es obligatorio en modo template.')
      }

      outboundPayload = {
        messaging_product: 'whatsapp',
        to: normalizeWhatsAppNumber(to),
        type: 'template',
        template: {
          name: templateName.trim(),
          language: {
            code: templateLanguageCode,
          },
          components: buildTemplateComponents(templateParameters),
        },
      }
    }

    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(outboundPayload),
      },
    )

    const responseBody = await response.json()

    return new Response(
      JSON.stringify({
        ok: response.ok,
        requestedBy: currentUser.email,
        mode,
        metadata,
        providerResponse: responseBody,
      }),
      {
        status: response.ok ? 200 : response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado.'

    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
