import { get, ref, runTransaction } from 'firebase/database';
import { db_realtime } from '../firebase/config';

type RemitoFacturacion = {
  id: string;
  numero?: string;
  fechaCreacion?: string;
  estado?: string;
  empresa?: unknown;
  items?: unknown;
  observaciones?: string;
  requiereArmado?: boolean;
  envioPorTransporte?: boolean;
  cantidadBultos?: number;
};


type SoporteFacturacion = {
  id: string;
  numero?: string;
  fechaIngreso?: string;
  cliente?: unknown;
  items?: unknown;
  estado?: string;
  chofer?: string;
  observaciones?: string;
  historialEstados?: unknown;
};

type ResultadoSync = {
  consultados: number;
  creados: number;
  omitidos: number;
  variantesCreadas: number;
  entregasSincronizadas: number;
  entregasOmitidas: number;
  soportesConsultados: number;
  soportesCreados: number;
  soportesVinculados: number;
  soportesOmitidos: number;
  soportesEstadosSincronizados: number;
  soportesEstadosOmitidos: number;
  errores: number;
};

type RegistroRemitoFirebase = {
  key: string;
  data: Record<string, any>;
};

type RegistroSoporteFirebase = {
  key: string;
  data: Record<string, any>;
};

type CombinacionVarianteLegacy = {
  cantidad: number;
  talle?: string;
  color?: string;
  modelo?: string;
};

type ConfiguracionVariantesLegacy = {
  articuloIndex: number;
  codigo: string;
  cantidadArticulo: number;
  combinaciones: CombinacionVarianteLegacy[];
  tipos: {
    talle: boolean;
    color: boolean;
    modelo: boolean;
  };
  actualizadoEn: string;
};

const INTERVALO_SYNC_MS = 60_000;

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const supabasePublishableKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '');

let remitosPorNumero: Map<string, RegistroRemitoFirebase> | null = null;
let soportesPorNumero: Map<string, RegistroSoporteFirebase> | null = null;

const parseObjeto = (valor: unknown): Record<string, any> => {
  if (!valor) return {};
  if (typeof valor === 'object' && !Array.isArray(valor)) return valor as Record<string, any>;
  if (typeof valor === 'string') {
    try {
      const parsed = JSON.parse(valor);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const parseArray = (valor: unknown): any[] => {
  if (Array.isArray(valor)) return valor;
  if (typeof valor === 'string') {
    try {
      const parsed = JSON.parse(valor);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const formatearFecha = (valor?: string): string => {
  const fecha = valor ? new Date(valor) : new Date();
  if (Number.isNaN(fecha.getTime())) return '';

  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const anio = fecha.getFullYear();
  return `${dia}/${mes}/${anio}`;
};

const normalizarTelefono = (valor: unknown): string => String(valor || '').replace(/\D/g, '');

const claveFirebaseDesdeId = (id: string): string =>
  `facturacion_${String(id).replace(/[.#$\[\]/]/g, '_')}`;

const claveFirebaseSoporteDesdeId = (id: string): string =>
  `facturacion_soporte_${String(id).replace(/[.#$\[\]/]/g, '_')}`;

const textoLimpio = (valor: unknown): string => String(valor || '').trim();

const formatearFechaISO = (valor?: string): string => {
  const fecha = valor ? new Date(valor) : new Date();
  if (Number.isNaN(fecha.getTime())) return textoLimpio(valor);
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
};


const normalizarFirmaDataUrl = (valor: unknown): string => {
  const firma = textoLimpio(valor);
  if (!firma) return '';
  if (firma.startsWith('data:image/')) return firma;
  return `data:image/png;base64,${firma}`;
};

const fingerprintConstanciaEntrega = (data: Record<string, any>): string => {
  const firma = parseObjeto(data.clienteFirma);
  const cantidades = parseObjeto(data.cantidadesEntregadas);
  const noRecibidos = parseObjeto(data.noRecibidos);

  return [
    textoLimpio(data.estado),
    textoLimpio(data.fechaEntrega),
    textoLimpio(data.chofer),
    textoLimpio(data.responsable),
    textoLimpio(firma.tipo),
    textoLimpio(firma.nombre),
    textoLimpio(firma.dni),
    textoLimpio(firma.firma).length,
    JSON.stringify(cantidades),
    JSON.stringify(noRecibidos)
  ].join('|');
};

const construirConstanciaEntrega = (
  firebaseKey: string,
  data: Record<string, any>
): Record<string, any> | null => {
  const remitoFacturacionId = textoLimpio(data.remitoFacturacionId);
  if (!remitoFacturacionId) return null;

  const firma = parseObjeto(data.clienteFirma);
  const fechaEntrega = textoLimpio(data.fechaEntrega);
  const estado = textoLimpio(data.estado);
  const tieneRecepcion = Boolean(
    estado.toLowerCase() === 'entregado' ||
    fechaEntrega ||
    firma.firma ||
    firma.nombre ||
    firma.dni ||
    firma.tipo
  );

  if (!tieneRecepcion) return null;

  const firmaDataUrl = normalizarFirmaDataUrl(firma.firma);
  const tipo = textoLimpio(firma.tipo) || (firmaDataUrl ? 'Cliente' : 'Entrega');

  return {
    recibido: true,
    tipo,
    fechaEntrega: fechaEntrega || null,
    nombre: textoLimpio(firma.nombre) || null,
    dni: textoLimpio(firma.dni) || null,
    firma: firmaDataUrl || null,
    chofer: textoLimpio(data.chofer) || null,
    responsable: textoLimpio(data.responsable) || null,
    cantidadesEntregadas: parseObjeto(data.cantidadesEntregadas),
    noRecibidos: parseObjeto(data.noRecibidos),
    remitoControlId: firebaseKey,
    sincronizadoDesdeControlEn: new Date().toISOString()
  };
};

const actualizarConstanciaEnSupabase = async (
  remitoFacturacionId: string,
  constanciaEntrega: Record<string, any>
): Promise<void> => {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('Faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY en Control de Pedidos.');
  }

  const params = new URLSearchParams();
  params.set('id', `eq.${remitoFacturacionId}`);

  const respuesta = await fetch(`${supabaseUrl}/rest/v1/remitos?${params.toString()}`, {
    method: 'PATCH',
    headers: {
      apikey: supabasePublishableKey,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({
      estado: 'Entregado',
      constanciaEntrega
    })
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '');
    throw new Error(`Supabase respondió ${respuesta.status} actualizando constancia: ${detalle || respuesta.statusText}`);
  }
};

const sincronizarConstanciasEntregaHaciaFacturacion = async (): Promise<{
  sincronizadas: number;
  omitidas: number;
  errores: number;
}> => {
  const snapshot = await get(ref(db_realtime, 'remitos'));
  const data = snapshot.val() || {};

  let sincronizadas = 0;
  let omitidas = 0;
  let errores = 0;

  for (const [firebaseKey, valor] of Object.entries(data)) {
    const remitoData = (valor || {}) as Record<string, any>;
    const remitoFacturacionId = textoLimpio(remitoData.remitoFacturacionId);
    if (!remitoFacturacionId || textoLimpio(remitoData.origen) !== 'sistema_facturacion') continue;

    const constancia = construirConstanciaEntrega(firebaseKey, remitoData);
    if (!constancia) continue;

    const fingerprint = fingerprintConstanciaEntrega(remitoData);
    const syncAnterior = parseObjeto(remitoData.constanciaEntregaSyncFacturacion);
    if (textoLimpio(syncAnterior.fingerprint) === fingerprint) {
      omitidas += 1;
      continue;
    }

    try {
      await actualizarConstanciaEnSupabase(remitoFacturacionId, constancia);

      await runTransaction(
        ref(db_realtime, `remitos/${firebaseKey}/constanciaEntregaSyncFacturacion`),
        () => ({
          fingerprint,
          sincronizadoEn: new Date().toISOString(),
          remitoFacturacionId
        }),
        { applyLocally: false }
      );

      sincronizadas += 1;
    } catch (error) {
      errores += 1;
      console.error(
        `❌ Error sincronizando constancia de entrega ${textoLimpio(remitoData.numeroRemito) || firebaseKey} hacia Facturación:`,
        error
      );
    }
  }

  return { sincronizadas, omitidas, errores };
};

const parsearDetalleVarianteTexto = (texto: unknown): any[] => {
  const origen = textoLimpio(texto);
  if (!origen) return [];

  return origen
    .split(/\s*\|\s*|\s*\n\s*/)
    .map(parte => parte.replace(/^↳\s*/, '').trim())
    .filter(Boolean)
    .map(parte => {
      const matchCantidad = parte.match(/^(\d+(?:[.,]\d+)?)\s*x\s*(.*)$/i);
      if (!matchCantidad) return null;

      const cantidad = Number(matchCantidad[1].replace(',', '.'));
      const detalle = matchCantidad[2].trim();
      if (!Number.isInteger(cantidad) || cantidad <= 0 || !detalle) return null;

      const leerCampo = (nombres: string[]): string => {
        const patron = nombres.join('|');
        const regex = new RegExp(
          `(?:^|[·;,]\\s*)(${patron})\\s*:\\s*([^·;,|]+)`,
          'i'
        );
        return textoLimpio(detalle.match(regex)?.[2]);
      };

      const talle = leerCampo(['Talle']);
      const color = leerCampo(['Color']);
      const modelo = leerCampo(['Diseño', 'Diseno', 'Modelo']);

      if (!talle && !color && !modelo) return null;
      return { cantidad, talle, color, modelo };
    })
    .filter(Boolean);
};

const completarVarianteDesdeTexto = (variante: any): any => {
  const talleActual = textoLimpio(variante?.talle);
  const colorActual = textoLimpio(variante?.color);
  const modeloActual = textoLimpio(
    variante?.modelo ?? variante?.diseno ?? variante?.diseño
  );

  if (talleActual || colorActual || modeloActual) return variante;

  const desdeTexto = parsearDetalleVarianteTexto(
    `${Number(variante?.cantidad || 0)} x ${textoLimpio(variante?.texto)}`
  )[0];

  return desdeTexto ? { ...variante, ...desdeTexto } : variante;
};

const obtenerVariantesItem = (item: any): any[] => {
  const fuentesMultiples = [
    item?.variantesDetalle,
    item?.detalleVariantes,
    item?.variantesSeleccionadas
  ];

  for (const fuente of fuentesMultiples) {
    const multiples = parseArray(fuente).map(completarVarianteDesdeTexto);
    if (multiples.length > 0) return multiples;
  }

  // Compatibilidad con comprobantes generados con la versión anterior,
  // que guardaban una única variante en item.variante.
  const varianteUnica = parseObjeto(item?.variante);
  if (
    varianteUnica &&
    Object.keys(varianteUnica).length > 0 &&
    Number(item?.cantidad || 0) > 0
  ) {
    return [completarVarianteDesdeTexto({
      ...varianteUnica,
      cantidad: Number(item.cantidad)
    })];
  }

  // Fallback para remitos que ya contienen el detalle impreso pero por alguna
  // versión intermedia no conservaron el array estructurado. Ejemplo:
  // "1 x Color: NEGRO" o "2 x Talle: S | 3 x Talle: M".
  const desdeTexto = parsearDetalleVarianteTexto(
    item?.detalleVariantesTexto || item?.varianteTexto
  );
  if (desdeTexto.length > 0) return desdeTexto;

  return [];
};

const convertirVariantesItemAEstructuraControl = (
  item: any,
  articuloIndex: number
): ConfiguracionVariantesLegacy | null => {
  const variantesOrigen = obtenerVariantesItem(item);
  if (variantesOrigen.length === 0) return null;

  const combinaciones: CombinacionVarianteLegacy[] = variantesOrigen
    .map((variante: any) => {
      const cantidad = Number(variante?.cantidad || 0);
      let talle = textoLimpio(variante?.talle);
      let color = textoLimpio(variante?.color);
      // En Facturación lo llamamos "Diseño". El Control de Pedidos históricamente
      // lo guarda como "modelo", por lo que se traduce a ese nombre.
      let modelo = textoLimpio(
        variante?.modelo ?? variante?.diseno ?? variante?.diseño
      );

      if (!talle && !color && !modelo && variante?.texto) {
        const desdeTexto = parsearDetalleVarianteTexto(
          `${cantidad} x ${textoLimpio(variante.texto)}`
        )[0];
        talle = textoLimpio(desdeTexto?.talle);
        color = textoLimpio(desdeTexto?.color);
        modelo = textoLimpio(desdeTexto?.modelo);
      }

      const resultado: CombinacionVarianteLegacy = { cantidad };
      if (talle) resultado.talle = talle;
      if (color) resultado.color = color;
      if (modelo) resultado.modelo = modelo;
      return resultado;
    })
    .filter(combinacion =>
      Number.isInteger(combinacion.cantidad) &&
      combinacion.cantidad > 0 &&
      Boolean(combinacion.talle || combinacion.color || combinacion.modelo)
    );

  if (combinaciones.length === 0) return null;

  const cantidadArticulo = Number(item?.cantidad || 0);
  const totalVariantes = combinaciones.reduce(
    (total, combinacion) => total + combinacion.cantidad,
    0
  );

  // ControlDeRemitos exige que la suma de combinaciones coincida exactamente
  // con la cantidad total del artículo. No escribimos una estructura inválida.
  if (totalVariantes !== cantidadArticulo) {
    throw new Error(
      `Las variantes de ${textoLimpio(item?.codigo) || 'un artículo'} suman ` +
      `${totalVariantes}, pero el artículo tiene cantidad ${cantidadArticulo}.`
    );
  }

  return {
    articuloIndex,
    codigo: textoLimpio(item?.codigo),
    cantidadArticulo,
    combinaciones,
    tipos: {
      talle: combinaciones.some(combinacion => Boolean(combinacion.talle)),
      color: combinaciones.some(combinacion => Boolean(combinacion.color)),
      modelo: combinaciones.some(combinacion => Boolean(combinacion.modelo))
    },
    actualizadoEn: new Date().toISOString()
  };
};

const convertirVariantesRemito = (
  remito: RemitoFacturacion
): Record<string, ConfiguracionVariantesLegacy> => {
  const items = parseArray(remito.items);
  const resultado: Record<string, ConfiguracionVariantesLegacy> = {};

  items.forEach((item: any, articuloIndex: number) => {
    try {
      const configuracion = convertirVariantesItemAEstructuraControl(item, articuloIndex);
      if (configuracion) {
        resultado[`item_${articuloIndex}`] = configuracion;
      }
    } catch (error) {
      // Una variante defectuosa no debe impedir que el resto de los artículos
      // ni los remitos siguientes se sincronicen.
      console.warn(
        `⚠️ No se pudo convertir variantes del remito ${textoLimpio(remito.numero)} ` +
        `item_${articuloIndex} (${textoLimpio(item?.codigo)}):`,
        error
      );
    }
  });

  return resultado;
};

const convertirRemitoFacturacionALegacy = (remito: RemitoFacturacion) => {
  const empresa = parseObjeto(remito.empresa);
  const items = parseArray(remito.items);
  const numeroRemito = textoLimpio(remito.numero);
  const observaciones = String(remito.observaciones || '');

  const esTransporte = Boolean(
    remito.envioPorTransporte ||
    observaciones.includes('[ENVÍO POR TRANSPORTE]') ||
    empresa.transporteNombre
  );

  const produccion = Boolean(
    remito.requiereArmado ||
    observaciones.includes('[REQUIERE ARMADO EN DEPÓSITO]')
  );

  return {
    numeroRemito,
    fechaEmision: formatearFecha(remito.fechaCreacion),
    cliente: String(empresa.razonSocial || 'Sin nombre'),
    telefono: normalizarTelefono(empresa.telefonoCelular || empresa.telefonoFijo || ''),

    // La estructura histórica de /remitos conserva UN artículo por producto.
    // Las variantes NO se incrustan aquí: se guardan por separado en
    // /variantesRemitos/{remitoId}/item_N.
    articulos: items.map((item: any) => ({
      codigo: textoLimpio(item?.codigo),
      cantidad: Number(item?.cantidad || 0),
      detalle: textoLimpio(item?.detalle || item?.descripcion || '')
    })).filter((item: any) =>
      item.codigo && Number.isFinite(item.cantidad) && item.cantidad > 0
    ),

    aclaraciones: observaciones,
    produccion,
    prioridad: false,
    esTransporte,
    estado: null,
    estadoPreparacion: 'Pendiente',
    rangoDespacho: '',
    notificado: false,
    timestamp: remito.fechaCreacion || new Date().toISOString(),

    // Metadatos de trazabilidad. El sistema histórico ignora estos campos.
    origen: 'sistema_facturacion',
    remitoFacturacionId: remito.id,
    sincronizadoAutomaticamente: true,
    cantidadBultos: Number(remito.cantidadBultos || 1)
  };
};

const cargarIndiceRemitos = async (): Promise<Map<string, RegistroRemitoFirebase>> => {
  const snapshot = await get(ref(db_realtime, 'remitos'));
  const data = snapshot.val() || {};
  const indice = new Map<string, RegistroRemitoFirebase>();

  Object.entries(data).forEach(([key, remito]) => {
    const remitoData = (remito || {}) as Record<string, any>;
    const numero = textoLimpio(remitoData.numeroRemito);
    if (numero) indice.set(numero, { key, data: remitoData });
  });

  remitosPorNumero = indice;
  return indice;
};

const consultarPendientesFacturacion = async (): Promise<RemitoFacturacion[]> => {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('Faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY en Control de Pedidos.');
  }

  const params = new URLSearchParams();
  params.set('select', '*');
  params.set('estado', 'eq.Pendiente');
  params.set('order', 'fechaCreacion.asc');
  params.set('limit', '2000');

  const respuesta = await fetch(`${supabaseUrl}/rest/v1/remitos?${params.toString()}`, {
    method: 'GET',
    headers: {
      apikey: supabasePublishableKey,
      Accept: 'application/json'
    },
    cache: 'no-store'
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '');
    throw new Error(`Supabase respondió ${respuesta.status}: ${detalle || respuesta.statusText}`);
  }

  const data = await respuesta.json();
  return Array.isArray(data) ? data as RemitoFacturacion[] : [];
};

const sincronizarVariantesRemito = async (
  remitoFirebaseKey: string,
  remito: RemitoFacturacion
): Promise<number> => {
  const configuraciones = convertirVariantesRemito(remito);
  let creadas = 0;

  for (const [itemKey, configuracion] of Object.entries(configuraciones)) {
    const destino = ref(
      db_realtime,
      `variantesRemitos/${remitoFirebaseKey}/${itemKey}`
    );

    // Crear sólo si todavía no existe. De esta manera una configuración que
    // haya sido revisada/editada posteriormente en Control de Pedidos no se
    // pisa cada 60 segundos por la sincronización automática.
    const resultado = await runTransaction(
      destino,
      actual => actual == null ? configuracion : undefined,
      { applyLocally: false }
    );

    if (resultado.committed) creadas += 1;
  }

  return creadas;
};

const sincronizarUno = async (
  remito: RemitoFacturacion
): Promise<{ creado: boolean; variantesCreadas: number }> => {
  if (!remito?.id) return { creado: false, variantesCreadas: 0 };

  const legacy = convertirRemitoFacturacionALegacy(remito);
  if (!legacy.numeroRemito) return { creado: false, variantesCreadas: 0 };

  const indice = await cargarIndiceRemitos();
  const existente = indice.get(legacy.numeroRemito);
  const remitoFirebaseKey = existente?.key || claveFirebaseDesdeId(remito.id);

  let creado = false;

  if (!existente) {
    const destino = ref(db_realtime, `remitos/${remitoFirebaseKey}`);
    const resultado = await runTransaction(
      destino,
      actual => actual == null ? legacy : undefined,
      { applyLocally: false }
    );

    creado = resultado.committed;

    // Aunque otra PC haya ganado la transacción, el ID determinístico es el
    // mismo y podemos asociar las variantes al remito correcto.
    indice.set(legacy.numeroRemito, {
      key: remitoFirebaseKey,
      data: legacy
    });
  }

  // Esto también se ejecuta para remitos que ya habían sido sincronizados con
  // una versión anterior. Así se pueden completar automáticamente sus nodos
  // /variantesRemitos sin duplicar el remito ni tocar su estado logístico.
  const variantesCreadas = await sincronizarVariantesRemito(
    remitoFirebaseKey,
    remito
  );

  return { creado, variantesCreadas };
};


// -----------------------------------------------------------------------------
// SOPORTES: ERP / Supabase -> estructura histórica de Firebase
// -----------------------------------------------------------------------------

const mapearEstadoSoporteALegacy = (estado: unknown): string => {
  const normalizado = textoLimpio(estado).toLowerCase();

  if (normalizado === 'entregado') return 'Entregado';
  if (normalizado === 'reparado / listo' || normalizado === 'resuelto') return 'Resuelto';

  // La Gestión de Soportes histórica sólo distingue Pendiente / Resuelto / Entregado.
  // Los estados internos del ERP (revisión, espera de repuestos, nota de crédito, etc.)
  // siguen apareciendo como Pendiente hasta que el equipo esté listo.
  return 'Pendiente';
};

const convertirItemSoporteAProductoLegacy = (item: any): string => {
  const codigo = textoLimpio(item?.codigo);
  const descripcion = textoLimpio(item?.descripcion);
  const color = textoLimpio(item?.color);
  const falla = textoLimpio(item?.falla);

  const identificacion = codigo || descripcion || 'EQUIPO';
  const colorUtil = color && color.toLowerCase() !== 'no especificado' ? color : '';
  const izquierda = [identificacion, colorUtil].filter(Boolean).join(' ');

  return falla ? `${izquierda} - ${falla}` : izquierda;
};

const convertirSoporteFacturacionALegacy = (soporte: SoporteFacturacion) => {
  const cliente = parseObjeto(soporte.cliente);
  const items = parseArray(soporte.items);
  const productos = items
    .map(convertirItemSoporteAProductoLegacy)
    .map(textoLimpio)
    .filter(Boolean);

  const observaciones = textoLimpio(soporte.observaciones);

  return {
    cliente: textoLimpio(cliente.razonSocial) || 'Sin nombre',
    estado: mapearEstadoSoporteALegacy(soporte.estado),
    fechaSoporte: formatearFechaISO(soporte.fechaIngreso),
    numeroSoporte: textoLimpio(soporte.numero),
    productos,
    rangoEntrega: '',
    telefono: normalizarTelefono(cliente.telefono || cliente.telefonoCelular || cliente.telefonoFijo || ''),
    notificado: false,
    timestamp: soporte.fechaIngreso || new Date().toISOString(),
    chofer: textoLimpio(soporte.chofer),
    observaciones,
    aclaraciones: observaciones,

    // Trazabilidad. La Gestión histórica ignora estos campos.
    origen: 'sistema_facturacion',
    soporteFacturacionId: soporte.id,
    sincronizadoAutomaticamente: true,
    estadoFacturacion: textoLimpio(soporte.estado),
    itemsFacturacion: items
  };
};

const cargarIndiceSoportes = async (): Promise<Map<string, RegistroSoporteFirebase>> => {
  const snapshot = await get(ref(db_realtime, 'soportes'));
  const data = snapshot.val() || {};
  const indice = new Map<string, RegistroSoporteFirebase>();

  Object.entries(data).forEach(([key, soporte]) => {
    const soporteData = (soporte || {}) as Record<string, any>;
    const numero = textoLimpio(soporteData.numeroSoporte);
    if (numero) indice.set(numero, { key, data: soporteData });
  });

  soportesPorNumero = indice;
  return indice;
};

const consultarSoportesFacturacion = async (): Promise<SoporteFacturacion[]> => {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('Faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY en Control de Pedidos.');
  }

  const params = new URLSearchParams();
  params.set('select', '*');
  params.set('order', 'fechaIngreso.asc');
  params.set('limit', '2000');

  const respuesta = await fetch(`${supabaseUrl}/rest/v1/soporte?${params.toString()}`, {
    method: 'GET',
    headers: {
      apikey: supabasePublishableKey,
      Accept: 'application/json'
    },
    cache: 'no-store'
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '');
    throw new Error(`Supabase respondió ${respuesta.status} consultando soportes: ${detalle || respuesta.statusText}`);
  }

  const data = await respuesta.json();
  return Array.isArray(data) ? data as SoporteFacturacion[] : [];
};

const resolverEstadoSoporteFirebase = (estadoActual: unknown, estadoERP: unknown): string => {
  const actual = textoLimpio(estadoActual).toLowerCase();
  const nuevo = textoLimpio(estadoERP).toLowerCase();

  // No retrocedemos un soporte que ya fue entregado desde la Gestión de Despachos.
  if (actual === 'entregado' || nuevo === 'entregado') return 'Entregado';

  // Tampoco retrocedemos un soporte que ya fue marcado como resuelto/listo.
  if (actual === 'resuelto' || nuevo === 'resuelto') return 'Resuelto';

  return 'Pendiente';
};

const sincronizarUnSoporte = async (
  soporte: SoporteFacturacion
): Promise<{ creado: boolean; vinculado: boolean; omitido: boolean }> => {
  if (!soporte?.id) return { creado: false, vinculado: false, omitido: true };

  const legacy = convertirSoporteFacturacionALegacy(soporte);
  if (!legacy.numeroSoporte || legacy.productos.length === 0) {
    return { creado: false, vinculado: false, omitido: true };
  }

  const indice = soportesPorNumero || await cargarIndiceSoportes();
  const existente = indice.get(legacy.numeroSoporte);
  const firebaseKey = existente?.key || claveFirebaseSoporteDesdeId(soporte.id);

  // Si ya existe un número vinculado a OTRO soporte del ERP, no lo tocamos.
  if (
    existente &&
    textoLimpio(existente.data.soporteFacturacionId) &&
    textoLimpio(existente.data.soporteFacturacionId) !== soporte.id
  ) {
    console.warn(
      `⚠️ Soporte #${legacy.numeroSoporte}: el número ya está vinculado a otro registro de Facturación.`
    );
    return { creado: false, vinculado: false, omitido: true };
  }

  const destino = ref(db_realtime, `soportes/${firebaseKey}`);
  const resultado = await runTransaction(
    destino,
    actual => {
      if (actual == null) return legacy;

      const actualObj = (actual || {}) as Record<string, any>;
      const estadoFinal = resolverEstadoSoporteFirebase(actualObj.estado, legacy.estado);

      // Actualizamos datos descriptivos provenientes del ERP, pero preservamos
      // toda la información operativa que pertenece a Gestión de Soportes:
      // rangoEntrega, notificado, firma, entrega, responsable, etc.
      return {
        ...actualObj,
        cliente: legacy.cliente,
        fechaSoporte: legacy.fechaSoporte,
        numeroSoporte: legacy.numeroSoporte,
        productos: legacy.productos,
        telefono: legacy.telefono,
        observaciones: legacy.observaciones,
        aclaraciones: legacy.aclaraciones,
        timestamp: legacy.timestamp,
        origen: legacy.origen,
        soporteFacturacionId: legacy.soporteFacturacionId,
        sincronizadoAutomaticamente: true,
        estadoFacturacion: legacy.estadoFacturacion,
        itemsFacturacion: legacy.itemsFacturacion,
        estado: estadoFinal,
        rangoEntrega: actualObj.rangoEntrega ?? legacy.rangoEntrega,
        notificado: actualObj.notificado ?? legacy.notificado,
        chofer: textoLimpio(actualObj.chofer) || legacy.chofer
      };
    },
    { applyLocally: false }
  );

  const creado = !existente && resultado.committed;
  const vinculado = Boolean(existente && resultado.committed && !textoLimpio(existente.data.soporteFacturacionId));

  indice.set(legacy.numeroSoporte, {
    key: firebaseKey,
    data: (resultado.snapshot.val() || legacy) as Record<string, any>
  });

  return { creado, vinculado, omitido: !resultado.committed };
};

const sincronizarSoportesFacturacion = async (): Promise<{
  consultados: number;
  creados: number;
  vinculados: number;
  omitidos: number;
  errores: number;
}> => {
  const soportes = await consultarSoportesFacturacion();
  soportesPorNumero = null;
  await cargarIndiceSoportes();

  let creados = 0;
  let vinculados = 0;
  let omitidos = 0;
  let errores = 0;

  for (const soporte of soportes) {
    try {
      const resultado = await sincronizarUnSoporte(soporte);
      if (resultado.creado) creados += 1;
      else if (resultado.vinculado) vinculados += 1;
      else omitidos += 1;
    } catch (error) {
      errores += 1;
      console.error(
        `❌ Error sincronizando soporte ${textoLimpio(soporte.numero) || soporte.id}:`,
        error
      );
    }
  }

  return {
    consultados: soportes.length,
    creados,
    vinculados,
    omitidos,
    errores
  };
};


const mapearEstadoLegacyASoporteERP = (estado: unknown): string | null => {
  const normalizado = textoLimpio(estado).toLowerCase();
  if (normalizado === 'entregado') return 'Entregado';
  if (normalizado === 'resuelto') return 'Reparado / Listo';

  // Mientras el Control lo considere Pendiente no reducimos los estados
  // detallados del ERP (En revisión, Espera de repuestos, Para NC, etc.).
  return null;
};

const fingerprintEstadoSoporteControl = (data: Record<string, any>): string => [
  textoLimpio(data.estado),
  textoLimpio(data.chofer),
  textoLimpio(data.rangoEntrega)
].join('|');

const actualizarEstadoSoporteEnSupabase = async (
  soporteFacturacionId: string,
  cambios: Record<string, any>
): Promise<void> => {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('Faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY en Control de Pedidos.');
  }

  const params = new URLSearchParams();
  params.set('id', `eq.${soporteFacturacionId}`);

  const respuesta = await fetch(`${supabaseUrl}/rest/v1/soporte?${params.toString()}`, {
    method: 'PATCH',
    headers: {
      apikey: supabasePublishableKey,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(cambios)
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '');
    throw new Error(`Supabase respondió ${respuesta.status} actualizando soporte: ${detalle || respuesta.statusText}`);
  }
};

const sincronizarEstadosSoportesHaciaFacturacion = async (): Promise<{
  sincronizados: number;
  omitidos: number;
  errores: number;
}> => {
  const snapshot = await get(ref(db_realtime, 'soportes'));
  const data = snapshot.val() || {};

  let sincronizados = 0;
  let omitidos = 0;
  let errores = 0;

  for (const [firebaseKey, valor] of Object.entries(data)) {
    const soporteData = (valor || {}) as Record<string, any>;
    const soporteFacturacionId = textoLimpio(soporteData.soporteFacturacionId);

    if (!soporteFacturacionId || textoLimpio(soporteData.origen) !== 'sistema_facturacion') continue;

    const estadoERP = mapearEstadoLegacyASoporteERP(soporteData.estado);
    const chofer = textoLimpio(soporteData.chofer);

    // Solo hay algo que devolver si Control avanzó a Resuelto/Entregado o
    // asignó un chofer. No enviamos Pendiente para no perder el estado detallado del ERP.
    if (!estadoERP && !chofer) continue;

    const fingerprint = fingerprintEstadoSoporteControl(soporteData);
    const syncAnterior = parseObjeto(soporteData.estadoSyncFacturacion);
    if (textoLimpio(syncAnterior.fingerprint) === fingerprint) {
      omitidos += 1;
      continue;
    }

    const cambios: Record<string, any> = {};
    if (estadoERP) cambios.estado = estadoERP;
    if (chofer) cambios.chofer = chofer;

    try {
      await actualizarEstadoSoporteEnSupabase(soporteFacturacionId, cambios);

      await runTransaction(
        ref(db_realtime, `soportes/${firebaseKey}/estadoSyncFacturacion`),
        () => ({
          fingerprint,
          sincronizadoEn: new Date().toISOString(),
          soporteFacturacionId,
          estadoEnviado: estadoERP,
          choferEnviado: chofer || null
        }),
        { applyLocally: false }
      );

      sincronizados += 1;
    } catch (error) {
      errores += 1;
      console.error(
        `❌ Error devolviendo estado del soporte ${textoLimpio(soporteData.numeroSoporte) || firebaseKey} hacia Facturación:`,
        error
      );
    }
  }

  return { sincronizados, omitidos, errores };
};

export const sincronizarRemitosPendientesFacturacion = async (): Promise<ResultadoSync> => {
  const pendientes = await consultarPendientesFacturacion();
  let creados = 0;
  let omitidos = 0;
  let variantesCreadas = 0;
  let errores = 0;

  // Refrescamos el índice en cada pasada. El Control puede editar/agregar datos
  // mientras la app permanece abierta y no queremos depender de un cache viejo.
  remitosPorNumero = null;

  for (const remito of pendientes) {
    try {
      const resultado = await sincronizarUno(remito);
      if (resultado.creado) creados += 1;
      else omitidos += 1;
      variantesCreadas += resultado.variantesCreadas;
    } catch (error) {
      errores += 1;
      console.error(
        `❌ Error sincronizando remito ${textoLimpio(remito.numero) || remito.id}:`,
        error
      );
      // Continuamos con el siguiente remito. Un registro problemático no puede
      // bloquear todos los pedidos pendientes posteriores.
    }
  }

  const entregas = await sincronizarConstanciasEntregaHaciaFacturacion();
  const soportes = await sincronizarSoportesFacturacion();
  const estadosSoportes = await sincronizarEstadosSoportesHaciaFacturacion();

  return {
    consultados: pendientes.length,
    creados,
    omitidos,
    variantesCreadas,
    entregasSincronizadas: entregas.sincronizadas,
    entregasOmitidas: entregas.omitidas,
    soportesConsultados: soportes.consultados,
    soportesCreados: soportes.creados,
    soportesVinculados: soportes.vinculados,
    soportesOmitidos: soportes.omitidos,
    soportesEstadosSincronizados: estadosSoportes.sincronizados,
    soportesEstadosOmitidos: estadosSoportes.omitidos,
    errores: errores + entregas.errores + soportes.errores + estadosSoportes.errores
  };
};

export const iniciarSincronizacionRemitosFacturacion = (
  onError?: (error: unknown) => void
): (() => void) => {
  let activo = true;
  let ejecutando = false;

  const ejecutar = async () => {
    if (!activo || ejecutando || document.visibilityState === 'hidden') return;
    ejecutando = true;

    try {
      const resultado = await sincronizarRemitosPendientesFacturacion();
      console.info(
        `🔄 Sync Facturación ↔ Control: ` +
        `${resultado.consultados} remito(s) consultado(s), ${resultado.creados} creado(s), ${resultado.omitidos} existente(s), ` +
        `${resultado.variantesCreadas} configuración(es) de variantes creada(s), ` +
        `${resultado.soportesConsultados} soporte(s) consultado(s), ${resultado.soportesCreados} creado(s), ` +
        `${resultado.soportesVinculados} vinculado(s), ${resultado.soportesOmitidos} existente(s), ` +
        `${resultado.soportesEstadosSincronizados} estado(s) de soporte devuelto(s) al ERP, ` +
        `${resultado.soportesEstadosOmitidos} estado(s) de soporte ya sincronizado(s), ` +
        `${resultado.entregasSincronizadas} constancia(s) de entrega de remito copiada(s) a Facturación, ` +
        `${resultado.entregasOmitidas} constancia(s) ya sincronizada(s), ` +
        `${resultado.errores} error(es).`
      );
    } catch (error) {
      console.error('❌ Error sincronizando Facturación con Control:', error);
      onError?.(error);
    } finally {
      ejecutando = false;
    }
  };

  void ejecutar();

  const timer = window.setInterval(() => {
    void ejecutar();
  }, INTERVALO_SYNC_MS);

  const alVolverAVisible = () => {
    if (document.visibilityState === 'visible') void ejecutar();
  };
  document.addEventListener('visibilitychange', alVolverAVisible);

  return () => {
    activo = false;
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', alVolverAVisible);
  };
};
