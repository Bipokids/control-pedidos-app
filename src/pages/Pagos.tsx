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
                    .sort((a, b) => (a.estado === 'Registrado' ? 1 : -1));
                
                setPagos(lista);

                // Extraer fechas únicas para el selector
                // Asumimos formato dd/mm/yyyy hh:mm o similar. Cortamos solo la fecha (primera parte)
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
        if (window.confirm("⚠️ ¿Estás seguro de ELIMINAR este registro de pago permanentemente?")) {
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

    if (loading) return <div className="p-10 text-center text-slate-400 font-bold animate-pulse">Cargando Pagos...</div>;

    return (
        <div className="max-w-7xl mx-auto px-4 py-10 font-sans min-h-screen bg-slate-50">
            
            {/* ENCABEZADO CON FILTROS */}
            <header className="mb-10 flex flex-col xl:flex-row justify-between items-end gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">
                        Control <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-green-600">Pagos</span>
                    </h1>
                    <p className="text-slate-500 font-medium text-sm">Rendición de cobranzas de choferes.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
                    
                    {/* Buscador Cliente */}
                    <div className="relative flex-1 min-w-[250px]">
                        <span className="absolute left-4 top-3.5 text-slate-400">🔍</span>
                        <input 
                            type="text" 
                            placeholder="Buscar cliente..." 
                            value={filtroCliente}
                            onChange={(e) => setFiltroCliente(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md focus:shadow-lg focus:border-emerald-400 outline-none transition-all font-bold text-sm text-slate-600 placeholder:text-slate-300"
                        />
                    </div>

                    {/* Selector Fecha */}
                    <div className="relative min-w-[200px]">
                        <span className="absolute left-4 top-3.5 text-slate-400">📅</span>
                        <select 
                            value={filtroFecha}
                            onChange={(e) => setFiltroFecha(e.target.value)}
                            className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md focus:shadow-lg focus:border-emerald-400 outline-none transition-all font-bold text-sm text-slate-600 appearance-none cursor-pointer"
                        >
                            <option value="">Todas las Fechas</option>
                            {fechasDisponibles.map(date => (
                                <option key={date} value={date}>{date}</option>
                            ))}
                        </select>
                        <span className="absolute right-4 top-4 text-slate-400 text-xs pointer-events-none">▼</span>
                    </div>

                    {/* KPI Rápido */}
                    <div className="hidden xl:flex bg-white px-5 py-2 rounded-2xl border border-slate-100 shadow-sm items-center gap-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</span>
                        <span className="text-2xl font-black text-slate-800">{pagosFiltrados.length}</span>
                    </div>
                </div>
            </header>

            {/* GRILLA DE PAGOS FILTRADOS */}
            {pagosFiltrados.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                    <p className="text-4xl mb-4">💰</p>
                    <p className="text-slate-400 font-bold text-lg">No se encontraron pagos con ese criterio</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pagosFiltrados.map((pago) => {
                        const esRegistrado = pago.estado === "Registrado";
                        
                        return (
                            <div 
                                key={pago.id} 
                                className={`p-6 rounded-[2rem] shadow-lg border flex flex-col transition-all duration-300 ${
                                    esRegistrado 
                                        ? 'bg-slate-100 border-slate-200 opacity-80' 
                                        : 'bg-white border-slate-100 shadow-emerald-100/50 hover:-translate-y-1 hover:shadow-xl'
                                }`}
                            >
                                {/* Header Tarjeta */}
                                <div className="flex justify-between items-start mb-6 border-b border-dashed border-slate-200 pb-4">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cliente</p>
                                        <h3 className="text-lg font-black text-slate-800 uppercase leading-tight truncate max-w-[180px]" title={pago.cliente}>
                                            {pago.cliente}
                                        </h3>
                                    </div>
                                    <div className="text-right">
                                        {esRegistrado ? (
                                            <span className="bg-slate-200 text-slate-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide">
                                                Archivado
                                            </span>
                                        ) : (
                                            <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide animate-pulse">
                                                Nuevo
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Detalles Financieros */}
                                <div className="space-y-3 flex-1 mb-6">
                                    {/* Efectivo */}
                                    <div className="flex justify-between items-center bg-green-50/50 p-3 rounded-xl border border-green-50">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">💵</span>
                                            <span className="text-xs font-bold text-green-800 uppercase">Efectivo</span>
                                        </div>
                                        <span className="text-lg font-black text-green-700">{formatMoney(pago.montoEfectivo)}</span>
                                    </div>

                                    {/* Cheques */}
                                    <div className="flex justify-between items-center bg-blue-50/50 p-3 rounded-xl border border-blue-50">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">🏦</span>
                                            <span className="text-xs font-bold text-blue-800 uppercase">Cheques</span>
                                        </div>
                                        <span className="text-lg font-black text-blue-700">{formatMoney(pago.montoCheque)}</span>
                                    </div>
                                </div>

                                {/* Info Extra */}
                                <div className="flex justify-between items-center mb-6 text-xs text-slate-400 font-bold">
                                    <span className="flex items-center gap-1">🚚 {pago.chofer}</span>
                                    <span className="font-mono">{pago.fecha}</span>
                                </div>

                                {/* Botones de Acción */}
                                <div className="flex gap-3 mt-auto">
                                    {!esRegistrado && (
                                        <button 
                                            onClick={() => marcarRegistrado(pago.id)}
                                            className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-600 transition-colors shadow-lg active:scale-95"
                                        >
                                            ✅ Registrar
                                        </button>
                                    )}
                                    
                                    <button 
                                        onClick={() => eliminarPago(pago.id)}
                                        className={`py-3 px-4 border rounded-xl font-black uppercase text-[10px] transition-colors ${
                                            esRegistrado 
                                                ? 'w-full bg-white border-red-200 text-red-500 hover:bg-red-50' 
                                                : 'bg-white border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200'
                                        }`}
                                        title="Eliminar registro"
                                    >
                                        🗑️ {esRegistrado && "Eliminar"}
                                    </button>
                                </div>

                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Pagos;