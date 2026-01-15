import React, { useEffect, useState } from 'react';
import { db_realtime } from '../firebase/config';
import { ref, onValue, update, remove } from "firebase/database";
import type { Soporte } from '../types';

const ControlSoportes: React.FC = () => {
    const [soportes, setSoportes] = useState<Record<string, Soporte>>({});
    const [filtro, setFiltro] = useState("");
    const [filtroEstado, setFiltroEstado] = useState("");

    const rangos = ["Lunes Mañana", "Lunes Tarde", "Martes Mañana", "Martes Tarde", "Miércoles Mañana", "Miércoles Tarde", "Jueves Mañana", "Jueves Tarde", "Viernes Mañana", "Viernes Tarde"];

    useEffect(() => {
        const unsubscribe = onValue(ref(db_realtime, 'soportes'), (snapshot) => {
            setSoportes(snapshot.val() || {});
        });
        return () => unsubscribe();
    }, []);

    // --- LÓGICA DE DATOS ---
    const listaSoportes = Object.entries(soportes).map(([id, s]) => ({ ...s, id }));

    const pendientes = listaSoportes
        .filter(s => s.estado !== "Entregado")
        .filter(s => {
            const term = filtro.toLowerCase();
            const matchTexto = s.cliente.toLowerCase().includes(term) || s.numeroSoporte.toString().includes(term);
            const matchEstado = filtroEstado ? s.estado === filtroEstado : true;
            return matchTexto && matchEstado;
        })
        .sort((a, b) => {
            const aResuelto = /resuelto/i.test(a.estado);
            const bResuelto = /resuelto/i.test(b.estado);
            if (aResuelto && !bResuelto) return -1;
            if (!aResuelto && bResuelto) return 1;
            return 0;
        });

    // --- ACCIONES ---
    
    const asignarRango = (id: string, rango: string) => {
        update(ref(db_realtime, `soportes/${id}`), { rangoEntrega: rango });
    };

    // FUNCIÓN DUAL (PENDIENTE <-> RESUELTO)
    const toggleEstadoSoporte = (id: string, estadoActual: string) => {
        const esResuelto = estadoActual === "Resuelto";
        const nuevoEstado = esResuelto ? "Pendiente" : "Resuelto";
        
        const mensaje = esResuelto 
            ? "¿El equipo NO está listo? Se volverá a marcar como PENDIENTE."
            : "¿Confirmar que el equipo está reparado y LISTO?";

        if(!window.confirm(mensaje)) return;

        const updates: any = { estado: nuevoEstado };
        
        // Si volvemos a pendiente, limpiamos el rango para que no salga en logística por error
        if (esResuelto) {
            updates.rangoEntrega = ""; 
        }

        update(ref(db_realtime, `soportes/${id}`), updates);
    };

    const eliminarSoporte = (id: string) => {
        if(!window.confirm("⚠️ ATENCIÓN: ¿Estás seguro de ELIMINAR este soporte permanentemente?")) return;
        remove(ref(db_realtime, `soportes/${id}`));
    };

    const renderProductos = (prods: string[] | string) => {
        if(Array.isArray(prods)) return prods.join(", ");
        return prods || "";
    };

    return (
        <div className="max-w-7xl mx-auto px-4 pb-20 pt-10 font-sans bg-slate-50 min-h-screen">
            
            {/* ENCABEZADO UNIFICADO */}
            <header className="mb-10 flex flex-col xl:flex-row justify-between items-end gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">
                        Control <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">Soportes</span>
                    </h1>
                    <p className="text-slate-500 font-medium text-sm">Administración y entregas técnicas.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
                    <div className="relative flex-1 min-w-[280px]">
                        <span className="absolute left-4 top-3.5 text-slate-400">🔍</span>
                        <input 
                            type="text" 
                            placeholder="Buscar cliente, n°..." 
                            value={filtro}
                            onChange={(e) => setFiltro(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md focus:shadow-lg focus:border-orange-400 outline-none transition-all font-bold text-sm text-slate-600 placeholder:text-slate-300"
                        />
                    </div>

                    <div className="relative min-w-[200px]">
                        <span className="absolute left-4 top-3.5 text-slate-400">📂</span>
                        <select 
                            value={filtroEstado}
                            onChange={(e) => setFiltroEstado(e.target.value)}
                            className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md focus:shadow-lg focus:border-orange-400 outline-none transition-all font-bold text-sm text-slate-600 appearance-none cursor-pointer"
                        >
                            <option value="">Todos los Estados</option>
                            <option value="Pendiente">Pendiente</option>
                            <option value="En Taller">En Taller</option>
                            <option value="Resuelto">Resuelto</option>
                        </select>
                        <span className="absolute right-4 top-4 text-slate-400 text-xs pointer-events-none">▼</span>
                    </div>
                </div>
            </header>

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
                                <th className="p-5 text-center">Acciones / Logística</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {pendientes.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic font-bold">No hay soportes pendientes</td></tr>
                            ) : (
                                pendientes.map((s) => {
                                    const esResuelto = s.estado === "Resuelto";
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
                                                    : 'bg-orange-50 text-orange-600 border-orange-100'
                                                }`}>
                                                    {s.estado}
                                                </span>
                                            </td>
                                            <td className="p-5 text-center">
                                                <div className="flex gap-2 justify-center items-center">
                                                    
                                                    {/* 1. SELECTOR DE RANGO (Solo si es Resuelto) */}
                                                    {esResuelto && (
                                                        <select 
                                                            value={s.rangoEntrega || ""} 
                                                            onChange={(e) => asignarRango(s.id, e.target.value)}
                                                            className="bg-white border-2 border-green-100 rounded-lg p-2 text-[10px] font-black uppercase outline-none focus:border-green-400 cursor-pointer hover:border-green-300 transition-colors w-32"
                                                        >
                                                            <option value="">🚚 ASIGNAR</option>
                                                            {rangos.map(r => <option key={r} value={r}>{r}</option>)}
                                                        </select>
                                                    )}

                                                    {/* 2. BOTÓN DE ESTADO (DUAL) */}
                                                    <button 
                                                        onClick={() => toggleEstadoSoporte(s.id, s.estado)}
                                                        className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-colors shadow-sm flex items-center gap-1 ${
                                                            esResuelto 
                                                                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border border-yellow-200' 
                                                                : 'bg-green-500 text-white hover:bg-green-600 border border-green-600'
                                                        }`}
                                                        title={esResuelto ? "Volver a Pendiente" : "Marcar como Resuelto"}
                                                    >
                                                        {esResuelto ? (
                                                            <>⏪ <span className="hidden xl:inline">Pendiente</span></>
                                                        ) : (
                                                            <>✅ <span className="hidden xl:inline">Resuelto</span></>
                                                        )}
                                                    </button>
                                                    
                                                    {/* 3. BOTÓN ELIMINAR */}
                                                    <button 
                                                        onClick={() => eliminarSoporte(s.id)}
                                                        className="bg-red-50 text-red-500 border border-red-100 px-3 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-red-500 hover:text-white transition-colors shadow-sm"
                                                        title="Eliminar Soporte"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
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