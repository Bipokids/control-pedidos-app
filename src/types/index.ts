export interface Remito {
  id: string;
  cliente: string;
  numeroRemito: string | number;
  fechaEmision: string;
  produccion: boolean;
  prioridad: boolean;
  rangoDespacho: string;
  estado: string; 
  estadoPreparacion: string;
  
  // Opcionales
  transporteRemitoFoto?: string;
  aclaraciones?: string;
  esTransporte?: boolean;
  timestamp?: string;
  fechaEntrega?: string; // <-- Agregado para historial
  
  articulos?: {
    codigo: string;
    cantidad: number;
    detalle?: string;
  }[];

  clienteFirma?: {
    firma: string;
    nombre: string;
    dni: string;
  };
}

export interface Soporte {
  id: string;
  cliente: string;
  numeroSoporte: string | number;
  fechaSoporte: string;
  estado: string;
  
  productos: string[] | string; 
  
  descripcion?: string;
  rangoEntrega?: string;
  timestamp?: string;
  fechaEntrega?: string; // <-- ESTO SOLUCIONA TU ERROR 2339
  
  clienteFirma?: {
    firma: string;
    nombre: string;
    dni: string;
  };
}