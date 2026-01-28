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

    // --- Estado para el Modal de Control ---
    const [modalControl, setModalControl] = useState<{ open: boolean, pago: any | null }>({ open: false, pago: null });
    const [valoresControl, setValoresControl] = useState({
        realEfectivo: "",
        realCheques: "",
        observaciones: ""
    });

    useEffect(() => {
        const unsubscribe = onValue(ref(db_realtime, 'soportesypagos'), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const lista = Object.entries(data)
                    .map(([id, val]: any) => ({ ...val, id }))
                    .filter((item: any) => item.tipo === "Pago")
                    .sort((a, b) => (a.estado === 'Registrado' ? 1 : -1)); 
                
                setPagos(lista);

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

    // --- LÓGICA DEL MODAL Y CÁLCULOS ---

    // 1. Convertir string con puntos a número puro para cálculos (ej: "1.000" -> 1000)
    const limpiarValor = (valor: any) => {
        if (!valor) return 0;
        const valorString = String(valor).replace(/\./g, ''); // Elimina puntos
        return parseFloat(valorString) || 0;
    };

    // 2. Convertir número o string a formato visual con puntos (ej: 1000 -> "1.000")
    const formatearMiles = (valor: any) => {
        if (!valor) return "";
        // Primero limpiamos para asegurar que solo formateamos números
        const numero = limpiarValor(valor);
        return new Intl.NumberFormat('es-AR').format(numero);
    };

    // Handler para inputs: Formatea automáticamente mientras escribes
    const handleInputMoneda = (valor: string, campo: 'realEfectivo' | 'realCheques') => {
        // Permitir vaciar el input
        if (valor === "") {
            setValoresControl(prev => ({ ...prev, [campo]: "" }));
            return;
        }
        // Solo permitir números
        const soloNumeros = valor.replace(/\D/g, ''); 
        // Formatear y guardar
        const valorFormateado = new Intl.NumberFormat('es-AR').format(parseInt(soloNumeros));
        setValoresControl(prev => ({ ...prev, [campo]: valorFormateado }));
    };

    const abrirModalControl = (pago: any) => {
        // Al abrir, cargamos los valores formateados con puntos
        setValoresControl({
            realEfectivo: formatearMiles(pago.montoEfectivo), 
            realCheques: formatearMiles(pago.montoCheque),
            observaciones: ""
        });
        setModalControl({ open: true, pago });
    };

    const confirmarControl = async () => {
        if (!modalControl.pago) return;

        // Limpiamos los puntos antes de calcular
        const declaradoEfec = limpiarValor(modalControl.pago.montoEfectivo);
        const declaradoCheq = limpiarValor(modalControl.pago.montoCheque);
        
        const realEfec = limpiarValor(valoresControl.realEfectivo);
        const realCheq = limpiarValor(valoresControl.realCheques);

        const totalDeclarado = declaradoEfec + declaradoCheq;
        const totalReal = realEfec + realCheq;
        const diferencia = totalReal - totalDeclarado;

        let estadoArqueo = "Ok";
        if (diferencia < 0) estadoArqueo = "Faltante";
        if (diferencia > 0) estadoArqueo = "Excedente";

        try {
            await update(ref(db_realtime, `soportesypagos/${modalControl.pago.id}`), {
                estado: "Registrado",
                fechaRegistro: new Date().toISOString(),
                arqueo: {
                    estado: estadoArqueo,
                    diferencia: diferencia,
                    realEfectivo: realEfec,
                    realCheques: realCheq,
                    observaciones: valoresControl.observaciones
                }
            });
            setModalControl({ open: false, pago: null });
        } catch (error) {
            alert("Error al actualizar el registro.");
        }
    };

    // Cálculos auxiliares para el renderizado en vivo del modal
    const calcularDiferenciaUI = () => {
        if (!modalControl.pago) return { diff: 0, color: 'text-slate-400', label: 'Sin cambios' };
        
        const decl = limpiarValor(modalControl.pago.montoEfectivo) + limpiarValor(modalControl.pago.montoCheque);
        const real = limpiarValor(valoresControl.realEfectivo) + limpiarValor(valoresControl.realCheques);
        const diff = real - decl;

        if (diff === 0) return { diff: 0, color: 'text-emerald-400', label: '✅ PERFECTO' };
        if (diff < 0) return { diff, color: 'text-red-500', label: '⚠️ FALTANTE' };
        return { diff, color: 'text-blue-400', label: '💎 EXCEDENTE' };
    };

    // --- ACCIONES ---
    const eliminarPago = async (id: string) => {
        if (window.confirm("⚠️ PROTOCOLO DE ELIMINACIÓN: ¿Estás seguro de borrar este registro financiero?")) {
            try {
                await remove(ref(db_realtime, `soportesypagos/${id}`));
            } catch (error) {
                alert("Error al eliminar.");
            }
        }
    };

    const formatMoney = (val: string | number | undefined) => {
        if (!val) return "$ 0";
        // Convertimos a número si viene como string para formatear bien
        const num = typeof val === 'string' ? limpiarValor(val) : val;
        return `$ ${num.toLocaleString('es-AR')}`;
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
                            const arqueo = pago.arqueo;
                            
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
                                                <div className="flex flex-col items-end">
                                                    <span className="bg-slate-800 text-slate-400 px-3 py-1 rounded text-[10px] font-black uppercase tracking-wide font-mono border border-slate-700">
                                                        REGISTRADO
                                                    </span>
                                                    {arqueo && arqueo.estado !== "Ok" && (
                                                        <span className={`text-[9px] mt-1 font-black uppercase ${arqueo.estado === "Faltante" ? "text-red-500" : "text-blue-400"}`}>
                                                            {arqueo.estado} ({formatMoney(arqueo.diferencia)})
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="bg-emerald-900/40 text-emerald-400 px-3 py-1 rounded text-[10px] font-black uppercase tracking-wide font-mono border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)] animate-pulse">
                                                    Nuevo pago
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
                                                onClick={() => abrirModalControl(pago)}
                                                className="flex-1 py-3 bg-emerald-600 text-black rounded-xl font-black font-mono uppercase text-[10px] tracking-widest hover:bg-emerald-400 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] active:scale-95"
                                            >
                                                ✅ Controlar y Registrar
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

                {/* MODAL DE CONTROL Y ARQUEO */}
                {modalControl.open && modalControl.pago && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                        <div className="bg-[#0f172a] rounded-[2rem] w-full max-w-md border border-emerald-900 shadow-[0_0_50px_rgba(16,185,129,0.15)] overflow-hidden relative animate-in zoom-in duration-200">
                            
                            {/* Decorative Top */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500"></div>

                            <div className="p-8">
                                <h2 className="text-2xl font-black text-white uppercase italic mb-1 tracking-tighter">Arqueo de Caja</h2>
                                <p className="text-xs font-mono text-emerald-500 uppercase tracking-widest mb-6">Verificación de valores recibidos</p>

                                <div className="space-y-6">
                                    {/* INPUT EFECTIVO */}
                                    <div>
                                        <div className="flex justify-between text-[10px] font-bold uppercase mb-2 tracking-wide">
                                            <span className="text-slate-400">Declarado: <span className="text-white">{formatMoney(modalControl.pago.montoEfectivo)}</span></span>
                                            <span className="text-emerald-500">Efectivo Real</span>
                                        </div>
                                        <div className="relative group">
                                            <span className="absolute left-4 top-4 text-emerald-700 group-focus-within:text-emerald-400">💵</span>
                                            <input 
                                                type="text" 
                                                className="w-full pl-12 pr-4 py-4 bg-slate-900/50 border border-slate-700 rounded-xl text-white font-mono font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                                                value={valoresControl.realEfectivo}
                                                onChange={e => handleInputMoneda(e.target.value, 'realEfectivo')}
                                            />
                                        </div>
                                    </div>

                                    {/* INPUT CHEQUES */}
                                    <div>
                                        <div className="flex justify-between text-[10px] font-bold uppercase mb-2 tracking-wide">
                                            <span className="text-slate-400">Declarado: <span className="text-white">{formatMoney(modalControl.pago.montoCheque)}</span></span>
                                            <span className="text-cyan-500">Cheques Real</span>
                                        </div>
                                        <div className="relative group">
                                            <span className="absolute left-4 top-4 text-cyan-700 group-focus-within:text-cyan-400">🏦</span>
                                            <input 
                                                type="text" 
                                                className="w-full pl-12 pr-4 py-4 bg-slate-900/50 border border-slate-700 rounded-xl text-white font-mono font-bold focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                                                value={valoresControl.realCheques}
                                                onChange={e => handleInputMoneda(e.target.value, 'realCheques')}
                                            />
                                        </div>
                                    </div>

                                    {/* RESULTADO DINÁMICO */}
                                    <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Resultado Arqueo</span>
                                        <div className="text-right">
                                            <p className={`text-sm font-black uppercase tracking-wide ${calcularDiferenciaUI().color}`}>
                                                {calcularDiferenciaUI().label}
                                            </p>
                                            {calcularDiferenciaUI().diff !== 0 && (
                                                <p className="text-xs font-mono text-white mt-1">Diferencia: {formatMoney(calcularDiferenciaUI().diff)}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* OBSERVACIONES */}
                                    <textarea 
                                        rows={2}
                                        placeholder="Observaciones del control..."
                                        className="w-full p-4 bg-slate-900/30 border border-slate-800 rounded-xl text-xs text-slate-300 font-mono outline-none focus:border-slate-600 resize-none"
                                        value={valoresControl.observaciones}
                                        onChange={e => setValoresControl({...valoresControl, observaciones: e.target.value})}
                                    />

                                    {/* BOTONES */}
                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                        <button 
                                            onClick={() => setModalControl({ open: false, pago: null })}
                                            className="py-4 rounded-xl border border-slate-700 text-slate-400 font-bold uppercase text-xs hover:bg-slate-800 transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button 
                                            onClick={confirmarControl}
                                            className="py-4 bg-emerald-600 text-black rounded-xl font-black uppercase text-xs tracking-widest hover:bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all"
                                        >
                                            Confirmar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default Pagos;