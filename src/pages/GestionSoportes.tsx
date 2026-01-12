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

    // --- LÓGICA DE FILTRADO (Idéntica a tu HTML) ---
    const soportesFiltrados = Object.entries(soportes).filter(([_id, s]) => {
        // 1. Filtro Texto (Cliente o Número)
        const matchTexto = !filtro || 
                           (s.cliente || '').toLowerCase().includes(filtro.toLowerCase()) || 
                           (s.numeroSoporte || '').toString().includes(filtro);
        
        // 2. Filtro Estado
        const matchEstado = !filtroEstado || s.estado === filtroEstado;
        
        // 3. Excluir Entregados (siempre)
        return matchTexto && matchEstado && s.estado !== "Entregado";
    });

    // --- ACCIONES DE BASE DE DATOS ---
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
        if (!prods) return <span className="text-gray-400 italic">-</span>;
        if (Array.isArray(prods)) return prods.map((p, i) => <li key={i}>{p}</li>);
        if (typeof prods === 'string') return prods.split(/\r?\n/).map((p, i) => <li key={i}>{p}</li>);
        return <li>{prods}</li>;
    };

    const getBadgeColor = (estado: string) => {
        switch(estado) {
            case 'Resuelto': return 'bg-purple-100 text-purple-700 border-purple-200'; // --chip-r
            case 'En progreso': return 'bg-blue-100 text-blue-700 border-blue-200';   // --chip-e
            default: return 'bg-yellow-100 text-yellow-700 border-yellow-200';        // --chip-p
        }
    };

    return (
        <div className="max-w-[1600px] mx-auto p-6 font-sans min-h-screen bg-gray-50">
            
            {/* ENCABEZADO (Sticky Header style) */}
            <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-gray-200 p-4 rounded-2xl shadow-sm mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">📋</span>
                    <h1 className="text-xl font-bold text-gray-800">Gestión de Soportes Técnicos</h1>
                </div>

                <div className="flex flex-wrap gap-3 w-full md:w-auto">
                    <input 
                        className="flex-1 p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 min-w-[220px]"
                        placeholder="🔍 Buscar por cliente o número..."
                        value={filtro}
                        onChange={(e) => setFiltro(e.target.value)}
                    />
                    <select 
                        className="p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500 bg-white cursor-pointer"
                        value={filtroEstado}
                        onChange={(e) => setFiltroEstado(e.target.value)}
                    >
                        <option value="">📂 Filtrar por estado...</option>
                        <option value="Pendiente">Pendiente</option>
                        <option value="En progreso">En progreso</option>
                        <option value="Resuelto">Resuelto</option>
                    </select>
                </div>
            </header>

            {/* CONTADOR */}
            <div className="text-xs text-gray-500 font-medium mb-4 text-right px-2">
                {soportesFiltrados.length} soporte(s) · {new Date().toLocaleDateString()}
            </div>

            {/* GRID DE TARJETAS */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {soportesFiltrados.length === 0 ? (
                    <div className="col-span-full py-10 text-center text-gray-400 bg-white rounded-xl border border-gray-200 border-dashed">
                        Sin resultados
                    </div>
                ) : (
                    soportesFiltrados.map(([id, s]) => (
                        <div key={id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all">
                            {/* Cabecera Tarjeta */}
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <strong className="text-gray-800">Soporte #{s.numeroSoporte}</strong>
                                    <div className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {id.slice(-6)}</div>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-[11px] font-bold border ${getBadgeColor(s.estado)}`}>
                                    {s.estado}
                                </span>
                            </div>

                            {/* Datos Principales */}
                            <div className="space-y-3 mt-4 text-sm">
                                <div className="grid grid-cols-[80px_1fr] items-center">
                                    <span className="font-bold text-gray-700">Cliente</span>
                                    <span className="text-gray-900 uppercase">{s.cliente}</span>
                                </div>
                                <div className="grid grid-cols-[80px_1fr] items-center">
                                    <span className="font-bold text-gray-700">Fecha</span>
                                    <span className="text-gray-600">{s.fechaSoporte}</span>
                                </div>
                                <div className="grid grid-cols-[80px_1fr] items-start">
                                    <span className="font-bold text-gray-700 mt-0.5">Productos</span>
                                    <ul className="text-gray-600 list-disc list-inside text-xs leading-relaxed">
                                        {renderProductos(s.productos)}
                                    </ul>
                                </div>
                                
                                {/* Campo Trabajo / Descripción */}
                                <div className="grid grid-cols-[80px_1fr] items-start">
                                    <span className="font-bold text-gray-700 mt-0.5">Trabajo</span>
                                    <div className="bg-gray-50 p-2 rounded-lg border border-gray-100 text-xs text-gray-600 min-h-[40px] italic">
                                        {s.descripcion || "Sin descripción..."}
                                    </div>
                                </div>
                            </div>

                            {/* Acciones */}
                            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
                                <button 
                                    onClick={() => { setEditData({ id, descripcion: s.descripcion || '', numero: s.numeroSoporte }); setModalOpen(true); }}
                                    className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition-colors"
                                >
                                    ✏️ Editar
                                </button>
                                
                                {s.estado !== 'Resuelto' && (
                                    <button 
                                        onClick={() => marcarListo(id)}
                                        className="px-4 py-2 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition-colors shadow-sm"
                                    >
                                        ✅ Listo
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* MODAL (HTML dialog style replica) */}
            {modalOpen && editData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100">
                            <h3 className="font-bold text-lg text-gray-800">Editar soporte #{editData.numero}</h3>
                        </div>
                        
                        <div className="p-6">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Descripción trabajo</label>
                            <textarea 
                                className="w-full h-32 p-3 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none resize-none"
                                placeholder="Trabajo realizado..."
                                value={editData.descripcion}
                                onChange={(e) => setEditData({...editData, descripcion: e.target.value})}
                                autoFocus
                            />
                        </div>

                        <div className="p-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
                            <button 
                                onClick={() => setModalOpen(false)}
                                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={guardarDescripcion}
                                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 shadow-sm"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GestionSoportes;