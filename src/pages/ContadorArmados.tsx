import React, { useEffect, useState } from 'react';
import { db_realtime } from '../firebase/config';
import { ref, onValue } from "firebase/database";
import type { Remito } from '../types';

// Configuración por defecto
const CONFIG_DEFAULT = {
    "PRO CITY": ["R12", "R16", "R20", "R24", "R26"],
    "ALUMINIO": ["RA 12", "RA 16", "RA 20"],
    "MOUNTAIN BIKE": ["R20 MTB", "R24 MTB"]
};

const ContadorArmados: React.FC = () => {
    // -------------------------------------------------------------------------
    // LÓGICA INTACTA
    // -------------------------------------------------------------------------
    const [remitos, setRemitos] = useState<Record<string, Remito>>({});
    const [config, setConfig] = useState<Record<string, string[]>>(CONFIG_DEFAULT);
    const [conteos, setConteos] = useState<Record<string, number>>({});
    
    const [totales, setTotales] = useState({ pendientes: 0, listos: 0, despachados: 0 });
    
    const [modalOpen, setModalOpen] = useState(false);
    const [tempConfig, setTempConfig] = useState<Record<string, string[]>>(CONFIG_DEFAULT);
    const [newCat, setNewCat] = useState("");
    const [newItem, setNewItem] = useState<{cat: string, val: string}>({cat: '', val: ''});

    useEffect(() => {
        const savedConfig = localStorage.getItem('contador_config');
        if (savedConfig) {
            setConfig(JSON.parse(savedConfig));
            setTempConfig(JSON.parse(savedConfig));
        }

        const unsubscribe = onValue(ref(db_realtime, 'remitos'), (snapshot) => {
            setRemitos(snapshot.val() || {});
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        calcularConteos();
    }, [remitos, config]);

    const normalize = (str: string | undefined) => String(str || "").trim().toUpperCase().replace(/\s+/g, " ");

    const calcularConteos = () => {
        const nuevosConteos: Record<string, number> = {};
        let totalP = 0;
        let totalL = 0;
        let totalD = 0;

        Object.values(config).flat().forEach(codigo => {
            nuevosConteos[normalize(codigo)] = 0;
        });

        Object.values(remitos).forEach(r => {
            if (!r.produccion) return;

            const estado = normalize(r.estado || "PENDIENTE");
            const estadoPrep = normalize(r.estadoPreparacion || "PENDIENTE");

            let tipoSuma: 'pendiente' | 'listo' | 'despachado' | null = null;

            // Lógica de estados
            if (estado === "PENDIENTE" && estadoPrep === "PENDIENTE") {
                tipoSuma = 'pendiente';
            }
            else if (estado === "LISTO" && estadoPrep === "PENDIENTE") {
                tipoSuma = 'listo';
            }
            else if (estado === "LISTO" && estadoPrep === "LISTO") {
                tipoSuma = 'listo';
            }
            // --- CORRECCIÓN AQUÍ ---
            // Aceptamos que si la preparación está DESPACHADA, cuente como despachado
            // aunque el estado administrativo haya quedado en LISTO o sea DESPACHADO.
            else if ((estado === "DESPACHADO" || estado === "LISTO") && estadoPrep === "DESPACHADO") {
                tipoSuma = 'despachado';
            }

            if (tipoSuma && r.articulos) {
                r.articulos.forEach(art => {
                    const codigoArt = normalize(art.codigo);
                    const cantidad = Number(art.cantidad || 0);

                    // Nota: Aquí solo estás sumando a los contadores individuales si es PENDIENTE.
                    // Si quisieras ver conteos individuales de despachados, deberías quitar el if interno.
                    if (nuevosConteos.hasOwnProperty(codigoArt)) {
                        if (tipoSuma === 'pendiente') {
                            nuevosConteos[codigoArt] += cantidad;
                        }
                    }

                    if (tipoSuma === 'pendiente') totalP += cantidad;
                    if (tipoSuma === 'listo') totalL += cantidad;
                    if (tipoSuma === 'despachado') totalD += cantidad;
                });
            }
        });

        setConteos(nuevosConteos);
        setTotales({ pendientes: totalP, listos: totalL, despachados: totalD });
    };

    // --- GESTIÓN DE CONFIGURACIÓN ---
    const guardarConfiguracion = () => {
        setConfig(tempConfig);
        localStorage.setItem('contador_config', JSON.stringify(tempConfig));
        setModalOpen(false);
    };

    const addCategoria = () => {
        if (!newCat) return;
        setTempConfig({ ...tempConfig, [newCat.toUpperCase()]: [] });
        setNewCat("");
    };

    const deleteCategoria = (cat: string) => {
        const nueva = { ...tempConfig };
        delete nueva[cat];
        setTempConfig(nueva);
    };

    const addItem = (cat: string) => {
        if (!newItem.val) return;
        const currentItems = tempConfig[cat] || [];
        setTempConfig({
            ...tempConfig,
            [cat]: [...currentItems, newItem.val.toUpperCase()]
        });
        setNewItem({cat: '', val: ''});
    };

    const deleteItem = (cat: string, itemIdx: number) => {
        const nuevosItems = tempConfig[cat].filter((_, i) => i !== itemIdx);
        setTempConfig({ ...tempConfig, [cat]: nuevosItems });
    };

    // -------------------------------------------------------------------------
    // RENDERIZADO FUTURISTA
    // -------------------------------------------------------------------------
    return (
        <div className="min-h-screen relative font-sans text-cyan-50 bg-[#050b14] selection:bg-cyan-500 selection:text-black pb-20 pt-10 px-4">
            
            {/* GRID DE FONDO DECORATIVO */}
            <div className="fixed inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #1e293b 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

            <div className="max-w-7xl mx-auto relative z-10">
                
                {/* ENCABEZADO */}
                <header className="mb-12 flex justify-between items-end border-b border-cyan-900/50 pb-6">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tighter mb-2 uppercase drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                            CONTADOR <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">ARMADO</span>
                        </h1>
                        <p className="text-cyan-600 font-mono text-xs uppercase tracking-[0.3em]">Sistema de Control de Producción en Tiempo Real</p>
                    </div>
                    
                    <div>
                        <button 
                            onClick={() => setModalOpen(true)}
                            className="px-6 py-3 bg-[#0f172a] border border-cyan-500/50 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.1)] hover:shadow-[0_0_25px_rgba(6,182,212,0.3)] text-cyan-400 font-bold font-mono text-xs flex items-center gap-2 transition-all active:scale-95 uppercase tracking-widest hover:bg-cyan-900/20 hover:text-white"
                        >
                            <span className="text-lg">⚙️</span> CONFIGURACIÓN
                        </button>
                    </div>
                </header>

                {/* SECCIONES POR CATEGORÍA */}
                <div className="space-y-8 mb-12">
                    {Object.entries(config).map(([categoria, items]) => (
                        <div key={categoria} className="bg-[#0f172a]/60 backdrop-blur-md p-6 rounded-[2rem] shadow-xl border border-slate-800 relative group hover:border-cyan-900/50 transition-all">
                            
                            {/* DECORACIÓN DE ESQUINA */}
                            <div className="absolute top-0 right-0 p-3">
                                <div className="w-2 h-2 bg-cyan-500 rounded-full shadow-[0_0_10px_cyan] animate-pulse"></div>
                            </div>

                            {/* TÍTULO */}
                            <div className="flex items-center gap-4 mb-6">
                                <div className="h-[1px] bg-gradient-to-r from-transparent via-cyan-900 to-transparent flex-1"></div>
                                <h3 className="text-sm font-black text-cyan-400 uppercase tracking-[0.3em] px-6 py-2 bg-cyan-900/20 rounded-full border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]">
                                    {categoria}
                                </h3>
                                <div className="h-[1px] bg-gradient-to-r from-transparent via-cyan-900 to-transparent flex-1"></div>
                            </div>

                            {/* ITEMS / CELDAS */}
                            <div className="flex flex-wrap justify-center gap-4">
                                {items.map(codigo => (
                                    <div 
                                        key={codigo} 
                                        className="bg-[#050b14] border border-slate-800 rounded-xl p-3 text-center hover:border-cyan-500 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all group/item flex flex-col justify-center w-28 min-h-[90px] relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity"></div>
                                        
                                        <span className="block text-[9px] font-black text-slate-500 uppercase mb-1 truncate px-1 font-mono tracking-wider group-hover/item:text-cyan-300 transition-colors" title={codigo}>
                                            {codigo}
                                        </span>
                                        
                                        {/* CANTIDAD PENDIENTE */}
                                        <span className="block text-3xl font-black text-white group-hover/item:scale-110 transition-transform leading-none font-mono drop-shadow-[0_0_5px_rgba(255,255,255,0.3)] group-hover/item:text-cyan-400 group-hover/item:drop-shadow-[0_0_10px_cyan]">
                                            {conteos[normalize(codigo)] || 0}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* TOTALES COMPACTOS (HUD) */}
                <div className="grid grid-cols-3 gap-6 max-w-4xl mx-auto">
                    {/* PENDIENTES */}
                    <div className="bg-[#0f172a]/80 p-5 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.1)] border border-amber-500/30 text-center hover:shadow-[0_0_30px_rgba(245,158,11,0.2)] hover:-translate-y-1 transition-all group">
                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-2 font-mono group-hover:text-amber-400">Pendientes</p>
                        <p className="text-5xl font-black text-white font-mono drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]">{totales.pendientes}</p>
                    </div>
                    
                    {/* LISTOS */}
                    <div className="bg-[#0f172a]/80 p-5 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.1)] border border-emerald-500/30 text-center hover:shadow-[0_0_30px_rgba(16,185,129,0.2)] hover:-translate-y-1 transition-all group">
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-2 font-mono group-hover:text-emerald-400">Listos</p>
                        <p className="text-5xl font-black text-white font-mono drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]">{totales.listos}</p>
                    </div>
                    
                    {/* DESPACHADOS */}
                    <div className="bg-[#0f172a]/80 p-5 rounded-2xl shadow-[0_0_20px_rgba(6,182,212,0.1)] border border-cyan-500/30 text-center hover:shadow-[0_0_30px_rgba(6,182,212,0.2)] hover:-translate-y-1 transition-all group">
                        <p className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.2em] mb-2 font-mono group-hover:text-cyan-400">Despachados</p>
                        <p className="text-5xl font-black text-white font-mono drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]">{totales.despachados}</p>
                    </div>
                </div>

                {/* MODAL CONFIGURACIÓN (Estilo Terminal) */}
                {modalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => setModalOpen(false)}>
                        <div className="bg-[#0f172a] rounded-[2rem] w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-[0_0_50px_rgba(6,182,212,0.2)] border border-cyan-500/30 animate-in zoom-in duration-200 relative" onClick={e => e.stopPropagation()}>
                            
                            {/* Decorative Top Line */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600"></div>

                            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                                <h3 className="text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-2">
                                    <span className="text-cyan-500">⚙️</span> Protocol Configuration
                                </h3>
                                <button onClick={() => setModalOpen(false)} className="text-slate-500 hover:text-red-400 font-bold text-xl transition-colors">✕</button>
                            </div>

                            <div className="p-6 overflow-y-auto flex-1 space-y-8 custom-scrollbar">
                                <div className="flex gap-2">
                                    <input 
                                        className="flex-1 p-4 bg-black border border-slate-700 rounded-xl text-sm font-bold font-mono uppercase text-cyan-400 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder-slate-700 transition-all"
                                        placeholder="Nueva Categoría (ej: R29)"
                                        value={newCat}
                                        onChange={e => setNewCat(e.target.value)}
                                    />
                                    <button onClick={addCategoria} className="bg-cyan-600 text-black px-6 rounded-xl font-black uppercase text-xs hover:bg-cyan-400 hover:shadow-[0_0_15px_cyan] transition-all font-mono tracking-widest">
                                        + CREATE
                                    </button>
                                </div>

                                <hr className="border-slate-800" />

                                {Object.entries(tempConfig).map(([cat, items]) => (
                                    <div key={cat} className="bg-slate-900/50 p-5 rounded-2xl border border-slate-800 hover:border-cyan-900/50 transition-colors">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="font-black text-cyan-100 uppercase tracking-widest text-xs font-mono bg-cyan-900/30 px-3 py-1 rounded">{cat}</h4>
                                            <button onClick={() => deleteCategoria(cat)} className="text-red-500 text-[10px] font-bold font-mono hover:text-red-300 uppercase tracking-wider border border-transparent hover:border-red-500/30 px-2 py-1 rounded transition-all">DELETE GROUP</button>
                                        </div>
                                        
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {items.map((item, idx) => (
                                                <span key={idx} className="bg-black border border-slate-700 px-3 py-1 rounded-lg text-xs font-bold text-slate-300 flex items-center gap-2 font-mono group">
                                                    {item}
                                                    <button onClick={() => deleteItem(cat, idx)} className="text-slate-600 hover:text-red-400 font-black text-lg leading-none transition-colors">×</button>
                                                </span>
                                            ))}
                                        </div>

                                        <div className="flex gap-2">
                                            <input 
                                                className="flex-1 p-3 bg-black border border-slate-700 rounded-lg text-xs font-bold font-mono uppercase text-white outline-none focus:border-cyan-500 placeholder-slate-700"
                                                placeholder={`ADD CODE TO ${cat}...`}
                                                value={newItem.cat === cat ? newItem.val : ''}
                                                onChange={e => setNewItem({cat: cat, val: e.target.value})}
                                                onKeyDown={e => e.key === 'Enter' && addItem(cat)}
                                            />
                                            <button onClick={() => addItem(cat)} className="bg-slate-800 text-cyan-400 px-4 rounded-lg font-bold text-lg hover:bg-cyan-900 hover:text-white transition-colors border border-slate-700">
                                                +
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-6 border-t border-slate-800 bg-slate-900/80 flex justify-end gap-3">
                                <button onClick={() => setModalOpen(false)} className="px-6 py-3 rounded-xl text-slate-400 font-bold font-mono text-xs uppercase hover:text-white hover:bg-white/5 transition-all">Cancel</button>
                                <button onClick={guardarConfiguracion} className="px-8 py-3 bg-cyan-600 text-black rounded-xl font-black font-mono text-xs uppercase hover:bg-cyan-400 shadow-[0_0_20px_rgba(8,145,178,0.4)] transition-all">Save Changes</button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default ContadorArmados;