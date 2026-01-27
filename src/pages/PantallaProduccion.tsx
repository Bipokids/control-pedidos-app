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

    // --- LÓGICA DE COLOR (INTENSIFICADA / HIGH CONTRAST) ---
    const getCardStyle = (r: Remito) => {
        // 1. DESPACHADO: Azul Cian Intenso y Sólido
        if (r.estadoPreparacion === "Despachado") {
            return "bg-cyan-950/90 border-2 border-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.4)]";
        }
        
        // 2. PRIORIDAD: Rojo Sangre/Láser muy visible
        if (r.prioridad && r.estado !== "Listo") {
            return "bg-red-950/90 border-2 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.6)] animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]";
        }
        
        // 3. LISTO: Verde Esmeralda Brillante
        if (r.estado === "Listo") {
            return "bg-emerald-950/90 border-2 border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.4)]";
        }
        
        // 4. PENDIENTE (Default): Ámbar/Naranja oscuro pero legible
        return "bg-[#1c1917] border border-orange-500/60 shadow-[0_0_15px_rgba(249,115,22,0.15)] hover:border-orange-400 hover:shadow-[0_0_20px_rgba(249,115,22,0.3)]"; 
    };

    return (
        <div className="min-h-screen relative font-sans text-cyan-50 bg-[#050b14] selection:bg-orange-500 selection:text-black pb-20 pt-10 px-4">
            
            {/* GRID DE FONDO DECORATIVO */}
            <div className="fixed inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #1e293b 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

            <div className="max-w-[1800px] mx-auto relative z-10">
                
                {/* ENCABEZADO UNIFICADO */}
                <header className="mb-10 flex flex-col md:flex-row justify-between items-end gap-6 border-b border-orange-900/50 pb-6">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tighter mb-2 uppercase drop-shadow-[0_0_10px_rgba(249,115,22,0.5)]">
                            PRODUCCIÓN <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">ARMADO</span>
                        </h1>
                        <div className="flex items-center gap-3">
                            <p className="text-orange-500 font-mono text-xs uppercase tracking-[0.3em]">Línea de Producción Activa</p>
                            <span className="bg-orange-900/40 text-orange-300 px-4 py-1 rounded border border-orange-500/50 text-[10px] font-black uppercase tracking-widest font-mono shadow-[0_0_15px_rgba(249,115,22,0.3)]">
                                {pedidos.length} PENDIENTES
                            </span>
                        </div>
                    </div>

                    {/* Buscador Moderno */}
                    <div className="w-full md:w-auto relative group">
                        <span className="absolute left-4 top-4 text-orange-700 group-focus-within:text-orange-400 transition-colors">🔍</span>
                        <input 
                            type="text" 
                            placeholder="BUSCAR" 
                            value={filtro}
                            onChange={(e) => setFiltro(e.target.value)}
                            className="w-full md:w-80 pl-12 pr-10 py-4 bg-[#0f172a] border border-orange-900/60 rounded-xl shadow-inner focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:shadow-[0_0_15px_rgba(249,115,22,0.3)] outline-none font-mono text-sm text-orange-100 placeholder-orange-900 transition-all uppercase tracking-wider"
                        />
                        {filtro && (
                            <button 
                                onClick={() => setFiltro("")} 
                                className="absolute right-4 top-4 text-slate-500 hover:text-red-500 transition-colors font-bold"
                                title="Clear Search"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </header>

                {/* GRID DE PEDIDOS */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {pedidos.length === 0 ? (
                        <div className="col-span-full py-20 text-center text-slate-600 font-mono font-bold italic text-sm border-2 border-dashed border-slate-800 rounded-2xl bg-[#0f172a]/50">
                            :: NO PRODUCTION ORDERS DETECTED ::
                        </div>
                    ) : (
                        pedidos.map((r) => (
                            <div 
                                key={r.id} 
                                className={`rounded-[1.5rem] p-5 shadow-lg transition-all relative overflow-hidden group border backdrop-blur-xl flex flex-col ${getCardStyle(r)}`}
                            >
                                {/* Fondo decorativo sutil */}
                                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>

                                {/* ESTRELLA DE PRIORIDAD */}
                                {r.prioridad && (
                                    <div className="absolute top-0 right-0 p-3 z-20">
                                        <span className="text-2xl drop-shadow-[0_0_10px_white] animate-bounce block">⚠️</span>
                                    </div>
                                )}

                                {/* BANNER TRANSPORTE */}
                                {r.esTransporte && (
                                    <div className="bg-gradient-to-r from-orange-600 to-orange-500 text-white border border-orange-400 text-[10px] font-black uppercase text-center py-1.5 rounded mb-3 tracking-[0.2em] font-mono shadow-md relative z-10">
                                        🚚 TRANSPORTE
                                    </div>
                                )}

                                {/* TÍTULO */}
                                <div className="mb-4 pr-8 relative z-10">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-mono text-slate-300 uppercase tracking-widest opacity-80">Remito</span>
                                        <span className="font-black text-xl italic text-white font-mono drop-shadow-md tracking-wider">#{r.numeroRemito}</span>
                                    </div>
                                    <span className="block text-base font-black uppercase tracking-wide text-white truncate drop-shadow-sm">{r.cliente}</span>
                                </div>

                                {/* LISTA DE PRODUCTOS */}
                                <div className="bg-black/40 p-3 rounded-xl border border-white/10 mb-3 shadow-inner relative z-10 flex-1">
                                    <ul className="list-none space-y-2">
                                        {r.articulos?.map((art, idx) => (
                                            <li key={idx} className="flex flex-col border-b border-white/10 last:border-0 pb-2 last:pb-0">
                                                <div className="flex items-baseline gap-3 text-sm font-mono">
                                                    <span className="font-black text-white bg-white/10 px-2 py-0.5 rounded border border-white/20 min-w-[30px] text-center shadow-sm">{art.cantidad}</span>
                                                    <span className="font-bold text-slate-200 uppercase tracking-tight">{art.codigo}</span>
                                                </div>
                                                {art.detalle && (
                                                    <span className="text-[10px] font-bold text-yellow-300 mt-1 pl-2 border-l-2 border-yellow-500/50 italic font-mono tracking-wide">
                                                        // {art.detalle}
                                                    </span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* ACLARACIONES */}
                                {r.aclaraciones && (
                                    <div className="mb-4 bg-orange-900/30 border-l-4 border-orange-500 p-3 rounded-r text-orange-100 relative z-10">
                                        <p className="text-[11px] font-mono leading-snug">
                                            <span className="uppercase text-[9px] text-orange-400 tracking-wider font-black block mb-1">DETALLES:</span>
                                            {r.aclaraciones}
                                        </p>
                                    </div>
                                )}

                                {/* FOOTER: BOTONES */}
                                <div className="flex items-center justify-between gap-3 mt-auto pt-3 border-t border-white/10 relative z-10">
                                    <span className={`text-[10px] font-black uppercase px-3 py-1.5 rounded border font-mono tracking-wider shadow-sm ${
                                        r.estado === 'Listo' 
                                        ? 'bg-emerald-500 text-black border-emerald-400' 
                                        : 'bg-black/40 text-slate-300 border-slate-600'
                                    }`}>
                                        {r.estado?.substring(0, 4) || 'PEND'}
                                    </span>
                                    
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => cambiarEstado(r.id, "Pendiente")}
                                            className="px-4 py-2 bg-slate-800 text-slate-300 border border-slate-600 rounded-lg text-[10px] font-bold uppercase hover:bg-white hover:text-black hover:border-white transition-all font-mono"
                                        >
                                            PENDIENTE
                                        </button>
                                        <button 
                                            onClick={() => cambiarEstado(r.id, "Listo")}
                                            className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-emerald-400 hover:text-black hover:shadow-[0_0_15px_#34d399] transition-all font-mono flex items-center gap-2 active:scale-95 border border-emerald-500"
                                        >
                                            ✅ LISTO
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default PantallaProduccion;