// Webhook inicial de Puro ERP para Control de Pedidos.
// Primera etapa: validar conectividad y conocer exactamente el payload/header
// que envía Puro antes de activar sincronizaciones reales.
//
// URL de producción:
// https://control-pedidos-app.vercel.app/api/puro-webhook

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });

export async function GET() {
  return json({
    ok: true,
    service: 'puro-webhook',
    app: 'control-pedidos',
    status: 'ready',
    timestamp: new Date().toISOString()
  });
}

export async function POST(request) {
  const receivedAt = new Date().toISOString();

  try {
    // Leemos el body como texto ORIGINAL.
    // Luego lo usaremos para validar HMAC SHA256 exactamente como lo envía Puro.
    const rawBody = await request.text();

    const signature =
      request.headers.get('x-puro-signature') ||
      request.headers.get('X-Puro-Signature') ||
      '';

    const contentType = request.headers.get('content-type') || '';

    let payload = rawBody;

    if (rawBody) {
      try {
        payload = JSON.parse(rawBody);
      } catch {
        // Si Puro enviara otro formato, conservamos el texto tal cual.
      }
    }

    console.info(
      '[PURO WEBHOOK]',
      JSON.stringify({
        receivedAt,
        contentType,
        signaturePresent: Boolean(signature),
        signature,
        payload
      })
    );

    return json({
      ok: true,
      received: true,
      signaturePresent: Boolean(signature),
      timestamp: receivedAt
    });
  } catch (error) {
    console.error('[PURO WEBHOOK] Error procesando evento:', error);

    return json(
      {
        ok: false,
        error: 'webhook_processing_error',
        timestamp: receivedAt
      },
      500
    );
  }
}
