// Diagnóstico V2 de autenticación de Puro ERP.
// Sólo realiza GETs de lectura. No modifica datos.
//
// Env:
// PURO_API_KEY=pk_live_...
// PURO_BASE_URL=https://dev.puroerp.com  (opcional)

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });

const texto = (valor) => String(valor ?? '').trim();

const sanitizar = (valor, profundidad = 0) => {
  if (profundidad > 5) return '[max-depth]';

  if (valor === null || valor === undefined) return valor;

  if (Array.isArray(valor)) {
    return valor.slice(0, 20).map(item => sanitizar(item, profundidad + 1));
  }

  if (typeof valor === 'object') {
    const salida = {};

    for (const [clave, contenido] of Object.entries(valor)) {
      const nombre = clave.toLowerCase();

      // Nunca devolver credenciales, cookies o tokens si aparecieran en errores.
      if (
        nombre.includes('token') ||
        nombre.includes('secret') ||
        nombre.includes('password') ||
        nombre.includes('authorization') ||
        nombre.includes('cookie') ||
        nombre === 'key' ||
        nombre === 'apikey' ||
        nombre === 'api_key'
      ) {
        salida[clave] = '[redacted]';
      } else {
        salida[clave] = sanitizar(contenido, profundidad + 1);
      }
    }

    return salida;
  }

  if (typeof valor === 'string') {
    // Evita que una respuesta inesperada exponga una credencial pk_live_/whsec_.
    return valor
      .replace(/pk_live_[a-zA-Z0-9_-]+/g, 'pk_live_[redacted]')
      .replace(/whsec_[a-zA-Z0-9_-]+/g, 'whsec_[redacted]')
      .slice(0, 2000);
  }

  return valor;
};

const leerRespuesta = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  let body = null;

  try {
    if (contentType.includes('application/json')) {
      body = await response.json();
    } else {
      body = await response.text();
    }
  } catch (error) {
    body = {
      parseError: error?.message || 'response_parse_failed'
    };
  }

  return {
    status: response.status,
    ok: response.ok,
    contentType,
    body: sanitizar(body)
  };
};

const probar = async ({ url, modo, headers }) => {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...headers
      },
      cache: 'no-store',
      redirect: 'manual'
    });

    return {
      modo,
      ...(await leerRespuesta(response))
    };
  } catch (error) {
    return {
      modo,
      status: 0,
      ok: false,
      body: {
        fetchError: error?.message || 'fetch_failed'
      }
    };
  }
};

export async function GET() {
  const apiKey = texto(process.env.PURO_API_KEY);
  const baseUrl = texto(process.env.PURO_BASE_URL) || 'https://dev.puroerp.com';

  if (!apiKey) {
    return json({
      ok: false,
      error: 'PURO_API_KEY_not_configured'
    }, 500);
  }

  const url =
    `${baseUrl.replace(/\/+$/, '')}` +
    '/api/delivery-notes?page=1&limit=1&sort=issueDate%3Adesc';

  // Sólo mostramos el prefijo público/identificable de la clave configurada.
  // Sirve para verificar que Vercel está usando la clave esperada sin exponerla.
  const configuredKeyPrefix = apiKey.slice(0, 16);

  const intentos = [
    {
      modo: 'authorization_bearer',
      headers: { Authorization: `Bearer ${apiKey}` }
    },
    {
      modo: 'x_api_key',
      headers: { 'x-api-key': apiKey }
    },
    {
      modo: 'x_puro_api_key',
      headers: { 'x-puro-api-key': apiKey }
    },
    {
      modo: 'authorization_api_key',
      headers: { Authorization: `ApiKey ${apiKey}` }
    },
    {
      modo: 'authorization_raw',
      headers: { Authorization: apiKey }
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
      return json({
        ok: true,
        configuredKeyPrefix,
        authMode: resultado.modo,
        endpoint: '/api/delivery-notes',
        result: resultado
      });
    }
  }

  return json({
    ok: false,
    configuredKeyPrefix,
    endpoint: '/api/delivery-notes',
    message: 'Ningún esquema probado autenticó contra este endpoint.',
    attempts: resultados
  }, 502);
}
