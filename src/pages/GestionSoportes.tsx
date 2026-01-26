import React, { useEffect, useState } from 'react';
import { db_realtime } from '../firebase/config';
import { ref, onValue, update } from "firebase/database";
import type { Soporte } from '../types';

const GestionSoportes: React.FC = () => {
    const [soportes, setSoportes] = useState<Record<string, Soporte>>({});
    const [filtro, setFiltro] = useState("");
    const [filtroEstado, setFiltroEstado] = useState(""); // "" = Todos
    
    // Modal de Edición
    const [modalOpen, setModalOpen] = useState(false);
    const [editData, setEditData] = useState<{id: string, descripcion: string, numero: string | number} | null>(null);

    useEffect(() => {
        const unsubscribe = onValue(ref(db_realtime, 'soportes'), (snapshot) => {
            setSoportes(snapshot.val() || {});
        });
        return () => unsubscribe();
    }, []);

    // --- LÓGICA DE FILTRADO ---
    const soportesFiltrados = Object.entries(soportes).filter(([_id, s]) => {
        const matchTexto = !filtro || 
                           (s.cliente || '').toLowerCase().includes(filtro.toLowerCase()) || 
                           (s.numeroSoporte || '').toString().includes(filtro);
        const matchEstado = !filtroEstado || s.estado === filtroEstado;
        return matchTexto && matchEstado && s.estado !== "Entregado";
    });

    // --- ACCIONES ---
    const marcarListo = (id: string) => {
        if(window.confirm("¿Confirmar que el soporte está listo para entregar?")) {
            update(ref(db_realtime, `soportes/${id}`), { 
                estado: "Resuelto",
                timestamp: new Date().toISOString()
            });
        }
    };

    const guardarDescripcion = () => {
        if (editData) {
            update(ref(db_realtime, `soportes/${editData.id}`), { descripcion: editData.descripcion });
            setModalOpen(false);
            setEditData(null);
        }
    };

    // --- HELPERS VISUALES ---
    const renderProductos = (prods: string[] | string | undefined) => {
        if (!prods) return <span className="text-slate-600 italic font-mono">-</span>;
        if (Array.isArray(prods)) return prods.map((p, i) => <li key={i} className="flex gap-2"><span className="text-violet-500">›</span> {p}</li>);
        if (typeof prods === 'string') return prods.split(/\r?\n/).map((p, i) => <li key={i} className="flex gap-2"><span className="text-violet-500">›</span> {p}</li>);
        return <li className="flex gap-2"><span className="text-violet-500">›</span> {prods}</li>;
    };

    const getBadgeColor = (estado: string) => {
        switch(estado) {
            case 'Resuelto': return 'bg-emerald-900/40 text-emerald-400 border-emerald-500/50 shadow-[0_0_10px_#10b981]'; 
            case 'En progreso': return 'bg-blue-900/40 text-blue-400 border-blue-500/50 shadow-[0_0_10px_#3b82f6]'; 
            default: return 'bg-yellow-900/30 text-yellow-400 border-yellow-500/40'; // Pendiente
        }
    };

    return (
        <div className="min-h-screen relative font-sans text-cyan-50 bg-[#050b14] selection:bg-violet-500 selection:text-black pb-20 pt-10 px-4">
            
            {/* GRID DE FONDO DECORATIVO */}
            <div className="fixed inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #1e293b 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

            <div className="max-w-[1600px] mx-auto relative z-10">
                
                {/* ENCABEZADO UNIFICADO */}
                <header className="mb-10 flex flex-col xl:flex-row justify-between items-end gap-6 border-b border-violet-900/50 pb-6">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tighter mb-2 uppercase drop-shadow-[0_0_10px_rgba(139,92,246,0.5)]">
                            GESTIÓN <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-500">TÉCNICA</span>
                        </h1>
                        <p className="text-violet-500 font-mono text-xs uppercase tracking-[0.3em]">Resolución y Seguimiento de Casos</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
                        {/* Buscador Moderno */}
                        <div className="relative flex-1 min-w-[280px] group">
                            <span className="absolute left-4 top-4 text-violet-700 group-focus-within:text-violet-400 transition-colors">🔍</span>
                            <input 
                                type="text" 
                                placeholder="BUSCAR..." 
                                value={filtro}
                                onChange={(e) => setFiltro(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-[#0f172a] border border-violet-900 rounded-xl shadow-inner focus:border-violet-500 focus:ring-1 focus:ring-violet-500 focus:shadow-[0_0_15px_rgba(139,92,246,0.3)] outline-none font-mono text-sm text-violet-100 placeholder-violet-900 transition-all uppercase tracking-wider"
                            />
                        </div>

                        {/* Selector de Estado Estilizado */}
                        <div className="relative min-w-[200px] group">
                            <span className="absolute left-4 top-4 text-violet-700 group-focus-within:text-violet-400 transition-colors">📂</span>
                            <select 
                                value={filtroEstado}
                                onChange={(e) => setFiltroEstado(e.target.value)}
                                className="w-full pl-12 pr-10 py-4 bg-[#0f172a] border border-violet-900 rounded-xl shadow-inner focus:border-violet-500 focus:ring-1 focus:ring-violet-500 focus:shadow-[0_0_15px_rgba(139,92,246,0.3)] outline-none transition-all font-mono font-bold text-xs uppercase text-violet-200 appearance-none cursor-pointer"
                            >
                                <option value="">TODOS LOS ESTADOS</option>
                                <option value="Pendiente">Pendiente</option>
                                <option value="En progreso">En progreso</option>
                                <option value="Resuelto">Resuelto</option>
                            </select>
                            <span className="absolute right-4 top-4 text-violet-800 text-xs pointer-events-none">▼</span>
                        </div>
                    </div>
                </header>

                {/* CONTADOR */}
                <div className="text-xs text-violet-400 font-mono font-medium mb-6 text-right px-2 flex justify-end items-center gap-2">
                    <span className="w-2 h-2 bg-violet-500 rounded-full animate-pulse"></span>
                    {soportesFiltrados.length} SOPORTE(S) · {new Date().toLocaleDateString()}
                </div>

                {/* GRID DE TARJETAS */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {soportesFiltrados.length === 0 ? (
                        <div className="col-span-full py-20 text-center text-slate-600 font-mono font-bold italic text-sm border-2 border-dashed border-slate-800 rounded-2xl bg-[#0f172a]/50">
                            :: NO DATA FOUND ::
                        </div>
                    ) : (
                        soportesFiltrados.map(([id, s]) => (
                            <div key={id} className="bg-[#0f172a]/60 backdrop-blur-md border border-slate-800 rounded-[2rem] p-6 shadow-lg hover:border-violet-500/30 hover:shadow-[0_0_20px_rgba(139,92,246,0.1)] transition-all group relative overflow-hidden">
                                
                                {/* Decorative line */}
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 to-fuchsia-600 opacity-50"></div>

                                {/* Cabecera Tarjeta */}
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <strong className="text-white text-lg font-black italic tracking-wide block">#{s.numeroSoporte}</strong>
                                        <div className="text-[10px] text-slate-500 font-mono mt-1">UUID: {id.slice(-6)}</div>
                                    </div>
                                    <span className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest border font-mono ${getBadgeColor(s.estado)}`}>
                                        {s.estado}
                                    </span>
                                </div>

                                {/* Datos Principales */}
                                <div className="space-y-4 text-sm bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                                    <div className="grid grid-cols-[80px_1fr] items-center">
                                        <span className="font-bold text-violet-400 font-mono text-xs uppercase tracking-wider">Cliente</span>
                                        <span className="text-white font-bold uppercase truncate">{s.cliente}</span>
                                    </div>
                                    <div className="grid grid-cols-[80px_1fr] items-center">
                                        <span className="font-bold text-violet-400 font-mono text-xs uppercase tracking-wider">Fecha</span>
                                        <span className="text-slate-400 font-mono text-xs">{s.fechaSoporte}</span>
                                    </div>
                                    <div className="grid grid-cols-[80px_1fr] items-start border-t border-slate-800 pt-3 mt-3">
                                        <span className="font-bold text-violet-400 font-mono text-xs uppercase tracking-wider mt-0.5">Items</span>
                                        <ul className="text-slate-300 text-xs leading-relaxed font-mono">
                                            {renderProductos(s.productos)}
                                        </ul>
                                    </div>
                                </div>
                                
                                {/* Campo Trabajo / Descripción */}
                                <div className="mt-4">
                                    <span className="font-bold text-violet-400 font-mono text-xs uppercase tracking-wider block mb-2">TRABAJO REALIZADO</span>
                                    <div className="bg-black/40 p-3 rounded-xl border border-slate-700/50 text-xs text-slate-400 min-h-[50px] italic font-mono leading-relaxed">
                                        {s.descripcion ? `> ${s.descripcion}` : "> Sin descripción..."}
                                    </div>
                                </div>

                                {/* Acciones */}
                                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
                                    <button 
                                        onClick={() => { setEditData({ id, descripcion: s.descripcion || '', numero: s.numeroSoporte }); setModalOpen(true); }}
                                        className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-wider hover:bg-white hover:text-black transition-all border border-slate-700 font-mono"
                                    >
                                        ✏️ EDITAR
                                    </button>
                                    
                                    {s.estado !== 'Resuelto' && (
                                        <button 
                                            onClick={() => marcarListo(id)}
                                            className="px-4 py-2 rounded-xl bg-emerald-600 text-black text-[10px] font-black uppercase tracking-wider hover:bg-emerald-400 hover:shadow-[0_0_15px_#10b981] transition-all font-mono"
                                        >
                                            ✅ LISTO
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* MODAL EDITAR */}
                {modalOpen && editData && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => setModalOpen(false)}>
                        <div className="bg-[#0f172a] rounded-[2rem] shadow-[0_0_50px_rgba(139,92,246,0.2)] w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-violet-900/50" onClick={e => e.stopPropagation()}>
                            
                            {/* Decorative Top */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-600 to-indigo-600"></div>

                            <div className="p-6 border-b border-slate-800">
                                <h3 className="font-black text-xl text-white uppercase italic tracking-tighter">Edit Ticket #{editData.numero}</h3>
                            </div>
                            
                            <div className="p-6">
                                <label className="block text-[10px] font-bold text-violet-400 mb-2 uppercase tracking-widest font-mono">Work Description / Log</label>
                                <textarea 
                                    className="w-full h-32 p-4 bg-black border border-slate-700 rounded-xl text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none resize-none text-slate-300 font-mono placeholder-slate-700"
                                    placeholder="> Input technical details..."
                                    value={editData.descripcion}
                                    onChange={(e) => setEditData({...editData, descripcion: e.target.value})}
                                    autoFocus
                                />
                            </div>

                            <div className="p-6 bg-slate-900/50 flex justify-end gap-3 border-t border-slate-800">
                                <button 
                                    onClick={() => setModalOpen(false)}
                                    className="px-6 py-3 rounded-xl border border-slate-600 bg-transparent text-slate-400 text-xs font-bold uppercase tracking-widest hover:text-white hover:border-slate-400 transition-all font-mono"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={guardarDescripcion}
                                    className="px-6 py-3 rounded-xl bg-violet-600 text-white text-xs font-black uppercase tracking-widest hover:bg-violet-500 hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] transition-all font-mono"
                                >
                                    Save Log
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GestionSoportes;