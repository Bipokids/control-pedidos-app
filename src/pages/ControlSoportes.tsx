import React, { useEffect, useState } from 'react';
import { db_realtime } from '../firebase/config';
import { ref, onValue, update } from "firebase/database";
import type { Soporte } from '../types';

const ControlSoportes: React.FC = () => {
    const [soportes, setSoportes] = useState<Record<string, Soporte>>({});
    const [filtro, setFiltro] = useState("");
    
    // Modal Firma (Solo necesario si quisieras ver firma de un pendiente, aunque raro)
    // Lo mantenemos por si decides reincorporarlo, pero oculto en el flujo principal.
    
    const rangos = ["Lunes Mañana", "Lunes Tarde", "Martes Mañana", "Martes Tarde", "Miércoles Mañana", "Miércoles Tarde", "Jueves Mañana", "Jueves Tarde", "Viernes Mañana", "Viernes Tarde"];

    useEffect(() => {
        const unsubscribe = onValue(ref(db_realtime, 'soportes'), (snapshot) => {
            setSoportes(snapshot.val() || {});
        });
        return () => unsubscribe();
    }, []);

    // --- LÓGICA DE DATOS ---
    const listaSoportes = Object.entries(soportes).map(([id, s]) => ({ ...s, id }));

    // SOLO PENDIENTES (Excluye 'Entregado')
    const pendientes = listaSoportes
        .filter(s => s.estado !== "Entregado")
        .filter(s => {
            const term = filtro.toLowerCase();
            return s.cliente.toLowerCase().includes(term) || s.numeroSoporte.toString().includes(term);
        })
        .sort((a, b) => {
            // Prioridad visual: Primero los RESUELTOS (Listos para entregar/asignar)
            const aResuelto = /resuelto/i.test(a.estado);
            const bResuelto = /resuelto/i.test(b.estado);
            if (aResuelto && !bResuelto) return -1;
            if (!aResuelto && bResuelto) return 1;
            return 0;
        });

    // --- ACCIONES ---
    const asignarRango = (id: string, rango: string) => {
        update(ref(db_realtime, `soportes/${id}`), { rangoEntrega: rango });
        // La lógica de mover a 'despachos' la manejaría una Cloud Function o se lee desde el otro componente
    };

    const confirmarEntrega = (id: string) => {
        if(!window.confirm("¿Confirmar entrega de este equipo?")) return;
        update(ref(db_realtime, `soportes/${id}`), { 
            estado: "Entregado",
            fechaEntrega: new Date().toISOString()
        });
    };

    // Helper productos
    const renderProductos = (prods: string[] | string) => {
        if(Array.isArray(prods)) return prods.join(", ");
        return prods || "";
    };

    return (
        <div className="max-w-7xl mx-auto px-4 pb-20 pt-10 font-sans bg-slate-50 min-h-screen">
            
            {/* ENCABEZADO */}
            <div className="mb-8 flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 italic uppercase tracking-tighter">
                        Control <span className="text-orange-500">Soportes</span>
                    </h1>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.3em] mt-2">
                        Administración y Entregas
                    </p>
                </div>
                <input 
                    type="text" 
                    placeholder="🔍 BUSCAR..." 
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    className="p-3 bg-white border-2 border-slate-100 rounded-xl font-bold text-sm uppercase outline-none focus:border-orange-400 w-full md:w-64"
                />
            </div>

            {/* TABLA PENDIENTES */}
            <section className="bg-white rounded-[2rem] shadow-xl shadow-blue-900/5 border border-slate-100 overflow-hidden mb-12">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] tracking-widest border-b border-slate-100">
                                <th className="p-5">N° Soporte</th>
                                <th className="p-5">Cliente</th>
                                <th className="p-5">Fecha</th>
                                <th className="p-5 w-1/3">Productos</th>
                                <th className="p-5 text-center">Estado</th>
                                <th className="p-5 text-center">Acción / Rango</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {pendientes.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic font-bold">No hay soportes pendientes</td></tr>
                            ) : (
                                pendientes.map((s) => {
                                    const esResuelto = /resuelto/i.test(s.estado);
                                    return (
                                        <tr key={s.id} className="hover:bg-orange-50/30 transition-colors text-[11px] font-bold text-slate-700">
                                            <td className="p-5 font-mono text-orange-600">#{s.numeroSoporte}</td>
                                            <td className="p-5 uppercase">{s.cliente}</td>
                                            <td className="p-5 text-slate-500">{s.fechaSoporte}</td>
                                            <td className="p-5 text-xs text-slate-500 font-normal truncate max-w-xs" title={renderProductos(s.productos)}>
                                                {renderProductos(s.productos)}
                                            </td>
                                            <td className="p-5 text-center">
                                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${
                                                    esResuelto 
                                                    ? 'bg-green-100 text-green-700 border-green-200' 
                                                    : 'bg-blue-50 text-blue-600 border-blue-100'
                                                }`}>
                                                    {s.estado}
                                                </span>
                                            </td>
                                            <td className="p-5 text-center">
                                                {esResuelto ? (
                                                    <select 
                                                        value={s.rangoEntrega || ""} 
                                                        onChange={(e) => asignarRango(s.id, e.target.value)}
                                                        className="bg-white border-2 border-slate-200 rounded-lg p-2 text-[10px] font-black uppercase outline-none focus:border-orange-400 w-full cursor-pointer hover:border-orange-300 transition-colors"
                                                    >
                                                        <option value="">-- ASIGNAR RANGO --</option>
                                                        {rangos.map(r => <option key={r} value={r}>{r}</option>)}
                                                    </select>
                                                ) : (
                                                    <button 
                                                        onClick={() => confirmarEntrega(s.id)}
                                                        className="bg-slate-800 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-black transition-colors w-full shadow-lg"
                                                    >
                                                        Confirmar Entrega
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

        </div>
    );
};

export default ControlSoportes;