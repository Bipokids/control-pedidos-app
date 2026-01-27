import React, { useEffect, useState } from 'react';
import { db_realtime } from '../firebase/config';
import { ref, onValue, update, remove } from "firebase/database";

const Pagos: React.FC = () => {
    const [pagos, setPagos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Estados para filtros
    const [filtroCliente, setFiltroCliente] = useState("");
    const [filtroFecha, setFiltroFecha] = useState("");
    const [fechasDisponibles, setFechasDisponibles] = useState<string[]>([]);

    useEffect(() => {
        const unsubscribe = onValue(ref(db_realtime, 'soportesypagos'), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const lista = Object.entries(data)
                    .map(([id, val]: any) => ({ ...val, id }))
                    .filter((item: any) => item.tipo === "Pago")
                    .sort((a, b) => (a.estado === 'Registrado' ? 1 : -1)); // Ordenar: Pendientes primero
                
                setPagos(lista);

                // Extraer fechas únicas
                const fechasUnicas = Array.from(new Set(lista.map((p: any) => p.fecha?.split(' ')[0]))).sort().reverse();
                setFechasDisponibles(fechasUnicas as string[]);
            } else {
                setPagos([]);
                setFechasDisponibles([]);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // --- FILTRADO DE DATOS ---
    const pagosFiltrados = pagos.filter(p => {
        const matchCliente = p.cliente.toLowerCase().includes(filtroCliente.toLowerCase());
        const matchFecha = filtroFecha ? p.fecha?.startsWith(filtroFecha) : true;
        return matchCliente && matchFecha;
    });

    // --- ACCIONES ---
    const marcarRegistrado = async (id: string) => {
        if (window.confirm("¿Confirmar que este pago ha sido ingresado en caja?")) {
            try {
                await update(ref(db_realtime, `soportesypagos/${id}`), {
                    estado: "Registrado",
                    fechaRegistro: new Date().toISOString()
                });
            } catch (error) {
                alert("Error al actualizar.");
            }
        }
    };

    const eliminarPago = async (id: string) => {
        if (window.confirm("⚠️ PROTOCOLO DE ELIMINACIÓN: ¿Estás seguro de borrar este registro financiero?")) {
            try {
                await remove(ref(db_realtime, `soportesypagos/${id}`));
            } catch (error) {
                alert("Error al eliminar.");
            }
        }
    };

    const formatMoney = (val: string | undefined) => {
        if (!val) return "$ 0";
        return `$ ${val}`;
    };

    if (loading) return <div className="min-h-screen bg-[#050b14] flex items-center justify-center"><div className="text-cyan-500 font-mono animate-pulse">SYNCING FINANCIAL DATA...</div></div>;

    return (
        <div className="min-h-screen relative font-sans text-cyan-50 bg-[#050b14] selection:bg-emerald-500 selection:text-black pb-20 pt-10 px-4">
            
            {/* GRID DE FONDO DECORATIVO */}
            <div className="fixed inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #1e293b 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

            <div className="max-w-7xl mx-auto relative z-10">
                
                {/* ENCABEZADO CON FILTROS */}
                <header className="mb-12 flex flex-col xl:flex-row justify-between items-end gap-6 border-b border-emerald-900/50 pb-6">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tighter mb-2 uppercase drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                            CONTROL <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500">PAGOS</span>
                        </h1>
                        <p className="text-emerald-600 font-mono text-xs uppercase tracking-[0.3em]">Módulo de Rendición de Valores</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
                        
                        {/* Buscador Cliente */}
                        <div className="relative flex-1 min-w-[250px] group">
                            <span className="absolute left-4 top-4 text-emerald-700 group-focus-within:text-emerald-400 transition-colors">🔍</span>
                            <input 
                                type="text" 
                                placeholder="BUSCAR CLIENTE..." 
                                value={filtroCliente}
                                onChange={(e) => setFiltroCliente(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-[#0f172a] border border-emerald-900 rounded-xl shadow-inner focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:shadow-[0_0_15px_rgba(16,185,129,0.3)] outline-none font-mono text-sm text-emerald-100 placeholder-emerald-900 transition-all uppercase tracking-wider"
                            />
                        </div>

                        {/* Selector Fecha */}
                        <div className="relative min-w-[200px] group">
                            <span className="absolute left-4 top-4 text-emerald-700 group-focus-within:text-emerald-400 transition-colors">📅</span>
                            <select 
                                value={filtroFecha}
                                onChange={(e) => setFiltroFecha(e.target.value)}
                                className="w-full pl-12 pr-10 py-4 bg-[#0f172a] border border-emerald-900 rounded-xl shadow-inner focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:shadow-[0_0_15px_rgba(16,185,129,0.3)] outline-none transition-all font-mono font-bold text-xs uppercase text-emerald-200 appearance-none cursor-pointer"
                            >
                                <option value="">Todas las Fechas</option>
                                {fechasDisponibles.map(date => (
                                    <option key={date} value={date}>{date}</option>
                                ))}
                            </select>
                            <span className="absolute right-4 top-4 text-emerald-800 text-xs pointer-events-none">▼</span>
                        </div>

                        {/* KPI Rápido */}
                        <div className="hidden xl:flex bg-emerald-900/10 px-6 py-4 rounded-xl border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)] items-center gap-4">
                            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest font-mono">Total</span>
                            <span className="text-2xl font-black text-white font-mono">{pagosFiltrados.filter(p => p.estado !== "Registrado").length}</span>
                        </div>
                    </div>
                </header>

                {/* GRILLA DE PAGOS FILTRADOS */}
                {pagosFiltrados.length === 0 ? (
                    <div className="text-center py-20 bg-[#0f172a]/50 rounded-[2.5rem] border border-dashed border-emerald-900/50">
                        <p className="text-4xl mb-4 grayscale opacity-50">💰</p>
                        <p className="text-emerald-700 font-mono font-bold text-sm tracking-widest uppercase">:: NO FINANCIAL DATA FOUND ::</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {pagosFiltrados.map((pago) => {
                            const esRegistrado = pago.estado === "Registrado";
                            const estadoControl = pago.estadoControl || "A Controlar"; 
                            const esControlado = estadoControl === "Controlado";
                            const sobreCerrado = pago.sobreCerrado || false;
                            
                            return (
                                <div 
                                    key={pago.id} 
                                    className={`p-6 rounded-[2rem] border flex flex-col transition-all duration-300 relative overflow-hidden group ${
                                        esRegistrado 
                                            ? 'bg-[#0f172a]/30 border-slate-800 opacity-60 hover:opacity-100 grayscale-[0.8] hover:grayscale-0' 
                                            : 'bg-[#0f172a]/80 border-emerald-900/50 shadow-[0_0_20px_rgba(16,185,129,0.1)] hover:border-emerald-500/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.2)] hover:-translate-y-1'
                                    }`}
                                >
                                    {/* Decorative Line */}
                                    <div className={`absolute top-0 left-0 w-full h-1 ${esRegistrado ? 'bg-slate-700' : 'bg-gradient-to-r from-emerald-500 to-teal-400'}`}></div>

                                    {/* Header Tarjeta */}
                                    <div className="flex justify-between items-start mb-6 border-b border-emerald-900/30 pb-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest font-mono">Cliente</p>
                                                {/* Badge Sobre Cerrado */}
                                                {sobreCerrado && (
                                                    <span className="bg-amber-900/30 text-amber-400 px-2 py-0.5 rounded text-[9px] font-black uppercase flex items-center gap-1 border border-amber-500/50 shadow-[0_0_5px_rgba(251,191,36,0.2)] animate-pulse">
                                                        ✉️ SOBRE CERRADO
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="text-lg font-black text-white uppercase leading-tight truncate max-w-[180px] tracking-wide" title={pago.cliente}>
                                                {pago.cliente}
                                            </h3>
                                        </div>
                                        <div className="text-right flex flex-col gap-2 items-end">
                                            {esRegistrado ? (
                                                <span className="bg-slate-800 text-slate-400 px-3 py-1 rounded text-[10px] font-black uppercase tracking-wide font-mono border border-slate-700">
                                                    REGISTRADO
                                                </span>
                                            ) : (
                                                <span className="bg-emerald-900/40 text-emerald-400 px-3 py-1 rounded text-[10px] font-black uppercase tracking-wide font-mono border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)] animate-pulse">
                                                    NEW INPUT
                                                </span>
                                            )}
                                            
                                            {/* Badge Estado Control */}
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border font-mono ${
                                                esControlado 
                                                    ? 'bg-blue-900/30 text-blue-400 border-blue-500/30' 
                                                    : 'bg-yellow-900/20 text-yellow-500 border-yellow-500/30'
                                            }`}>
                                                {estadoControl}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Detalles Financieros (Digital Display Look) */}
                                    <div className="space-y-3 flex-1 mb-6">
                                        {/* Efectivo */}
                                        <div className="flex justify-between items-center bg-[#050b14] p-4 rounded-xl border border-emerald-900/50 shadow-inner">
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg grayscale brightness-150">💵</span>
                                                <span className="text-[10px] font-bold text-emerald-600 uppercase font-mono tracking-widest">EFECTIVO</span>
                                            </div>
                                            <span className="text-lg font-black text-emerald-400 font-mono drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]">{formatMoney(pago.montoEfectivo)}</span>
                                        </div>

                                        {/* Cheques */}
                                        <div className="flex justify-between items-center bg-[#050b14] p-4 rounded-xl border border-cyan-900/50 shadow-inner">
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg grayscale brightness-150">🏦</span>
                                                <span className="text-[10px] font-bold text-cyan-600 uppercase font-mono tracking-widest">CHEQUES</span>
                                            </div>
                                            <span className="text-lg font-black text-cyan-400 font-mono drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]">{formatMoney(pago.montoCheque)}</span>
                                        </div>
                                    </div>

                                    {/* Info Extra */}
                                    <div className="flex justify-between items-center mb-6 text-xs text-slate-500 font-mono uppercase">
                                        <span className="flex items-center gap-1 text-slate-400"><span className="text-emerald-700">CHOFER:</span> {pago.chofer}</span>
                                        <span className="text-emerald-800">{pago.fecha}</span>
                                    </div>

                                    {/* Botones de Acción */}
                                    <div className="flex gap-3 mt-auto">
                                        {!esRegistrado && (
                                            <button 
                                                onClick={() => marcarRegistrado(pago.id)}
                                                className="flex-1 py-3 bg-emerald-600 text-black rounded-xl font-black font-mono uppercase text-[10px] tracking-widest hover:bg-emerald-400 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] active:scale-95"
                                            >
                                                ✅ Confirm Deposit
                                            </button>
                                        )}
                                        
                                        <button 
                                            onClick={() => eliminarPago(pago.id)}
                                            className={`py-3 px-4 border rounded-xl font-black uppercase text-[10px] transition-all font-mono ${
                                                esRegistrado 
                                                    ? 'w-full bg-transparent border-red-900/50 text-red-500 hover:bg-red-900/20' 
                                                    : 'bg-transparent border-slate-700 text-slate-500 hover:text-red-400 hover:border-red-900'
                                            }`}
                                            title="Eliminar registro"
                                        >
                                            🗑️ {esRegistrado && "ELIMINAR"}
                                        </button>
                                    </div>

                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Pagos;