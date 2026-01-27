import React, { useEffect, useState } from 'react';
import { db_realtime } from '../firebase/config';
import { ref, onValue, update, remove } from "firebase/database";
import type { Soporte } from '../types';

// Definimos la prop para recibir la función de navegación desde App.tsx
interface Props {
    onNavigate?: (page: string) => void;
}

const ControlSoportes: React.FC<Props> = ({ onNavigate }) => {
    // -------------------------------------------------------------------------
    // LÓGICA INTACTA
    // -------------------------------------------------------------------------
    const [soportes, setSoportes] = useState<Record<string, Soporte>>({});
    const [filtro, setFiltro] = useState("");
    const [filtroEstado, setFiltroEstado] = useState("");
    
    // Estado para el contador de alertas (Retiros pendientes)
    const [retirosPendientes, setRetirosPendientes] = useState(0);

    // Estado para el Modal de WhatsApp
    const [modalWhatsapp, setModalWhatsapp] = useState<{ open: boolean, soporte: any, nuevoRango: string } | null>(null);

    const rangos = ["Lunes Mañana", "Lunes Tarde", "Martes Mañana", "Martes Tarde", "Miércoles Mañana", "Miércoles Tarde", "Jueves Mañana", "Jueves Tarde", "Viernes Mañana", "Viernes Tarde"];

    useEffect(() => {
        // 1. Escuchar los Soportes del taller
        const unsubSoportes = onValue(ref(db_realtime, 'soportes'), (snapshot) => {
            setSoportes(snapshot.val() || {});
        });

        // 2. Escuchar los Retiros (Ingresos) para la alerta roja
        const unsubRetiros = onValue(ref(db_realtime, 'soportesypagos'), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                // Filtramos solo los que son tipo "Soporte"
                const count = Object.values(data).filter((item: any) => item.tipo === "Soporte").length;
                setRetirosPendientes(count);
            } else {
                setRetirosPendientes(0);
            }
        });

        return () => { unsubSoportes(); unsubRetiros(); };
    }, []);

    // --- LÓGICA DE FILTRADO Y ORDENAMIENTO ---
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
    
    const handleRangoChange = (soporte: any, nuevoRango: string) => {
        if (nuevoRango === "") {
            update(ref(db_realtime, `soportes/${soporte.id}`), { rangoEntrega: "" });
            return;
        }
        if (soporte.telefono) {
            setModalWhatsapp({ open: true, soporte, nuevoRango });
        } else {
            update(ref(db_realtime, `soportes/${soporte.id}`), { rangoEntrega: nuevoRango });
        }
    };

    const confirmarAsignacion = (enviarWhatsapp: boolean) => {
        if (!modalWhatsapp) return;
        const { soporte, nuevoRango } = modalWhatsapp;

        // 1. Creamos el objeto de actualización
        const updates: any = { rangoEntrega: nuevoRango };

        if (enviarWhatsapp) {
            const telefonoStr = soporte.telefono ? String(soporte.telefono) : "";
            const telefonoLimpio = telefonoStr.replace(/\D/g, ''); 
            
            if (telefonoLimpio) {
                const telefonoFull = telefonoLimpio.startsWith("54") ? telefonoLimpio : `549${telefonoLimpio}`;
                let rangoAmigable = nuevoRango;
                const partesRango = nuevoRango.split(" ");
                if (partesRango.length === 2) {
                    const [dia, turno] = partesRango;
                    if (turno === "Mañana") rangoAmigable = `${dia} por la mañana`;
                    else if (turno === "Tarde") rangoAmigable = `${dia} por la tarde`;
                }

                let itemsTexto = "";
                if (Array.isArray(soporte.productos)) {
                    itemsTexto = soporte.productos.map((p: string) => `• ${p}`).join('\n');
                } else if (typeof soporte.productos === 'string') {
                    itemsTexto = `• ${soporte.productos}`;
                } else {
                    itemsTexto = "• Equipo en reparación";
                }

                const mensaje = `Hola *${soporte.cliente}*. 👋\n\nNos comunicamos para informarte que el día *${rangoAmigable}* estaremos entregando tu *Soporte N° ${soporte.numeroSoporte}*.\n\n🛠️ *Detalle del servicio:*\n${itemsTexto}\n\nSaludos, *BIPOKIDS*.`;
                
                const url = `https://web.whatsapp.com/send?phone=${telefonoFull}&text=${encodeURIComponent(mensaje)}`;
                window.open(url, '_blank');
                
                // 2. Si se abre WhatsApp exitosamente, marcamos como notificado
                updates.notificado = true;
            } else {
                alert("Error: El teléfono no tiene un formato válido.");
                updates.notificado = false;
            }
        } else {
            // 3. Si es asignación silenciosa, reseteamos el estado a false
            updates.notificado = false;
        }

        // 4. Actualizamos la base de datos con el rango Y el estado de notificación
        update(ref(db_realtime, `soportes/${soporte.id}`), updates);

        setModalWhatsapp(null);
    };

    const toggleEstadoSoporte = (id: string, estadoActual: string) => {
        const esResuelto = estadoActual === "Resuelto";
        const nuevoEstado = esResuelto ? "Pendiente" : "Resuelto";
        const mensaje = esResuelto 
            ? "¿El equipo NO está listo? Se volverá a marcar como PENDIENTE."
            : "¿Confirmar que el equipo está reparado y LISTO?";

        if(!window.confirm(mensaje)) return;

        const updates: any = { estado: nuevoEstado };
        if (esResuelto) updates.rangoEntrega = ""; 

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

    // -------------------------------------------------------------------------
    // RENDERIZADO FUTURISTA
    // -------------------------------------------------------------------------
    return (
        <div className="min-h-screen relative font-sans text-cyan-50 bg-[#050b14] selection:bg-violet-500 selection:text-black pb-20 pt-10 px-4">
            
            {/* GRID DE FONDO DECORATIVO */}
            <div className="fixed inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #1e293b 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

            <div className="max-w-[1400px] mx-auto relative z-10">
                
                {/* ENCABEZADO UNIFICADO */}
                <header className="mb-10 flex flex-col xl:flex-row justify-between items-end gap-6 border-b border-violet-900/50 pb-6">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tighter mb-2 uppercase drop-shadow-[0_0_10px_rgba(139,92,246,0.3)]">
                            CONTROL <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-500">SOPORTES</span>
                        </h1>
                        <p className="text-violet-400 font-mono text-xs uppercase tracking-[0.3em]">Módulo de Reparaciones & Garantías</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto items-center">
                        
                        {/* BOTÓN ALERTA RETIROS */}
                        <button 
                            onClick={() => onNavigate && onNavigate('retiros')}
                            className="relative bg-[#0f172a] border border-violet-500/30 px-6 py-4 rounded-xl shadow-[0_0_15px_rgba(139,92,246,0.1)] hover:shadow-[0_0_25px_rgba(139,92,246,0.3)] hover:bg-violet-900/20 transition-all flex items-center gap-3 group min-w-[140px] justify-center"
                            title="Ver equipos retirados por choferes"
                        >
                            <span className="text-xl group-hover:scale-110 transition-transform">📥</span>
                            <span className="font-bold font-mono text-xs text-violet-300 uppercase tracking-wider hidden sm:block">Retiros</span>
                            
                            {/* Badge Rojo de Alerta (Holográfico) */}
                            {retirosPendientes > 0 && (
                                <span className="absolute -top-2 -right-2 bg-red-600/90 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full shadow-[0_0_10px_red] animate-pulse">
                                    {retirosPendientes}
                                </span>
                            )}
                        </button>

                        {/* Buscador Moderno */}
                        <div className="relative flex-1 min-w-[280px] group">
                            <span className="absolute left-4 top-4 text-violet-700 group-focus-within:text-violet-400 transition-colors">🔍</span>
                            <input 
                                type="text" 
                                placeholder="BUSCAR ID O CLIENTE..." 
                                value={filtro}
                                onChange={(e) => setFiltro(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-[#0f172a] border border-cyan-900 rounded-xl shadow-inner focus:border-violet-500 focus:ring-1 focus:ring-violet-500 focus:shadow-[0_0_15px_rgba(139,92,246,0.3)] outline-none font-mono text-sm text-violet-100 placeholder-slate-700 transition-all uppercase tracking-wider"
                            />
                        </div>

                        {/* Selector de Estado */}
                        <div className="relative min-w-[200px] group">
                            <span className="absolute left-4 top-4 text-violet-700 group-focus-within:text-violet-400 transition-colors">📂</span>
                            <select 
                                value={filtroEstado}
                                onChange={(e) => setFiltroEstado(e.target.value)}
                                className="w-full pl-12 pr-10 py-4 bg-[#0f172a] border border-cyan-900 rounded-xl shadow-inner focus:border-violet-500 focus:ring-1 focus:ring-violet-500 focus:shadow-[0_0_15px_rgba(139,92,246,0.3)] outline-none transition-all font-mono font-bold text-xs uppercase text-violet-200 appearance-none cursor-pointer"
                            >
                                <option value="">Estado: Todos</option>
                                <option value="Pendiente">Pendiente</option>
                                <option value="En Taller">En Taller</option>
                                <option value="Resuelto">Resuelto</option>
                            </select>
                            <span className="absolute right-4 top-4 text-violet-800 text-xs pointer-events-none">▼</span>
                        </div>
                    </div>
                </header>

                {/* TABLA PENDIENTES */}
                <section className="bg-[#0f172a]/40 backdrop-blur-sm rounded-3xl border border-violet-900/30 overflow-hidden mb-12 shadow-2xl relative">
                    {/* Decoration Line */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-violet-500 to-transparent opacity-50"></div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-900/80 text-violet-400 font-mono text-[10px] uppercase tracking-[0.2em] border-b border-violet-900/50">
                                    <th className="p-5">Soporte</th>
                                    <th className="p-5">Cliente</th>
                                    <th className="p-5">Ingreso</th>
                                    <th className="p-5 w-1/3">Componentes</th>
                                    <th className="p-5 text-center">Diagnóstico</th>
                                    <th className="p-5 text-center">Protocolo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-violet-900/20 font-mono text-xs">
                                {pendientes.length === 0 ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-slate-600 font-mono italic">:: NO DATA FOUND ::</td></tr>
                                ) : (
                                    pendientes.map((s) => {
                                        const esResuelto = s.estado === "Resuelto";
                                        return (
                                            <tr key={s.id} className="hover:bg-violet-900/10 transition-colors group">
                                                <td className="p-5 text-orange-400 font-bold group-hover:text-orange-300 group-hover:shadow-[0_0_10px_rgba(249,115,22,0.2)] transition-all">
                                                    #{s.numeroSoporte}
                                                </td>
                                                <td className="p-5 uppercase font-bold text-slate-300">
                                                    {s.cliente}
                                                    {/* Indicador visual de teléfono */}
                                                    {(s as any).telefono && <span className="ml-2 text-[10px] inline-block align-middle shadow-[0_0_5px_#10b981] bg-emerald-500/20 text-emerald-400 px-1.5 rounded border border-emerald-500/50">📞 LINK</span>}
                                                </td>
                                                <td className="p-5 text-slate-500 text-[10px]">{s.fechaSoporte}</td>
                                                <td className="p-5 text-xs text-slate-400 font-normal truncate max-w-xs uppercase" title={renderProductos(s.productos)}>
                                                    <span className="text-violet-600 mr-1">›</span> {renderProductos(s.productos)}
                                                </td>
                                                <td className="p-5 text-center">
                                                    <span className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider border ${
                                                        esResuelto 
                                                        ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]' 
                                                        : 'bg-orange-900/20 text-orange-400 border-orange-500/30'
                                                    }`}>
                                                        {s.estado}
                                                    </span>
                                                </td>
                                                <td className="p-5 text-center">
                                                    <div className="flex gap-2 justify-center items-center">
                                                        
                                                        {esResuelto && (
                                                            <select 
                                                                value={s.rangoEntrega || ""} 
                                                                onChange={(e) => handleRangoChange(s, e.target.value)}
                                                                className="bg-slate-900 border border-emerald-900 rounded-lg p-2 text-[10px] font-mono text-emerald-300 uppercase outline-none focus:border-emerald-500 focus:shadow-[0_0_10px_rgba(16,185,129,0.3)] cursor-pointer hover:border-emerald-500 transition-colors w-32"
                                                            >
                                                                <option value="">🚚 ASIGNAR</option>
                                                                {rangos.map(r => <option key={r} value={r}>{r}</option>)}
                                                            </select>
                                                        )}

                                                        <button 
                                                            onClick={() => toggleEstadoSoporte(s.id, s.estado)}
                                                            className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase transition-all shadow-sm flex items-center gap-1 border ${
                                                                esResuelto 
                                                                ? 'bg-yellow-900/20 text-yellow-400 border-yellow-500/50 hover:bg-yellow-500/20 hover:shadow-[0_0_10px_yellow]' 
                                                                : 'bg-emerald-600 text-black border-emerald-400 hover:bg-emerald-400 hover:shadow-[0_0_15px_#10b981]'
                                                            }`}
                                                            title={esResuelto ? "Revertir a Pendiente" : "Marcar como Resuelto"}
                                                        >
                                                            {esResuelto ? (
                                                                <>⏪ <span className="hidden xl:inline">PENDIENTE</span></>
                                                            ) : (
                                                                <>✅ <span className="hidden xl:inline">RESUELTO</span></>
                                                            )}
                                                        </button>
                                                        
                                                        <button 
                                                            onClick={() => eliminarSoporte(s.id)}
                                                            className="bg-red-900/20 text-red-500 border border-red-500/30 px-3 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-red-500 hover:text-white hover:shadow-[0_0_15px_red] transition-all"
                                                            title="Eliminar Registro"
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

                {/* MODAL WHATSAPP */}
                {modalWhatsapp && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                        <div className="bg-[#0f172a] rounded-[2rem] p-8 w-full max-w-sm shadow-[0_0_50px_rgba(139,92,246,0.3)] border border-violet-900 animate-in zoom-in duration-200">
                            <div className="text-center mb-6">
                                <span className="text-4xl drop-shadow-[0_0_10px_rgba(16,185,129,0.8)]">📱</span>
                                <h3 className="text-xl font-black text-white mt-4 uppercase tracking-wider">Comm Link Detectado</h3>
                                <p className="text-xs font-mono text-emerald-400 mt-2">Objetivo con protocolo de comunicación.</p>
                            </div>
                            
                            <div className="space-y-3">
                                <button 
                                    onClick={() => confirmarAsignacion(true)}
                                    className="w-full p-4 bg-emerald-500 text-black rounded-xl font-bold font-mono shadow-[0_0_15px_#10b981] hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 uppercase text-xs"
                                >
                                    <span>💬</span> Asignar + Enviar Msg
                                </button>
                                
                                <button 
                                    onClick={() => confirmarAsignacion(false)}
                                    className="w-full p-4 bg-transparent text-slate-400 border border-slate-600 rounded-xl font-bold font-mono hover:border-slate-400 hover:text-white transition-all uppercase text-xs"
                                >
                                    Solo Asignar (Silent)
                                </button>
                            </div>
                            
                            <button 
                                onClick={() => setModalWhatsapp(null)}
                                className="w-full mt-6 text-xs font-bold font-mono text-slate-600 uppercase hover:text-red-400 transition-colors"
                            >
                                Abortar
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default ControlSoportes;