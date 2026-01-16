import React, { useEffect, useState } from 'react';
import { db_realtime } from '../firebase/config';
import { ref, onValue, remove } from "firebase/database";

// Definimos una interfaz flexible para manejar ambos tipos de datos
interface DespachoItem {
    id: string;
    tipo: 'remito' | 'soporte';
    fecha: string; // La fecha del grupo (nodo padre)
    cliente: string;
    numero: string;
    
    // Específico Remito
    chofer?: string;
    responsable?: string;
    despacharConFaltante?: boolean;
    productosMap?: Record<string, number>; // Lo que se llevó
    esperadosMap?: Record<string, number>; // Lo que debía llevar
    itemsRechazados?: { codigo: string; cantidadRechazada: number }[]; // Nuevo campo
    estado?: string; // Nuevo campo (ej: Entregado Parcial)
    imagenUrl?: string;

    // Específico Soporte
    fechaSoporte?: string;
    estadoSoporte?: string;
    productosLista?: string[]; // Lista de items/descripción
}

const HistorialDespachos: React.FC = () => {
    const [historial, setHistorial] = useState<Record<string, DespachoItem[]>>({});
    const [fechasExpandidas, setFechasExpandidas] = useState<Set<string>>(new Set());
    const [filtro, setFiltro] = useState("");

    useEffect(() => {
        const unsubscribe = onValue(ref(db_realtime, 'despachos'), (snapshot) => {
            const data = snapshot.val() || {};
            const agrupado: Record<string, DespachoItem[]> = {};

            // Iteramos las fechas (claves principales)
            Object.keys(data).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()).forEach(fechaKey => {
                const itemsEnFecha = data[fechaKey];
                const listaItems: DespachoItem[] = [];

                Object.entries(itemsEnFecha).forEach(([id, item]: [string, any]) => {
                    // DETECTAR TIPO
                    const esRemito = item.numeroRemito !== undefined;
                    
                    if (esRemito) {
                        listaItems.push({
                            id,
                            tipo: 'remito',
                            fecha: fechaKey,
                            cliente: item.cliente || "Sin nombre",
                            numero: item.numeroRemito,
                            chofer: item.chofer,
                            responsable: item.responsable,
                            despacharConFaltante: item.despacharConFaltante,
                            productosMap: item.productos || {},
                            esperadosMap: item.productosEsperados || {},
                            itemsRechazados: item.itemsRechazados || [], // Mapeamos rechazos
                            estado: item.estado, // Mapeamos estado explícito
                            imagenUrl: item.imagenUrl
                        });
                    } else {
                        // Es Soporte
                        // Normalizar productos
                        let prods: string[] = [];
                        if (Array.isArray(item.productos)) prods = item.productos;
                        else if (typeof item.productos === 'string') prods = [item.productos];
                        else if (item.productos) prods = Object.values(item.productos);

                        listaItems.push({
                            id,
                            tipo: 'soporte',
                            fecha: fechaKey,
                            cliente: item.cliente || "Sin nombre",
                            numero: item.numeroSoporte || "S/N",
                            fechaSoporte: item.fechaSoporte,
                            estadoSoporte: item.estado,
                            productosLista: prods
                        });
                    }
                });

                if (listaItems.length > 0) {
                    agrupado[fechaKey] = listaItems;
                }
            });

            setHistorial(agrupado);
            // Expandir la primera fecha por defecto
            if (Object.keys(agrupado).length > 0 && fechasExpandidas.size === 0) {
                setFechasExpandidas(new Set([Object.keys(agrupado)[0]]));
            }
        });

        return () => unsubscribe();
    }, []);

    // --- MANEJO UI ---
    const toggleFecha = (fecha: string) => {
        const nuevas = new Set(fechasExpandidas);
        if (nuevas.has(fecha)) nuevas.delete(fecha);
        else nuevas.add(fecha);
        setFechasExpandidas(nuevas);
    };

    const eliminarItem = (fecha: string, id: string) => {
        if (window.confirm("¿Seguro que deseas eliminar este registro del historial?")) {
            remove(ref(db_realtime, `despachos/${fecha}/${id}`));
        }
    };

    // --- LÓGICA DE ESTADO ---
    const getEstadoRemito = (item: DespachoItem) => {
        // Prioridad 1: Estado explícito que viene de la app del chofer
        if (item.estado === "Entregado Parcial") {
            return { texto: "⚠️ Entrega Parcial", color: "bg-red-100 text-red-700 border-red-200" };
        }
        if (item.estado === "Rechazado") {
            return { texto: "❌ Rechazado Total", color: "bg-red-200 text-red-800 border-red-300" };
        }

        // Prioridad 2: Cálculo manual (Legacy o fallback)
        if (!item.esperadosMap) return { texto: "📦 Despachado", color: "bg-blue-100 text-blue-700" };

        let hayFaltantes = false;
        Object.entries(item.esperadosMap).forEach(([prod, cantEsperada]) => {
            const cantReal = item.productosMap?.[prod] || 0;
            if (cantReal < cantEsperada) hayFaltantes = true;
        });

        if (!hayFaltantes) return { texto: "✅ Entregado Completo", color: "bg-green-100 text-green-700 border-green-200" };
        if (item.despacharConFaltante) return { texto: "⚠️ Con Faltantes (Autorizado)", color: "bg-yellow-100 text-yellow-700 border-yellow-200" };
        
        return { texto: "📦 Despachado", color: "bg-blue-100 text-blue-700 border-blue-200" };
    };

    return (
        <div className="max-w-5xl mx-auto px-4 py-8 font-sans min-h-screen bg-slate-50">
            
            {/* ENCABEZADO UNIFICADO */}
            <header className="mb-12 flex flex-col md:flex-row justify-between items-end gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">
                        Historial <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Despachos</span>
                    </h1>
                    <p className="text-slate-500 font-medium text-sm">Archivo completo de salidas y entregas.</p>
                </div>

                {/* Buscador Moderno Integrado */}
                <div className="w-full md:w-auto relative group">
                    <span className="absolute left-4 top-3.5 text-slate-400">🔍</span>
                    <input 
                        type="text" 
                        placeholder="Buscar cliente, remito..." 
                        value={filtro}
                        onChange={(e) => setFiltro(e.target.value)}
                        className="w-full md:w-80 pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md focus:shadow-lg focus:border-indigo-500 outline-none transition-all font-bold text-sm text-slate-600 placeholder:text-slate-300"
                    />
                </div>
            </header>

            {/* LISTA DE FECHAS */}
            <div className="space-y-6">
                {Object.entries(historial).map(([fecha, items]) => {
                    // Filtrar items dentro de la fecha
                    const itemsFiltrados = items.filter(i => 
                        !filtro || 
                        i.cliente.toLowerCase().includes(filtro.toLowerCase()) || 
                        i.numero.includes(filtro)
                    );

                    if (itemsFiltrados.length === 0 && filtro) return null;

                    const isExpanded = fechasExpandidas.has(fecha);

                    return (
                        <div key={fecha} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            {/* Header Fecha */}
                            <div 
                                onClick={() => toggleFecha(fecha)}
                                className="p-4 bg-slate-50 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-lg font-black text-slate-700 tracking-tight">📅 {fecha}</span>
                                    <span className="text-xs font-bold bg-slate-200 text-slate-500 px-2 py-1 rounded-full">
                                        {itemsFiltrados.length} Registros
                                    </span>
                                </div>
                                <span className={`transform transition-transform text-slate-400 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                            </div>

                            {/* Contenido Fecha */}
                            {isExpanded && (
                                <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 bg-slate-50/50">
                                    {itemsFiltrados.map((item) => (
                                        <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all relative group">
                                            
                                            {/* Botón Eliminar */}
                                            <button 
                                                onClick={() => eliminarItem(fecha, item.id)}
                                                className="absolute top-3 right-3 text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity font-bold"
                                                title="Eliminar registro"
                                            >
                                                🗑️
                                            </button>

                                            {/* ------ TIPO: REMITO ------ */}
                                            {item.tipo === 'remito' ? (
                                                <>
                                                    <div className="flex justify-between items-start mb-2 pr-6">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-black bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded uppercase">Remito</span>
                                                                <span className="text-sm font-black text-slate-800">#{item.numero}</span>
                                                            </div>
                                                            <h3 className="font-bold text-slate-700 uppercase mt-1 truncate max-w-[250px]">{item.cliente}</h3>
                                                        </div>
                                                    </div>

                                                    {/* Estado */}
                                                    <div className={`text-[10px] font-bold px-2 py-1 rounded-md inline-block mb-3 border ${getEstadoRemito(item).color}`}>
                                                        {getEstadoRemito(item).texto}
                                                    </div>

                                                    {/* Info Extra */}
                                                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 mb-3 bg-slate-50 p-2 rounded-lg">
                                                        <p>🚚 <b>Chofer:</b> {item.chofer || '-'}</p>
                                                        <p>📋 <b>Control:</b> {item.responsable || '-'}</p>
                                                    </div>

                                                    {/* Productos Entregados */}
                                                    <div className="text-xs border-t border-slate-100 pt-2">
                                                        <p className="font-bold text-slate-400 uppercase text-[9px] mb-1">Entregado:</p>
                                                        <ul className="grid grid-cols-2 gap-x-2">
                                                            {Object.entries(item.productosMap || {}).map(([prod, cant]) => (
                                                                <li key={prod} className="text-slate-600">
                                                                    <span className="font-bold text-slate-800">{cant}x</span> {prod}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>

                                                    {/* Items Rechazados (SI EXISTEN) */}
                                                    {item.itemsRechazados && item.itemsRechazados.length > 0 && (
                                                        <div className="text-xs mt-3 bg-red-50 p-2 rounded-lg border border-red-100">
                                                            <p className="font-black text-red-400 uppercase text-[9px] mb-1">❌ No Recibido / Rechazado:</p>
                                                            <ul className="space-y-1">
                                                                {item.itemsRechazados.map((rechazo, idx) => (
                                                                    <li key={idx} className="text-red-700 font-bold flex justify-between">
                                                                        <span>{rechazo.codigo}</span>
                                                                        <span>{rechazo.cantidadRechazada} un.</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                /* ------ TIPO: SOPORTE ------ */
                                                <>
                                                    <div className="flex justify-between items-start mb-2 pr-6">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-black bg-orange-100 text-orange-600 px-2 py-0.5 rounded uppercase">Soporte</span>
                                                                <span className="text-sm font-black text-slate-800">#{item.numero}</span>
                                                            </div>
                                                            <h3 className="font-bold text-slate-700 uppercase mt-1 truncate max-w-[250px]">{item.cliente}</h3>
                                                        </div>
                                                    </div>

                                                    <div className="text-[10px] font-bold px-2 py-1 rounded-md inline-block mb-3 bg-orange-50 text-orange-700 border border-orange-100">
                                                        {item.estadoSoporte || "Entregado"}
                                                    </div>

                                                    <div className="text-xs text-slate-500 mb-3">
                                                        📅 Ingreso: {item.fechaSoporte || '-'}
                                                    </div>

                                                    {/* Productos Soporte */}
                                                    <div className="text-xs border-t border-slate-100 pt-2 bg-slate-50 p-2 rounded-lg">
                                                        <p className="font-bold text-slate-400 uppercase text-[9px] mb-1">Trabajo / Detalle:</p>
                                                        <ul className="list-disc list-inside text-slate-600">
                                                            {item.productosLista?.map((p, i) => (
                                                                <li key={i}>{p}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default HistorialDespachos;