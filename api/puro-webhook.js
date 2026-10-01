import {
  createHmac,
  timingSafeEqual
} from 'node:crypto';

// Puro ERP -> Control de Pedidos
//
// Environment Variable requerida en Vercel:
// PURO_WEBHOOK_SECRET=whsec_...
//
// Producción:
// https://control-pedidos-app.vercel.app/api/puro-webhook

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });

const textoSeguro = (valor) => String(valor ?? '').trim();

const verificarFirmaPuro = ({ rawBody, signature, secret }) => {
  const firmaRecibida = textoSeguro(signature);
  const secreto = textoSeguro(secret);

  if (!firmaRecibida || !secreto) return false;

  // Formato observado de Puro:
  // X-Puro-Signature: sha256=<64 caracteres hex>
  const esperada = `sha256=${createHmac('sha256', secreto)
    .update(rawBody, 'utf8')
    .digest('hex')}`;

  const a = Buffer.from(firmaRecibida, 'utf8');
  const b = Buffer.from(esperada, 'utf8');

  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
};

export async function GET() {
  return json({
    ok: true,
    service: 'puro-webhook',
    app: 'control-pedidos',
    hmacValidation: true,
    status: 'ready',
    timestamp: new Date().toISOString()
  });
}

export async function POST(request) {
  const receivedAt = new Date().toISOString();

  try {
    const secret = process.env.PURO_WEBHOOK_SECRET;

    if (!secret) {
      console.error(
        '[PURO WEBHOOK] Falta la variable de entorno PURO_WEBHOOK_SECRET.'
      );

      return json(
        {
          ok: false,
          error: 'webhook_secret_not_configured'
        },
        500
      );
    }

    // IMPORTANTE:
    // La firma se calcula contra el cuerpo RAW, antes de JSON.parse().
    const rawBody = await request.text();

    const signature =
      request.headers.get('x-puro-signature') ||
      request.headers.get('X-Puro-Signature') ||
      '';

    if (!signature) {
      console.warn('[PURO WEBHOOK] Solicitud rechazada: falta X-Puro-Signature.');

      return json(
        {
          ok: false,
          error: 'missing_signature'
        },
        401
      );
    }

    const firmaValida = verificarFirmaPuro({
      rawBody,
      signature,
      secret
    });

    if (!firmaValida) {
      // No registramos ni el secret ni el body completo.
      console.warn(
        '[PURO WEBHOOK] Solicitud rechazada: firma HMAC inválida.',
        JSON.stringify({
          receivedAt,
          signaturePresent: true,
          signaturePrefix: signature.slice(0, 15),
          bodyLength: rawBody.length
        })
      );

      return json(
        {
          ok: false,
          error: 'invalid_signature'
        },
        401
      );
    }

    let payload;

    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.warn('[PURO WEBHOOK] Firma válida, pero el body no es JSON.');

      return json(
        {
          ok: false,
          error: 'invalid_json'
        },
        400
      );
    }

    const event = textoSeguro(payload?.event);
    const timestamp = textoSeguro(payload?.timestamp);
    const data = payload?.data ?? null;

    if (!event) {
      console.warn('[PURO WEBHOOK] Firma válida, pero falta payload.event.');

      return json(
        {
          ok: false,
          error: 'missing_event'
        },
        400
      );
    }

    // Primera etapa segura:
    // todavía no escribimos en RTDB ni ejecutamos acciones de negocio.
    // Registramos sólo metadatos mínimos para conocer cada tipo de evento.
    console.info(
      '[PURO WEBHOOK VALIDADO]',
      JSON.stringify({
        receivedAt,
        event,
        timestamp: timestamp || null,
        dataType: Array.isArray(data) ? 'array' : typeof data,
        dataKeys:
          data && typeof data === 'object' && !Array.isArray(data)
            ? Object.keys(data)
            : []
      })
    );

    switch (event) {
      case 'webhook.test':
        return json({
          ok: true,
          received: true,
          verified: true,
          event,
          timestamp: receivedAt
        });

      default:
        // Los futuros eventos se reconocen y validan, pero hasta que
        // implementemos cada handler no modifican datos.
        return json({
          ok: true,
          received: true,
          verified: true,
          event,
          handled: false,
          timestamp: receivedAt
        });
    }
  } catch (error) {
    console.error('[PURO WEBHOOK] Error interno:', error);

    return json(
      {
        ok: false,
        error: 'webhook_processing_error'
      },
      500
    );
  }
}
