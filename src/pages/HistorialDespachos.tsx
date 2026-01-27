import React, { useEffect, useState } from 'react';
import { db_realtime } from '../firebase/config';
import { ref, onValue, remove } from "firebase/database";

// Definimos una interfaz flexible para manejar ambos tipos de datos
interface DespachoItem {
    id: string;
    tipo: 'remito' | 'soporte';
    fecha: string; 
    cliente: string;
    numero: string;
    
    // Específico Remito
    chofer?: string;
    responsable?: string;
    despacharConFaltante?: boolean;
    productosMap?: Record<string, number>;
    esperadosMap?: Record<string, number>;
    itemsRechazados?: { codigo: string; cantidadRechazada: number }[];
    estado?: string;
    imagenUrl?: string;

    // Específico Soporte
    fechaSoporte?: string;
    estadoSoporte?: string;
    productosLista?: string[];
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
                            itemsRechazados: item.itemsRechazados || [],
                            estado: item.estado,
                            imagenUrl: item.imagenUrl
                        });
                    } else {
                        // Es Soporte - Normalizar productos
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
            if (Object.keys(agrupado).length > 0 && fechasExpandidas.size === 0) {
                setFechasExpandidas(new Set([Object.keys(agrupado)[0]]));
            }
        });

        return () => unsubscribe();
    }, []);

    const toggleFecha = (fecha: string) => {
        const nuevas = new Set(fechasExpandidas);
        if (nuevas.has(fecha)) nuevas.delete(fecha);
        else nuevas.add(fecha);
        setFechasExpandidas(nuevas);
    };

    const eliminarItem = (fecha: string, id: string) => {
        if (window.confirm("⚠️ PROTOCOLO DE BORRADO: ¿Confirmar eliminación permanente del registro?")) {
            remove(ref(db_realtime, `despachos/${fecha}/${id}`));
        }
    };

    // --- LÓGICA DE ESTADO (COLORES NEON) ---
    const getEstadoRemito = (item: DespachoItem) => {
        // Prioridad 1: Estado explícito
        if (item.estado === "Entregado Parcial") {
            return { texto: "⚠️ PARCIAL", color: "bg-orange-900/30 text-orange-400 border-orange-500/50 shadow-[0_0_10px_orange]" };
        }
        if (item.estado === "Rechazado") {
            return { texto: "❌ RECHAZADO", color: "bg-red-900/30 text-red-400 border-red-500/50 shadow-[0_0_10px_red]" };
        }

        // Prioridad 2: Cálculo manual
        if (!item.esperadosMap) return { texto: "📦 DESPACHADO", color: "bg-cyan-900/30 text-cyan-400 border-cyan-500/50" };

        let hayFaltantes = false;
        Object.entries(item.esperadosMap).forEach(([prod, cantEsperada]) => {
            const cantReal = item.productosMap?.[prod] || 0;
            if (cantReal < cantEsperada) hayFaltantes = true;
        });

        if (!hayFaltantes) return { texto: "✅ COMPLETO", color: "bg-emerald-900/30 text-emerald-400 border-emerald-500/50 shadow-[0_0_10px_#10b981]" };
        if (item.despacharConFaltante) return { texto: "⚠️ FALTANTE AUTH", color: "bg-yellow-900/30 text-yellow-400 border-yellow-500/50" };
        
        return { texto: "📦 DESPACHADO", color: "bg-cyan-900/30 text-cyan-400 border-cyan-500/50" };
    };

    return (
        <div className="min-h-screen relative font-sans text-cyan-50 bg-[#050b14] selection:bg-cyan-500 selection:text-black pb-20 pt-10 px-4">
            
            {/* GRID DE FONDO DECORATIVO */}
            <div className="fixed inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #1e293b 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

            <div className="max-w-[1400px] mx-auto relative z-10">
                
                {/* ENCABEZADO */}
                <header className="mb-12 flex flex-col md:flex-row justify-between items-end gap-6 border-b border-cyan-900/50 pb-6">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tighter mb-2 uppercase drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                            HISTORIAL <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">DESPACHOS</span>
                        </h1>
                        <p className="text-cyan-600 font-mono text-xs uppercase tracking-[0.3em]">Registro Histórico de Operaciones</p>
                    </div>

                    {/* Buscador Moderno */}
                    <div className="w-full md:w-auto relative group">
                        <span className="absolute left-4 top-4 text-cyan-700 group-focus-within:text-cyan-400 transition-colors">🔍</span>
                        <input 
                            type="text" 
                            placeholder="BUSCAR ID, CLIENTE..." 
                            value={filtro}
                            onChange={(e) => setFiltro(e.target.value)}
                            className="w-full md:w-80 pl-12 pr-4 py-4 bg-[#0f172a] border border-cyan-900 rounded-xl shadow-inner focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] outline-none font-mono text-sm text-cyan-100 placeholder-slate-700 transition-all uppercase tracking-wider"
                        />
                    </div>
                </header>

                {/* LISTA DE FECHAS */}
                <div className="space-y-8">
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
                            <div key={fecha} className="bg-[#0f172a]/60 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-800 overflow-hidden group hover:border-cyan-900 transition-all">
                                {/* Header Fecha */}
                                <div 
                                    onClick={() => toggleFecha(fecha)}
                                    className="p-5 bg-slate-900/80 flex justify-between items-center cursor-pointer hover:bg-slate-800 transition-colors border-b border-slate-800"
                                >
                                    <div className="flex items-center gap-4">
                                        <span className="text-lg font-black text-cyan-50 tracking-tight font-mono">📅 {fecha}</span>
                                        <span className="text-[10px] font-bold font-mono bg-slate-800 text-cyan-400 px-3 py-1 rounded border border-cyan-900/50">
                                            [{itemsFiltrados.length}] REGISTRO
                                        </span>
                                    </div>
                                    <span className={`transform transition-transform text-cyan-600 ${isExpanded ? 'rotate-180 text-cyan-400' : ''}`}>▼</span>
                                </div>

                                {/* Contenido Fecha */}
                                {isExpanded && (
                                    <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-4 bg-[#050b14]/50">
                                        {itemsFiltrados.map((item) => (
                                            <div key={item.id} className="bg-[#0f172a] p-5 rounded-xl border border-slate-800 shadow-sm hover:shadow-[0_0_20px_rgba(6,182,212,0.1)] hover:border-cyan-500/30 transition-all relative group/card">
                                                
                                                {/* Botón Eliminar */}
                                                <button 
                                                    onClick={() => eliminarItem(fecha, item.id)}
                                                    className="absolute top-3 right-3 text-red-900 hover:text-red-500 opacity-0 group-hover/card:opacity-100 transition-opacity font-bold bg-black/50 p-2 rounded-lg"
                                                    title="Purge Record"
                                                >
                                                    🗑️
                                                </button>

                                                {item.tipo === 'remito' ? (
                                                    /* ------ TIPO: REMITO ------ */
                                                    <>
                                                        <div className="flex justify-between items-start mb-4 pr-10">
                                                            <div>
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="text-[9px] font-black bg-cyan-900/40 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded uppercase font-mono tracking-widest">R-LOG</span>
                                                                    <span className="text-sm font-black text-white font-mono tracking-wide">#{item.numero}</span>
                                                                </div>
                                                                <h3 className="font-bold text-slate-300 uppercase tracking-wide truncate max-w-[250px]">{item.cliente}</h3>
                                                            </div>
                                                        </div>

                                                        {/* Estado */}
                                                        <div className={`text-[9px] font-bold font-mono px-3 py-1 rounded border inline-block mb-4 uppercase tracking-widest ${getEstadoRemito(item).color}`}>
                                                            {getEstadoRemito(item).texto}
                                                        </div>

                                                        {/* Info Extra */}
                                                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 mb-4 bg-slate-900/50 p-3 rounded-lg border border-slate-800 font-mono">
                                                            <p><span className="text-cyan-600">CHOFER:</span> {item.chofer || 'N/A'}</p>
                                                            <p><span className="text-cyan-600">CTRL:</span> {item.responsable || 'N/A'}</p>
                                                        </div>

                                                        {/* Productos Entregados */}
                                                        <div className="text-xs border-t border-slate-800 pt-3">
                                                            <p className="font-black text-slate-500 uppercase text-[9px] mb-2 tracking-widest">Detalles de envío:</p>
                                                            <ul className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono">
                                                                {Object.entries(item.productosMap || {}).map(([prod, cant]) => (
                                                                    <li key={prod} className="text-slate-400">
                                                                        <span className="font-bold text-cyan-400">{cant}</span> <span className="text-[10px]">{prod}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>

                                                        {/* Items Rechazados */}
                                                        {item.itemsRechazados && item.itemsRechazados.length > 0 && (
                                                            <div className="text-xs mt-4 bg-red-900/10 p-3 rounded-lg border border-red-900/50">
                                                                <p className="font-black text-red-500 uppercase text-[9px] mb-2 tracking-widest flex items-center gap-2"><span>⚠️</span> Rechazos / Faltantes</p>
                                                                <ul className="space-y-1 font-mono">
                                                                    {item.itemsRechazados.map((rechazo, idx) => (
                                                                        <li key={idx} className="text-red-400 font-bold flex justify-between">
                                                                            <span>{rechazo.codigo}</span>
                                                                            <span>-{rechazo.cantidadRechazada}</span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    /* ------ TIPO: SOPORTE ------ */
                                                    <>
                                                        <div className="flex justify-between items-start mb-4 pr-10">
                                                            <div>
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="text-[9px] font-black bg-violet-900/40 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded uppercase font-mono tracking-widest">S-TEC</span>
                                                                    <span className="text-sm font-black text-white font-mono tracking-wide">#{item.numero}</span>
                                                                </div>
                                                                <h3 className="font-bold text-slate-300 uppercase tracking-wide truncate max-w-[250px]">{item.cliente}</h3>
                                                            </div>
                                                        </div>

                                                        <div className="text-[9px] font-bold font-mono px-3 py-1 rounded border inline-block mb-4 uppercase tracking-widest bg-violet-900/20 text-violet-300 border-violet-500/40 shadow-[0_0_10px_rgba(139,92,246,0.2)]">
                                                            {item.estadoSoporte || "ENTREGADO"}
                                                        </div>

                                                        <div className="text-xs text-slate-500 mb-4 font-mono">
                                                            📅 INGRESO: <span className="text-slate-300">{item.fechaSoporte || '-'}</span>
                                                        </div>

                                                        {/* Productos Soporte */}
                                                        <div className="text-xs border-t border-slate-800 pt-3 bg-slate-900/30 p-3 rounded-lg">
                                                            <p className="font-black text-slate-500 uppercase text-[9px] mb-2 tracking-widest">Detalle Servicio:</p>
                                                            <ul className="space-y-1 font-mono text-slate-400">
                                                                {item.productosLista?.map((p, i) => (
                                                                    <li key={i} className="flex gap-2">
                                                                        <span className="text-violet-500">›</span> {p}
                                                                    </li>
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
        </div>
    );
};

export default HistorialDespachos;