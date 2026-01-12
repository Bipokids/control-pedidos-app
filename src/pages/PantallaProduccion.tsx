import React, { useEffect, useState } from 'react';
import { db_realtime } from '../firebase/config';
import { ref, onValue, update } from "firebase/database";
import type { Remito } from '../types';

const PantallaProduccion: React.FC = () => {
    const [remitos, setRemitos] = useState<Record<string, Remito>>({});
    const [filtro, setFiltro] = useState("");

    useEffect(() => {
        const unsubscribe = onValue(ref(db_realtime, 'remitos'), (snapshot) => {
            setRemitos(snapshot.val() || {});
        });
        return () => unsubscribe();
    }, []);

    // --- LÓGICA DE DATOS ---
    const pedidos = Object.entries(remitos)
        .map(([id, r]) => ({ ...r, id }))
        .filter(r => r.produccion && r.estado !== "Entregado")
        .filter(r => {
            const term = filtro.toLowerCase();
            return r.cliente.toLowerCase().includes(term) || r.numeroRemito.toString().includes(term);
        })
        .sort((a, b) => (b.prioridad ? 1 : 0) - (a.prioridad ? 1 : 0));

    // --- ACCIONES ---
    const cambiarEstado = (id: string, nuevoEstado: string) => {
        update(ref(db_realtime, `remitos/${id}`), { estado: nuevoEstado });
    };

    // --- LÓGICA DE COLOR ---
    const getCardStyle = (r: Remito) => {
        if (r.estadoPreparacion === "Despachado") return "bg-cyan-400 text-slate-800";
        if (r.prioridad && r.estado !== "Listo") return "bg-purple-200 border border-purple-500 text-slate-900";
        if (r.estado === "Listo") return "bg-green-500 text-white";
        return "bg-yellow-400 text-slate-900";
    };

    return (
        <div className="max-w-[1800px] mx-auto px-4 pb-20 pt-6 font-sans min-h-screen bg-slate-50">
            
            {/* ENCABEZADO COMPACTO */}
            <header className="mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-baseline gap-3">
                    <h1 className="text-xl font-black text-slate-800 italic uppercase tracking-tighter">
                        Producción <span className="text-yellow-600">Armado</span>
                    </h1>
                    <span className="bg-slate-200 px-2 py-0.5 rounded text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        {pedidos.length} Pendientes
                    </span>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <input 
                        type="text" 
                        placeholder="🔍 BUSCAR..." 
                        value={filtro}
                        onChange={(e) => setFiltro(e.target.value)}
                        className="p-2 bg-white border border-slate-200 rounded-lg font-bold text-xs uppercase outline-none focus:border-yellow-400 flex-1 md:w-64"
                    />
                    {filtro && (
                        <button onClick={() => setFiltro("")} className="bg-red-500 text-white px-3 rounded-lg font-bold uppercase text-[10px]">X</button>
                    )}
                </div>
            </header>

            {/* GRID DE PEDIDOS (3 COLUMNAS AHORA) */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {pedidos.length === 0 ? (
                    <div className="col-span-full py-16 text-center text-slate-400 font-bold italic text-sm opacity-60 border-2 border-dashed border-slate-200 rounded-2xl">
                        NO HAY PEDIDOS PARA ARMAR
                    </div>
                ) : (
                    pedidos.map((r) => (
                        <div 
                            key={r.id} 
                            className={`rounded-xl p-3 shadow-sm transition-all relative overflow-hidden group hover:shadow-md ${getCardStyle(r)}`}
                        >
                            {/* ESTRELLA DE PRIORIDAD (Pequeña) */}
                            {r.prioridad && (
                                <span className="absolute top-2 right-2 text-xl drop-shadow-sm animate-pulse" title="Prioridad">⭐</span>
                            )}

                            {/* BANNER TRANSPORTE (Fino) */}
                            {r.esTransporte && (
                                <div className="bg-yellow-300 text-black text-[9px] font-black uppercase text-center py-0.5 rounded mb-2 tracking-widest border border-yellow-500/20">
                                    🚚 TRANSPORTE
                                </div>
                            )}

                            {/* TÍTULO (Compacto) */}
                            <div className="mb-2 pr-6 leading-tight">
                                <span className="font-black text-lg italic">#{r.numeroRemito}</span>
                                <span className="block text-sm font-bold opacity-90 truncate">{r.cliente}</span>
                            </div>

                            {/* LISTA DE PRODUCTOS (Compacta y Blanca) */}
                            <div className="bg-white/60 p-2 rounded-lg shadow-sm mb-2 backdrop-blur-sm">
                                <ul className="list-none space-y-1">
                                    {r.articulos?.map((art, idx) => (
                                        <li key={idx} className="flex flex-col border-b border-black/5 last:border-0 pb-1 last:pb-0">
                                            <div className="flex items-baseline gap-1 text-sm">
                                                <span className="font-black text-slate-900">{art.cantidad}x</span>
                                                <span className="font-semibold text-slate-800 leading-tight">{art.codigo}</span>
                                            </div>
                                            {art.detalle && (
                                                <span className="text-[10px] font-bold text-blue-700 mt-0.5 pl-1 bg-blue-50/80 rounded inline-block self-start">
                                                    ℹ️ {art.detalle}
                                                </span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* ACLARACIONES (Compactas) */}
                            {r.aclaraciones && (
                                <div className="mb-2 bg-yellow-50/90 border-l-2 border-yellow-600 p-1.5 rounded-r text-slate-800">
                                    <p className="text-[10px] font-bold leading-snug">
                                        <span className="uppercase text-[8px] text-yellow-700 tracking-wider">Nota: </span>
                                        {r.aclaraciones}
                                    </p>
                                </div>
                            )}

                            {/* FOOTER: BOTONES (Pequeños) */}
                            <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-black/10">
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-black/10 rounded text-white/90">
                                    {r.estado?.substring(0, 4) || 'PEND'}
                                </span>
                                
                                <div className="flex gap-1">
                                    <button 
                                        onClick={() => cambiarEstado(r.id, "Pendiente")}
                                        className="px-2 py-1 bg-white/80 text-slate-600 rounded text-[10px] font-bold uppercase hover:bg-white shadow-sm transition-colors border border-black/5"
                                    >
                                        Pend
                                    </button>
                                    <button 
                                        onClick={() => cambiarEstado(r.id, "Listo")}
                                        className="px-3 py-1 bg-slate-900 text-green-400 rounded text-[10px] font-black uppercase hover:bg-black shadow-md transition-transform active:scale-95 border border-green-500/30 flex items-center gap-1"
                                    >
                                        ✅ Listo
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default PantallaProduccion;