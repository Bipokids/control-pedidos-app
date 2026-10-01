// Diagnóstico temporal de autenticación API Puro ERP.
// No modifica datos. Sólo intenta leer /api/delivery-notes.
//
// Variables de entorno:
// PURO_API_KEY=...
// PURO_BASE_URL=https://dev.puroerp.com   (opcional)

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });

const texto = (valor) => String(valor ?? '').trim();

const resumirRespuesta = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  let body = null;

  try {
    if (contentType.includes('application/json')) {
      body = await response.json();
    } else {
      body = await response.text();
    }
  } catch {
    body = null;
  }

  const resumen = {
    status: response.status,
    ok: response.ok,
    contentType
  };

  if (body && typeof body === 'object' && !Array.isArray(body)) {
    resumen.responseKeys = Object.keys(body);

    if (Array.isArray(body.data)) {
      resumen.dataCount = body.data.length;
      resumen.firstItemKeys =
        body.data[0] && typeof body.data[0] === 'object'
          ? Object.keys(body.data[0])
          : [];
    }

    if (body.meta && typeof body.meta === 'object') {
      resumen.meta = body.meta;
    }

    if (body.error) resumen.error = String(body.error);
    if (body.message) resumen.message = String(body.message);
  } else if (typeof body === 'string') {
    resumen.bodyPreview = body.slice(0, 180);
  }

  return resumen;
};

const probar = async ({ url, headers, modo }) => {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...headers
      },
      cache: 'no-store'
    });

    return {
      modo,
      ...(await resumirRespuesta(response))
    };
  } catch (error) {
    return {
      modo,
      status: 0,
      ok: false,
      error: error?.message || 'fetch_failed'
    };
  }
};

export async function GET() {
  const apiKey = texto(process.env.PURO_API_KEY);
  const baseUrl =
    texto(process.env.PURO_BASE_URL) || 'https://dev.puroerp.com';

  if (!apiKey) {
    return json(
      {
        ok: false,
        error: 'PURO_API_KEY_not_configured'
      },
      500
    );
  }

  const url =
    `${baseUrl.replace(/\/+$/, '')}` +
    '/api/delivery-notes?page=1&limit=1&sort=issueDate%3Adesc';

  const intentos = [
    {
      modo: 'authorization_bearer',
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    },
    {
      modo: 'x_api_key',
      headers: {
        'x-api-key': apiKey
      }
    },
    {
      modo: 'api_key_header',
      headers: {
        'api-key': apiKey
      }
    },
    {
      modo: 'authorization_raw',
      headers: {
        Authorization: apiKey
      }
    }
  ];

  const resultados = [];

  for (const intento of intentos) {
    const resultado = await probar({
      url,
      modo: intento.modo,
      headers: intento.headers
    });

    resultados.push(resultado);

    if (resultado.ok) {
      console.info(
        '[PURO API TEST]',
        JSON.stringify({
          ok: true,
          authMode: resultado.modo,
          status: resultado.status,
          dataCount: resultado.dataCount ?? null,
          firstItemKeys: resultado.firstItemKeys ?? []
        })
      );

      return json({
        ok: true,
        authMode: resultado.modo,
        endpoint: '/api/delivery-notes',
        result: resultado
      });
    }
  }

  console.warn(
    '[PURO API TEST] Ningún esquema de autenticación probado funcionó.',
    JSON.stringify(
      resultados.map(r => ({
        modo: r.modo,
        status: r.status,
        error: r.error || null,
        message: r.message || null
      }))
    )
  );

  return json(
    {
      ok: false,
      endpoint: '/api/delivery-notes',
      message:
        'La API key no autenticó con los esquemas habituales probados.',
      attempts: resultados
    },
    502
  );
}
