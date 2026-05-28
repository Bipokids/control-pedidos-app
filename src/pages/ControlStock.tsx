import React, { useEffect, useState, useMemo } from 'react';
import { db_realtime } from '../firebase/config';
import { ref, onValue, push, update, remove } from "firebase/database";
import { useAuth } from '../context/AuthContext';

// --- TIPOS ---
interface VarianteData {
    estado: 'POCAS UNIDADES' | 'AGOTADO';
    usuario: string;
    timestamp: number;
    bultos?: number | null;
}

interface ArticuloStock {
    id: string;
    articulo: string;
    variantes: Record<string, VarianteData>;
}

const ESTADOS_STOCK = ['POCAS UNIDADES', 'AGOTADO'];

const ControlStock: React.FC = () => {
    const { user, role } = useAuth() as { user: any, role: string }; 
    const canEdit = role === 'admin' || role === 'produccion';

    // --- ESTADOS ---
    const [listaStock, setListaStock] = useState<ArticuloStock[]>([]);
    const [loading, setLoading] = useState(true);

    // Búsqueda
    const [filtroTexto, setFiltroTexto] = useState("");

    // Formulario
    const [articulo, setArticulo] = useState("");
    const [variante, setVariante] = useState("");
    const [estado, setEstado] = useState<"POCAS UNIDADES" | "AGOTADO" | "">("");
    const [bultos, setBultos] = useState("");

    // Alertas en tiempo real
    const [alertaReciente, setAlertaReciente] = useState<{ articulo: string, variante: string, estado: string, bultos?: number | null } | null>(null);
    const [loadTime] = useState(Date.now());

    // --- CARGA DE DATOS ---
    useEffect(() => {
        const unsubStock = onValue(ref(db_realtime, 'alertas_stock'), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                let todasLasVariantes: any[] = [];
                
                const itemsParseados: ArticuloStock[] = Object.entries(data).map(([id, val]: any) => {
                    let variantesObj = val.variantes;
                    if (!variantesObj && val.estado) {
                        variantesObj = {
                            [val.variante || "ÚNICA"]: {
                                estado: val.estado,
                                usuario: val.usuario,
                                timestamp: val.timestamp,
                                bultos: val.bultos ?? null
                            }
                        };
                    }

                    if (variantesObj) {
                        Object.entries(variantesObj).forEach(([vKey, vData]: [string, any]) => {
                            todasLasVariantes.push({
                                articulo: val.articulo,
                                variante: vKey,
                                estado: vData.estado,
                                usuario: vData.usuario,
                                timestamp: vData.timestamp,
                                bultos: vData.bultos ?? null
                            });
                        });
                    }

                    return { id, articulo: val.articulo, variantes: variantesObj || {} };
                });

                const itemsNuevos = todasLasVariantes.filter(v => v.timestamp > loadTime);
                if (itemsNuevos.length > 0) {
                    const ultimo = itemsNuevos.sort((a, b) => b.timestamp - a.timestamp)[0];
                    if (ultimo.usuario !== user?.email) {
                        setAlertaReciente({
                            articulo: ultimo.articulo,
                            variante: ultimo.variante,
                            estado: ultimo.estado,
                            bultos: ultimo.bultos ?? null
                        });
                        setTimeout(() => setAlertaReciente(null), 8000); 
                    }
                }

                itemsParseados.sort((a, b) => {
                    const maxA = Math.max(...Object.values(a.variantes || {}).map(v => v.timestamp), 0);
                    const maxB = Math.max(...Object.values(b.variantes || {}).map(v => v.timestamp), 0);
                    return maxB - maxA;
                });

                setListaStock(itemsParseados);
            } else {
                setListaStock([]);
            }
            setLoading(false);
        });

        return () => unsubStock();
    }, [loadTime, user?.email]);

    // --- LÓGICA DE BÚSQUEDA ---
    const stockFiltrado = useMemo(() => {
        if (!filtroTexto) return listaStock;
        
        const term = filtroTexto.toLowerCase();
        return listaStock.filter(item => {
            // Coincide el nombre del artículo
            if (item.articulo.toLowerCase().includes(term)) return true;
            
            // O coincide el nombre de alguna variante interna
            const matchVariante = Object.keys(item.variantes || {}).some(vKey => vKey.toLowerCase().includes(term));
            return matchVariante;
        });
    }, [listaStock, filtroTexto]);

    // --- LÓGICA DE FORMULARIO ---
    const guardarInformacion = async () => {
        if (!articulo || !estado) return alert("Falta ingresar artículo y estado");

        const bultosNumericos = Number(bultos);
        if (
            estado === "POCAS UNIDADES" &&
            (
                !bultos.trim() ||
                Number.isNaN(bultosNumericos) ||
                !Number.isInteger(bultosNumericos) ||
                bultosNumericos <= 0
            )
        ) {
            return alert("Si el estado es POCAS UNIDADES, tenés que indicar cuántos bultos quedan. Debe ser un número entero mayor a 0.");
        }

        const articuloUpper = articulo.toUpperCase().trim();
        const varianteUpper = variante.toUpperCase().trim() || "ÚNICA";
        const varianteKey = varianteUpper.replace(/[.#$[\]]/g, ''); 

        const articuloExistente = listaStock.find(item => item.articulo === articuloUpper);

        try {
            const payloadVariante = {
                estado,
                usuario: user?.email || "Desconocido",
                timestamp: Date.now(),
                bultos: estado === "POCAS UNIDADES" ? bultosNumericos : null
            };

            if (articuloExistente) {
                await update(ref(db_realtime, `alertas_stock/${articuloExistente.id}/variantes/${varianteKey}`), payloadVariante);
            } else {
                await push(ref(db_realtime, 'alertas_stock'), {
                    articulo: articuloUpper,
                    variantes: {
                        [varianteKey]: payloadVariante
                    }
                });
            }

            // ENCOLAR LA NOTIFICACIÓN PARA EL BOT
            await push(ref(db_realtime, 'notificaciones_pendientes'), {
                articulo: articuloUpper,
                variante: varianteUpper,
                estado: estado,
                bultos: estado === "POCAS UNIDADES" ? bultosNumericos : null,
                usuario: user?.email || "Desconocido",
                timestamp: Date.now()
            });

            limpiarFormulario();
        } catch (e) {
            alert("Error al guardar la información");
        }
    };

    const cargarParaEdicion = (articuloNombre: string, varKey: string, varData: VarianteData) => {
        if (!canEdit) return;
        setArticulo(articuloNombre);
        setVariante(varKey === "ÚNICA" ? "" : varKey);
        setEstado(varData.estado);
        setBultos(varData.estado === "POCAS UNIDADES" && varData.bultos != null ? String(varData.bultos) : "");
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const borrarVariante = async (articuloId: string, varKey: string, variantesActuales: Record<string, VarianteData>) => {
        if (!window.confirm(`¿Eliminar la alerta de la variante: ${varKey}?`)) return;
        
        if (Object.keys(variantesActuales).length <= 1) {
            await remove(ref(db_realtime, `alertas_stock/${articuloId}`));
        } else {
            await remove(ref(db_realtime, `alertas_stock/${articuloId}/variantes/${varKey}`));
        }
    };

    const limpiarFormulario = () => {
        setArticulo("");
        setVariante("");
        setEstado("");
        setBultos("");
    };

    if (loading) return <div className="min-h-screen bg-[#050b14] flex items-center justify-center"><div className="text-red-500 font-mono animate-pulse uppercase tracking-widest">LOADING STOCK SYSTEMS...</div></div>;

    return (
        <div className="min-h-screen relative font-sans text-red-50 bg-[#050b14] selection:bg-red-500 selection:text-black pb-20 pt-10 px-4">
            
            <div className="fixed inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #1e293b 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

            {alertaReciente && (
                <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-10 fade-in duration-500">
                    <div className="bg-[#0f172a]/90 backdrop-blur-xl border border-red-500 rounded-full px-6 py-3 shadow-[0_0_30px_rgba(239,68,68,0.4)] flex items-center gap-4">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                        <div>
                            <p className="text-[10px] font-black text-red-400 uppercase tracking-[0.2em] font-mono">Actualización de Stock Detectada</p>
                            <p className="text-sm font-bold text-white uppercase">
                                {alertaReciente.articulo} ({alertaReciente.variante}) - <span className={alertaReciente.estado === 'AGOTADO' ? 'text-red-500' : 'text-amber-500'}>{alertaReciente.estado}</span>
                                {alertaReciente.estado === 'POCAS UNIDADES' && alertaReciente.bultos != null && (
                                    <span className="text-amber-300"> · 📦 {alertaReciente.bultos} bulto{alertaReciente.bultos === 1 ? '' : 's'}</span>
                                )}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto relative z-10">
                
                <header className="mb-10 flex flex-col md:flex-row justify-between items-end gap-6 border-b border-red-900/50 pb-6">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tighter mb-2 uppercase drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">
                            CONTROL <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-500">DE STOCK</span>
                        </h1>
                        <p className="text-red-500 font-mono text-xs uppercase tracking-[0.3em]">Reporte de Faltantes y Bajas Unidades</p>
                        <div className="flex gap-2 mt-2">
                            <p className="text-[10px] font-bold text-slate-400 font-mono bg-slate-900/50 inline-block px-2 py-1 rounded border border-slate-700">
                                👤 {user?.email?.split('@')[0]}
                            </p>
                            <p className={`text-[10px] font-black font-mono inline-block px-2 py-1 rounded border ${canEdit ? 'bg-amber-900/30 text-amber-400 border-amber-500/30' : 'bg-slate-800 text-slate-500 border-slate-600'}`}>
                                ROL: {role || 'VENDEDOR'}
                            </p>
                        </div>
                    </div>
                </header>

                <div className={`grid grid-cols-1 ${canEdit ? 'lg:grid-cols-3' : 'lg:grid-cols-1'} gap-8`}>
                    
                    {canEdit && (
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-[#0f172a]/60 backdrop-blur-md p-6 rounded-[2rem] shadow-xl border border-slate-800 relative overflow-hidden transition-all">
                                
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-amber-500"></div>
                                
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">
                                        REPORTAR STOCK
                                    </h2>
                                    {(articulo || variante) && (
                                        <button onClick={limpiarFormulario} className="text-[10px] bg-slate-800 text-slate-300 px-2 py-1 rounded uppercase font-mono hover:bg-slate-700">Limpiar</button>
                                    )}
                                </div>
                                
                                <div className="space-y-5">
                                    <div>
                                        <label className="text-[10px] font-black text-red-400 uppercase tracking-widest ml-2 mb-2 block font-mono">ITEM / ARTÍCULO *</label>
                                        <input 
                                            type="text" 
                                            placeholder="EJ: BICICLETA MTB..." 
                                            value={articulo}
                                            onChange={(e) => setArticulo(e.target.value)}
                                            className="w-full p-4 bg-black/40 border border-slate-700 rounded-xl font-bold font-mono text-sm outline-none focus:border-red-500 text-white placeholder-slate-600 transition-all uppercase focus:shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-amber-400 uppercase tracking-widest ml-2 mb-2 block font-mono">VARIANTE (OPCIONAL)</label>
                                        <input 
                                            type="text" 
                                            placeholder="EJ: COLOR ROJO" 
                                            value={variante}
                                            onChange={(e) => setVariante(e.target.value)}
                                            className="w-full p-4 bg-black/40 border border-slate-700 rounded-xl font-bold font-mono text-sm outline-none focus:border-amber-500 text-white placeholder-slate-600 transition-all uppercase focus:shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-red-400 uppercase tracking-widest ml-2 mb-2 block font-mono">ESTADO DE STOCK *</label>
                                        <select 
                                            value={estado}
                                            onChange={(e) => {
                                                const nuevoEstado = e.target.value as "POCAS UNIDADES" | "AGOTADO" | "";
                                                setEstado(nuevoEstado);
                                                if (nuevoEstado !== "POCAS UNIDADES") setBultos("");
                                            }}
                                            className="w-full p-4 bg-black/40 border border-slate-700 rounded-xl font-bold font-mono text-sm outline-none focus:border-red-500 text-white uppercase cursor-pointer appearance-none transition-all"
                                        >
                                            <option value="">-- SELECCIONAR --</option>
                                            {ESTADOS_STOCK.map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </div>

                                    {estado === "POCAS UNIDADES" && (
                                        <div>
                                            <label className="text-[10px] font-black text-amber-400 uppercase tracking-widest ml-2 mb-2 block font-mono">BULTOS RESTANTES *</label>
                                            <input
                                                type="number"
                                                min="1"
                                                step="1"
                                                placeholder="EJ: 3"
                                                value={bultos}
                                                onChange={(e) => setBultos(e.target.value)}
                                                className="w-full p-4 bg-black/40 border border-slate-700 rounded-xl font-bold font-mono text-sm outline-none focus:border-amber-500 text-white placeholder-slate-600 transition-all uppercase focus:shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                                            />
                                        </div>
                                    )}

                                    <button 
                                        onClick={guardarInformacion}
                                        className="w-full py-4 text-black rounded-xl font-black font-mono uppercase tracking-widest shadow-[0_0_20px_rgba(239,68,68,0.4)] active:scale-95 transition-all flex justify-center items-center gap-2 bg-red-600 hover:bg-red-500"
                                    >
                                        <span>⚠️</span> GUARDAR / ACTUALIZAR
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className={`${canEdit ? 'lg:col-span-2' : 'lg:col-span-1'} space-y-6`}>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <h2 className="text-xl font-black text-white uppercase italic flex items-center gap-2 tracking-tight">
                                <span className="text-red-500">///</span> MONITOR DE STOCK ACTUAL
                            </h2>
                            
                            {/* --- BUSCADOR --- */}
                            <div className="relative w-full md:w-64 shrink-0">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-mono">🔍</span>
                                <input
                                    type="text"
                                    placeholder="BUSCAR..."
                                    value={filtroTexto}
                                    onChange={(e) => setFiltroTexto(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-[#0f172a]/60 backdrop-blur-md border border-slate-700 rounded-xl font-bold font-mono text-xs outline-none focus:border-red-500 text-white placeholder-slate-500 transition-all uppercase focus:shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                                />
                                {filtroTexto && (
                                    <button 
                                        onClick={() => setFiltroTexto("")}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                                    >×</button>
                                )}
                            </div>
                        </div>

                        {listaStock.length === 0 ? (
                            <div className="p-10 border-2 border-dashed border-slate-800 rounded-[2rem] text-center text-slate-600 font-mono font-bold bg-[#0f172a]/30">
                                Todo el inventario se encuentra estable...
                            </div>
                        ) : stockFiltrado.length === 0 ? (
                            <div className="p-10 border-2 border-dashed border-slate-800 rounded-[2rem] text-center text-slate-600 font-mono font-bold bg-[#0f172a]/30">
                                No se encontraron alertas para "{filtroTexto}"...
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                                {stockFiltrado.map(item => (
                                    <div key={item.id} className="p-5 bg-[#0f172a]/60 backdrop-blur-md border border-slate-800 rounded-xl shadow-lg relative flex flex-col">
                                        
                                        <div className="flex justify-between items-start mb-4 border-b border-slate-700/50 pb-3">
                                            <h3 className="font-black text-white text-lg uppercase tracking-wide leading-tight drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">{item.articulo}</h3>
                                            
                                            {canEdit && (
                                                <button 
                                                    onClick={() => {
                                                        if(window.confirm("¿Eliminar TODAS las alertas de este artículo?")) remove(ref(db_realtime, `alertas_stock/${item.id}`));
                                                    }}
                                                    className="text-slate-600 hover:text-red-500 font-bold px-2 text-xl transition-colors"
                                                    title="Limpiar artículo completo"
                                                >×</button>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            {Object.entries(item.variantes || {}).map(([varKey, varData]) => (
                                                <div 
                                                    key={varKey} 
                                                    className={`flex justify-between items-center p-3 rounded-lg border group transition-all ${
                                                        canEdit ? 'cursor-pointer' : ''
                                                    } ${
                                                        varData.estado === 'AGOTADO' 
                                                        ? 'bg-red-900/10 border-red-500/30 hover:bg-red-900/20 hover:border-red-500/50' 
                                                        : 'bg-amber-900/10 border-amber-500/30 hover:bg-amber-900/20 hover:border-amber-500/50'
                                                    }`}
                                                    onClick={() => cargarParaEdicion(item.articulo, varKey, varData)}
                                                >
                                                    <div>
                                                        <p className="text-slate-300 font-bold font-mono text-sm uppercase">{varKey}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <p className="text-[9px] text-slate-500 font-mono">👤 {varData.usuario.split('@')[0]}</p>
                                                            <p className="text-[9px] text-slate-600 font-mono">
                                                                📅 {new Date(varData.timestamp).toLocaleDateString('es-AR')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[9px] font-black px-2 py-1 rounded uppercase font-mono tracking-wide ${
                                                            varData.estado === 'AGOTADO' ? 'bg-red-900/50 text-red-400' : 'bg-amber-900/50 text-amber-400'
                                                        }`}>
                                                            {varData.estado}
                                                        </span>

                                                        {varData.estado === 'POCAS UNIDADES' && varData.bultos != null && (
                                                            <span className="text-[9px] font-black px-2 py-1 rounded uppercase font-mono tracking-wide bg-slate-800/80 text-amber-300 border border-amber-500/20">
                                                                📦 {varData.bultos} bulto{varData.bultos === 1 ? '' : 's'}
                                                            </span>
                                                        )}

                                                        {canEdit && (
                                                            <button 
                                                                onClick={(e) => { 
                                                                    e.stopPropagation(); 
                                                                    borrarVariante(item.id, varKey, item.variantes); 
                                                                }}
                                                                className="text-slate-600 hover:text-red-500 font-bold px-2 md:opacity-0 group-hover:opacity-100 transition-opacity"
                                                                title="Eliminar variante"
                                                            >×</button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ControlStock;    