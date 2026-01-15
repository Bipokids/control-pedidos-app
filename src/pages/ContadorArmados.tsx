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
    const [remitos, setRemitos] = useState<Record<string, Remito>>({});
    const [config, setConfig] = useState<Record<string, string[]>>(CONFIG_DEFAULT);
    const [conteos, setConteos] = useState<Record<string, number>>({});
    
    // Ahora 'totales' incluye 'despachados'
    const [totales, setTotales] = useState({ pendientes: 0, listos: 0, despachados: 0 });
    
    // Estado Modal Configuración
    const [modalOpen, setModalOpen] = useState(false);
    const [tempConfig, setTempConfig] = useState<Record<string, string[]>>(CONFIG_DEFAULT);
    const [newCat, setNewCat] = useState("");
    const [newItem, setNewItem] = useState<{cat: string, val: string}>({cat: '', val: ''});

    // 1. Cargar Configuración Local y Datos Firebase
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

    // 2. Calcular Conteos
    useEffect(() => {
        calcularConteos();
    }, [remitos, config]);

    const normalize = (str: string | undefined) => String(str || "").trim().toUpperCase().replace(/\s+/g, " ");

    const calcularConteos = () => {
        const nuevosConteos: Record<string, number> = {};
        let totalP = 0;
        let totalL = 0;
        let totalD = 0;

        // Inicializar contadores
        Object.values(config).flat().forEach(codigo => {
            nuevosConteos[normalize(codigo)] = 0;
        });

        Object.values(remitos).forEach(r => {
            // Solo procesamos si requiere producción
            if (!r.produccion) return;

            const estado = normalize(r.estado || "PENDIENTE"); // Si es null, es Pendiente
            const estadoPrep = normalize(r.estadoPreparacion || "PENDIENTE");

            // LÓGICA DE ESTADOS SOLICITADA
            let tipoSuma: 'pendiente' | 'listo' | 'despachado' | null = null;

            // 1. Pendientes (Prod: Pendiente, Prep: Pendiente)
            if (estado === "PENDIENTE" && estadoPrep === "PENDIENTE") {
                tipoSuma = 'pendiente';
            }
            // 2. Listos Caso 1 (Prod: Listo, Prep: Pendiente)
            else if (estado === "LISTO" && estadoPrep === "PENDIENTE") {
                tipoSuma = 'listo';
            }
            // 3. Listos Caso 2 (Prod: Listo, Prep: Listo)
            else if (estado === "LISTO" && estadoPrep === "LISTO") {
                tipoSuma = 'listo';
            }
            // 4. Despachados (Prod: Despachado, Prep: Despachado)
            else if (estado === "DESPACHADO" && estadoPrep === "DESPACHADO") {
                tipoSuma = 'despachado';
            }
            // Nota: Cualquier otra combinación no se suma (ej: Prod: Pendiente, Prep: Listo - caso raro/error)

            if (tipoSuma && r.articulos) {
                r.articulos.forEach(art => {
                    const codigoArt = normalize(art.codigo);
                    const cantidad = Number(art.cantidad || 0);

                    // Si el código está en nuestra configuración, lo sumamos al desglose visual
                    if (nuevosConteos.hasOwnProperty(codigoArt)) {
                        // OJO: La caja visual de "conteos" (los cuadros grandes) generalmente muestra lo que hay que armar (Pendientes).
                        // Si quieres que muestre TODO, habría que sumar siempre. 
                        // Pero normalmente un contador de producción muestra la "carga de trabajo".
                        // Asumiremos que los cuadros muestran PENDIENTES.
                        if (tipoSuma === 'pendiente') {
                            nuevosConteos[codigoArt] += cantidad;
                        }
                    }

                    // Sumar a los totales globales
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

    return (
        <div className="max-w-6xl mx-auto px-4 py-8 font-sans min-h-screen bg-slate-50">
            
            {/* ENCABEZADO UNIFICADO */}
            <header className="mb-12 flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">
                        Contador <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Armados</span>
                    </h1>
                    <p className="text-slate-500 font-medium text-sm">Monitor de producción en tiempo real.</p>
                </div>
                
                <div>
                    <button 
                        onClick={() => setModalOpen(true)}
                        className="px-6 py-3 bg-white border border-slate-100 rounded-2xl shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 text-slate-600 font-bold text-xs flex items-center gap-2 transition-all active:scale-95 uppercase tracking-widest"
                    >
                        ⚙️ Configurar
                    </button>
                </div>
            </header>

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

                        {/* ITEMS */}
                        <div className="flex flex-wrap justify-center gap-3">
                            {items.map(codigo => (
                                <div 
                                    key={codigo} 
                                    className="bg-slate-50 border border-slate-200 rounded-xl p-2 text-center hover:shadow-md transition-all group flex flex-col justify-center w-24 min-h-[70px]"
                                >
                                    <span className="block text-[9px] font-black text-slate-400 uppercase mb-0.5 truncate px-1" title={codigo}>
                                        {codigo}
                                    </span>
                                    {/* Muestra la cantidad PENDIENTE de armar */}
                                    <span className="block text-2xl font-black text-blue-600 group-hover:scale-110 transition-transform leading-none">
                                        {conteos[normalize(codigo)] || 0}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* TOTALES COMPACTOS (3 COLUMNAS AHORA) */}
            <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-yellow-400 text-center hover:shadow-md transition-shadow">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pendientes</p>
                    <p className="text-4xl font-black text-slate-800 mt-1">{totales.pendientes}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-green-500 text-center hover:shadow-md transition-shadow">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Listos</p>
                    <p className="text-4xl font-black text-slate-800 mt-1">{totales.listos}</p>
                </div>
                {/* NUEVO CONTADOR DESPACHADOS */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-cyan-500 text-center hover:shadow-md transition-shadow">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Despachados</p>
                    <p className="text-4xl font-black text-slate-800 mt-1">{totales.despachados}</p>
                </div>
            </div>

            {/* MODAL CONFIGURACIÓN (Sin cambios funcionales, solo estética heredada) */}
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