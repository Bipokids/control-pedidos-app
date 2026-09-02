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

type ResultadoSync = {
  consultados: number;
  creados: number;
  omitidos: number;
};

const INTERVALO_SYNC_MS = 60_000;

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const supabasePublishableKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '');

const idsVerificadosEnSesion = new Set<string>();
let numerosExistentesEnFirebase: Set<string> | null = null;

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

const convertirRemitoFacturacionALegacy = (remito: RemitoFacturacion) => {
  const empresa = parseObjeto(remito.empresa);
  const items = parseArray(remito.items);
  const numeroRemito = String(remito.numero || '').trim();
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
    articulos: items.map((item: any) => ({
      codigo: String(item?.codigo || '').trim(),
      cantidad: Number(item?.cantidad || 0),
      // Conservamos el campo legacy "detalle". Si el remito nuevo no lo trae,
      // usamos su descripción para no perder información del artículo.
      detalle: String(item?.detalle || item?.descripcion || '').trim()
    })).filter((item: any) => item.codigo && Number.isFinite(item.cantidad) && item.cantidad > 0),
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

const cargarNumerosExistentes = async (): Promise<Set<string>> => {
  if (numerosExistentesEnFirebase) return numerosExistentesEnFirebase;

  const snapshot = await get(ref(db_realtime, 'remitos'));
  const data = snapshot.val() || {};
  const numeros = new Set<string>();

  Object.values(data).forEach((remito: any) => {
    if (remito?.numeroRemito !== undefined && remito?.numeroRemito !== null) {
      numeros.add(String(remito.numeroRemito).trim());
    }
    if (remito?.remitoFacturacionId) {
      idsVerificadosEnSesion.add(String(remito.remitoFacturacionId));
    }
  });

  numerosExistentesEnFirebase = numeros;
  return numeros;
};

const consultarPendientesFacturacion = async (): Promise<RemitoFacturacion[]> => {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('Faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY en Control de Pedidos.');
  }

  // Se consultan TODOS los pendientes en cada pasada. La deduplicación se hace
  // contra Firebase, por lo que no dependemos de fechas ni de localStorage.
  const params = new URLSearchParams();
  params.set('select', '*');
  params.set('estado', 'eq.Pendiente');
  params.set('order', 'fechaCreacion.asc');
  params.set('limit', '2000');

  const respuesta = await fetch(`${supabaseUrl}/rest/v1/remitos?${params.toString()}`, {
    method: 'GET',
    headers: {
      // Las nuevas claves sb_publishable_* son API keys, no JWT.
      // Para REST se envían en el header apikey.
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

const sincronizarUno = async (remito: RemitoFacturacion): Promise<'creado' | 'omitido'> => {
  if (!remito?.id || idsVerificadosEnSesion.has(String(remito.id))) return 'omitido';

  const legacy = convertirRemitoFacturacionALegacy(remito);
  if (!legacy.numeroRemito) {
    idsVerificadosEnSesion.add(String(remito.id));
    return 'omitido';
  }

  const numeros = await cargarNumerosExistentes();

  // Compatibilidad con remitos que pudieron cargarse manualmente antes de esta integración.
  if (numeros.has(legacy.numeroRemito)) {
    idsVerificadosEnSesion.add(String(remito.id));
    return 'omitido';
  }

  // ID determinístico: dos PCs sincronizando el mismo remito no lo duplican.
  const destino = ref(db_realtime, `remitos/${claveFirebaseDesdeId(remito.id)}`);
  const resultado = await runTransaction(
    destino,
    actual => actual == null ? legacy : undefined,
    { applyLocally: false }
  );

  idsVerificadosEnSesion.add(String(remito.id));
  numeros.add(legacy.numeroRemito);

  return resultado.committed ? 'creado' : 'omitido';
};

export const sincronizarRemitosPendientesFacturacion = async (): Promise<ResultadoSync> => {
  const pendientes = await consultarPendientesFacturacion();
  let creados = 0;
  let omitidos = 0;

  for (const remito of pendientes) {
    const resultado = await sincronizarUno(remito);
    if (resultado === 'creado') creados += 1;
    else omitidos += 1;
  }

  return {
    consultados: pendientes.length,
    creados,
    omitidos
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
      console.log('🟨 Sync Facturación → Control: consultando remitos pendientes...');
      const resultado = await sincronizarRemitosPendientesFacturacion();
      console.log(
        `🔄 Sync Facturación → Control: ${resultado.consultados} consultado(s), ` +
        `${resultado.creados} creado(s), ${resultado.omitidos} omitido(s).`
      );
    } catch (error) {
      console.error('❌ Error sincronizando remitos de Facturación:', error);
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
