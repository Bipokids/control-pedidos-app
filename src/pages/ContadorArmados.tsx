import React, { useEffect, useState } from 'react';
import { db_realtime } from '../firebase/config';
import { ref, onValue } from "firebase/database";
import type { Remito } from '../types';

// Configuración por defecto (si es la primera vez que entras)
const CONFIG_DEFAULT = {
    "PRO CITY": ["R12", "R16", "R20", "R24", "R26"],
    "ALUMINIO": ["RA 12", "RA 16", "RA 20"],
    "MOUNTAIN BIKE": ["R20 MTB", "R24 MTB"]
};

const ContadorArmados: React.FC = () => {
    const [remitos, setRemitos] = useState<Record<string, Remito>>({});
    const [config, setConfig] = useState<Record<string, string[]>>(CONFIG_DEFAULT);
    const [conteos, setConteos] = useState<Record<string, number>>({});
    const [totales, setTotales] = useState({ pendientes: 0, listos: 0 });
    
    // Estado Modal Configuración
    const [modalOpen, setModalOpen] = useState(false);
    const [tempConfig, setTempConfig] = useState<Record<string, string[]>>(CONFIG_DEFAULT);
    const [newCat, setNewCat] = useState("");
    const [newItem, setNewItem] = useState<{cat: string, val: string}>({cat: '', val: ''});

    // 1. Cargar Configuración Local y Datos Firebase
    useEffect(() => {
        // Cargar config guardada
        const savedConfig = localStorage.getItem('contador_config');
        if (savedConfig) {
            setConfig(JSON.parse(savedConfig));
            setTempConfig(JSON.parse(savedConfig));
        }

        // Cargar Remitos
        const unsubscribe = onValue(ref(db_realtime, 'remitos'), (snapshot) => {
            setRemitos(snapshot.val() || {});
        });
        return () => unsubscribe();
    }, []);

    // 2. Calcular Conteos cuando cambian datos o configuración
    useEffect(() => {
        calcularConteos();
    }, [remitos, config]);

    const normalize = (str: string | undefined) => String(str || "").trim().toUpperCase().replace(/\s+/g, " ");

    const calcularConteos = () => {
        const nuevosConteos: Record<string, number> = {};
        let totalP = 0;
        let totalL = 0;

        // Inicializar contadores en 0 según la config actual
        Object.values(config).flat().forEach(codigo => {
            nuevosConteos[normalize(codigo)] = 0;
        });

        Object.values(remitos).forEach(r => {
            // Lógica de estado (Replicada de tu HTML)
            const estado = normalize(r.estado);
            const estadoPrep = normalize(r.estadoPreparacion);

            const isListo = 
                estado === "LISTO" || 
                estado === "DESPACHADO" || 
                ((!estado || estado === "LISTO") && ["LISTO", "PENDIENTE", "DESPACHADO"].includes(estadoPrep));

            if (r.articulos) {
                r.articulos.forEach(art => {
                    const codigoArt = normalize(art.codigo);
                    const cantidad = Number(art.cantidad || 0);

                    // Verificamos si este código está en nuestra configuración
                    if (nuevosConteos.hasOwnProperty(codigoArt)) {
                        if (isListo) {
                            totalL += cantidad;
                        } else {
                            nuevosConteos[codigoArt] += cantidad;
                            totalP += cantidad;
                        }
                    }
                });
            }
        });

        setConteos(nuevosConteos);
        setTotales({ pendientes: totalP, listos: totalL });
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

    return (
        <div className="max-w-6xl mx-auto px-4 py-8 font-sans min-h-screen bg-slate-50">
            
            {/* ENCABEZADO */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 italic uppercase tracking-tighter">
                        Contador <span className="text-blue-600">Armados</span>
                    </h1>
                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">
                        Monitor de producción en tiempo real
                    </p>
                </div>
                <button 
                    onClick={() => setModalOpen(true)}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 text-slate-600 font-bold text-xs flex items-center gap-2 transition-transform active:scale-95 uppercase"
                >
                    ⚙️ Configurar
                </button>
            </div>

            {/* SECCIONES POR CATEGORÍA */}
            <div className="space-y-6 mb-10">
                {Object.entries(config).map(([categoria, items]) => (
                    <div key={categoria} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        
                        {/* TÍTULO CENTRADO */}
                        <div className="flex items-center gap-4 mb-4">
                            <div className="h-[1px] bg-slate-100 flex-1"></div>
                            <h3 className="text-sm font-black text-blue-900 uppercase tracking-widest text-center px-4 py-1 bg-blue-50 rounded-full">
                                {categoria}
                            </h3>
                            <div className="h-[1px] bg-slate-100 flex-1"></div>
                        </div>

                        {/* ITEMS (Flex para centrar + Ancho fijo para uniformidad) */}
                        <div className="flex flex-wrap justify-center gap-3">
                            {items.map(codigo => (
                                <div 
                                    key={codigo} 
                                    className="bg-slate-50 border border-slate-200 rounded-xl p-2 text-center hover:shadow-md transition-all group flex flex-col justify-center w-24 min-h-[70px]"
                                >
                                    <span className="block text-[9px] font-black text-slate-400 uppercase mb-0.5 truncate px-1" title={codigo}>
                                        {codigo}
                                    </span>
                                    <span className="block text-2xl font-black text-blue-600 group-hover:scale-110 transition-transform leading-none">
                                        {conteos[normalize(codigo)] || 0}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* TOTALES COMPACTOS */}
            <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-yellow-400 text-center hover:shadow-md transition-shadow">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Pendientes</p>
                    <p className="text-3xl font-black text-slate-800 mt-1">{totales.pendientes}</p>
                </div>
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-green-500 text-center hover:shadow-md transition-shadow">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Listos</p>
                    <p className="text-3xl font-black text-slate-800 mt-1">{totales.listos}</p>
                </div>
            </div>

            {/* MODAL CONFIGURACIÓN (Mismo que antes) */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
                    <div className="bg-white rounded-[2rem] w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="text-xl font-black text-slate-800 uppercase italic">Configurar Items a Contar</h3>
                            <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-800 font-bold text-xl">✕</button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-8">
                            <div className="flex gap-2">
                                <input 
                                    className="flex-1 p-3 border-2 border-slate-200 rounded-xl text-sm font-bold uppercase outline-none focus:border-blue-500"
                                    placeholder="Nueva Categoría (ej: R29)"
                                    value={newCat}
                                    onChange={e => setNewCat(e.target.value)}
                                />
                                <button onClick={addCategoria} className="bg-slate-800 text-white px-6 rounded-xl font-black uppercase text-xs hover:bg-black">
                                    + Crear Cat
                                </button>
                            </div>

                            <hr className="border-slate-100" />

                            {Object.entries(tempConfig).map(([cat, items]) => (
                                <div key={cat} className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-black text-blue-900 uppercase">{cat}</h4>
                                        <button onClick={() => deleteCategoria(cat)} className="text-red-500 text-xs font-bold hover:underline">Eliminar Categ.</button>
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {items.map((item, idx) => (
                                            <span key={idx} className="bg-white border border-slate-200 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-2">
                                                {item}
                                                <button onClick={() => deleteItem(cat, idx)} className="text-red-400 hover:text-red-600 font-black">×</button>
                                            </span>
                                        ))}
                                    </div>

                                    <div className="flex gap-2">
                                        <input 
                                            className="flex-1 p-2 border border-slate-300 rounded-lg text-xs font-bold uppercase outline-none"
                                            placeholder={`Agregar código a ${cat}...`}
                                            value={newItem.cat === cat ? newItem.val : ''}
                                            onChange={e => setNewItem({cat: cat, val: e.target.value})}
                                            onKeyDown={e => e.key === 'Enter' && addItem(cat)}
                                        />
                                        <button onClick={() => addItem(cat)} className="bg-blue-100 text-blue-700 px-4 rounded-lg font-bold text-xs hover:bg-blue-200">
                                            +
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <button onClick={() => setModalOpen(false)} className="px-6 py-3 rounded-xl text-slate-500 font-bold text-xs uppercase hover:bg-white">Cancelar</button>
                            <button onClick={guardarConfiguracion} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase hover:bg-blue-700 shadow-lg shadow-blue-200">Guardar Cambios</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default ContadorArmados;