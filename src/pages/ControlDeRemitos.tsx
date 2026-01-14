import React, { useEffect, useState } from 'react';
import { db_realtime } from '../firebase/config';
import { ref, onValue, update, set, remove, push } from "firebase/database";
import type { Remito, Soporte } from '../types';

const ControlDeRemitos: React.FC = () => {
    // ESTADOS DE DATOS
    const [remitos, setRemitos] = useState<Record<string, Remito>>({});
    const [soportes, setSoportes] = useState<Record<string, Soporte>>({});
    const [tablaManual, setTablaManual] = useState<any>({});
    
    // ESTADOS DE INTERFAZ
    const [filtro, setFiltro] = useState("");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [modalFirma, setModalFirma] = useState<{ open: boolean, data: any, type: 'remito' | 'soporte' }>({ open: false, data: null, type: 'remito' });
    
    // MODAL DE DETALLE (Ahora acepta 'any' para manejar Remito o Soporte)
    const [modalDetalle, setModalDetalle] = useState<{ open: boolean, data: any | null }>({ open: false, data: null });

    // CONTROLAR SI LA TABLA SE VE O NO
    const [tablaExpandida, setTablaExpandida] = useState(true);

    // ESTADOS SIDEBAR (FORMULARIOS)
    const [tipoCarga, setTipoCarga] = useState<'remito' | 'soporte' | ''>('');
    const [loading, setLoading] = useState(false);
    
    // -- Form Remito
    const [datosRemitoRaw, setDatosRemitoRaw] = useState('');
    const [productosRaw, setProductosRaw] = useState('');
    const [aclaracionesRaw, setAclaracionesRaw] = useState('');
    const [esTransporte, setEsTransporte] = useState(false);
    const [necesitaProduccion, setNecesitaProduccion] = useState(false);

    // -- Form Soporte
    const [soporteData, setSoporteData] = useState({
        numero: '',
        cliente: '',
        fecha: new Date().toISOString().split('T')[0],
        productos: ''
    });

    const rangos = ["Lunes Mañana", "Lunes Tarde", "Martes Mañana", "Martes Tarde", "Miércoles Mañana", "Miércoles Tarde", "Jueves Mañana", "Jueves Tarde", "Viernes Mañana", "Viernes Tarde"];
    const weekdays = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"];

    // 1. CARGA DE DATOS
    useEffect(() => {
        const unsubRemitos = onValue(ref(db_realtime, 'remitos'), (snapshot) => setRemitos(snapshot.val() || {}));
        const unsubSoportes = onValue(ref(db_realtime, 'soportes'), (snapshot) => setSoportes(snapshot.val() || {}));
        const unsubManual = onValue(ref(db_realtime, 'tablaManual'), (snapshot) => setTablaManual(snapshot.val() || {}));

        return () => { unsubRemitos(); unsubSoportes(); unsubManual(); };
    }, []);

    // 2. CÁLCULO DE CONTADORES
    const rPendientes = Object.values(remitos).filter(r => r.estadoPreparacion !== "Entregado").length;
    const rProduccion = Object.values(remitos).filter(r => r.produccion && r.estado === "Listo" && r.estadoPreparacion !== "Entregado").length;
    const rDespacho = Object.values(remitos).filter(r => r.estadoPreparacion === "Listo").length;
    
    // LÓGICA SIN FECHA (VIOLETA)
    const rListosSinFecha = Object.values(remitos).filter(r => {
        if (r.estadoPreparacion === "Entregado") return false;
        if (r.rangoDespacho && r.rangoDespacho !== "") return false;
        if (r.produccion) {
            // A. PRODUCCIÓN: Cuenta si Producción ya terminó (Listo) y falta asignar fecha
            return r.estado === "Listo";
        } else {
            // B. STOCK: Cuenta si está PENDIENTE (necesita fecha para que sepan cuándo armarlo)
            return r.estadoPreparacion === "Pendiente";
        }
    }).length;

    const sPendientes = Object.values(soportes).filter(s => s.estado === "Pendiente").length;
    const sResueltos = Object.values(soportes).filter(s => s.estado === "Resuelto").length;
    const sResueltosSinFecha = Object.values(soportes).filter(s => s.estado === "Resuelto" && (!s.rangoEntrega || s.rangoEntrega === "")).length;

    // 3. FILTRADO TABLA PRINCIPAL
    const remitosFiltrados = Object.entries(remitos).filter(([_id, r]) => {
        const match = r.cliente?.toLowerCase().includes(filtro.toLowerCase()) || r.numeroRemito?.toString().includes(filtro);
        return match && r.estadoPreparacion !== "Entregado";
    });

    // 4. ENTREGADOS
    const entregadosRemitos = Object.entries(remitos)
        .filter(([_id, r]) => r.estadoPreparacion === "Entregado")
        .map(([id, r]) => ({ ...r, id, _type: 'remito', displayNumero: r.numeroRemito }));
    
    const entregadosSoportes = Object.entries(soportes)
        .filter(([_id, s]) => s.estado === "Entregado")
        .map(([id, s]) => ({ ...s, id, _type: 'soporte', displayNumero: s.numeroSoporte, clienteFirma: (s as any).clienteFirma }));

    const todosEntregados = [...entregadosRemitos, ...entregadosSoportes];

    // 5. FUNCIONES DE GESTIÓN
    const eliminarItem = (id: string, type: string) => {
        if(window.confirm("¿Eliminar este registro entregado permanentemente?")) {
            const path = type === 'remito' ? 'remitos' : 'soportes';
            remove(ref(db_realtime, `${path}/${id}`));
        }
    };

    const guardarDatos = async () => {
        if (!tipoCarga) return;
        setLoading(true);
        try {
            if (tipoCarga === 'remito') {
                const numeroRemito = (datosRemitoRaw.match(/\b\d{4}-\d{8}\b/) || [""])[0];
                const fechaEmision = (datosRemitoRaw.match(/\b\d{2}\/\d{2}\/\d{2,4}\b/) || [""])[0];
                let cliente = "";
                const lineasDatos = datosRemitoRaw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                for (let i = 0; i < lineasDatos.length; i++) {
                    if (/Raz[oó]n Social:/i.test(lineasDatos[i])) {
                        cliente = lineasDatos[i].replace(/Raz[oó]n Social:/i, "").trim();
                        if (!cliente && lineasDatos[i+1]) cliente = lineasDatos[i+1].trim();
                        break;
                    }
                    if (!cliente && lineasDatos[i].length > 3 && !/^CUIT|Fecha|Tel|Domicilio/i.test(lineasDatos[i])) {
                        cliente = lineasDatos[i];
                    }
                }
                const articulos: any[] = [];
                productosRaw.split(/\r?\n/).filter(Boolean).forEach(l => {
                    const partes = l.trim().split(/\s+/);
                    if (partes.length >= 2) {
                        const cantidad = parseFloat(partes.shift()!.replace(",", "."));
                        const codigo = partes.join(" ");
                        if (codigo && !isNaN(cantidad)) articulos.push({ codigo, cantidad, detalle: "" });
                    }
                });
                if (aclaracionesRaw) {
                    const lineasAclara = aclaracionesRaw.split(/\r?\n|\/\//).map(l => l.trim()).filter(Boolean);
                    lineasAclara.forEach(linea => {
                        articulos.forEach(item => {
                            const codNorm = item.codigo.replace(/\s+/g, "");
                            if (linea.replace(/\s+/g, "").includes(codNorm)) {
                                let detalleExtra = linea.replace(item.codigo, "").trim();
                                if (detalleExtra) item.detalle = item.detalle ? item.detalle + " | " + detalleExtra : detalleExtra;
                            }
                        });
                    });
                }
                await push(ref(db_realtime, 'remitos'), {
                    numeroRemito, fechaEmision, cliente, articulos, aclaraciones: aclaracionesRaw,
                    produccion: necesitaProduccion, esTransporte, estado: null, estadoPreparacion: "Pendiente",
                    rangoDespacho: "", timestamp: new Date().toISOString()
                });
            } else {
                await push(ref(db_realtime, 'soportes'), {
                    numeroSoporte: soporteData.numero, cliente: soporteData.cliente,
                    fechaSoporte: soporteData.fecha, productos: soporteData.productos.split('\n').filter(Boolean),
                    estado: "Pendiente", timestamp: new Date().toISOString()
                });
            }
            alert("✅ Guardado correctamente");
            setSidebarOpen(false);
            setDatosRemitoRaw(''); setProductosRaw(''); setAclaracionesRaw(''); setEsTransporte(false); setNecesitaProduccion(false);
        } catch (e) { alert("❌ Error al guardar"); }
        setLoading(false);
    };

    return (
        <div className="max-w-7xl mx-auto px-4 pb-20 pt-10 font-sans bg-slate-50 min-h-screen relative">
            
            {/* ENCABEZADO */}
            <div className="mb-8 text-center md:text-left">
                <h1 className="text-3xl font-black text-slate-800 italic uppercase leading-none tracking-tighter">Panel de Control</h1>
                <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-2">Logística y monitoreo centralizado</p>
            </div>

            {/* CONTADORES */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Logística (Remitos)</h3>
                    <div className="grid grid-cols-4 gap-2">
                        <StatCard label="Pendientes" val={rPendientes} color="border-orange-300" />
                        <StatCard label="Producción" val={rProduccion} color="border-yellow-400" />
                        <StatCard label="Listos" val={rDespacho} color="border-green-500" />
                        <StatCard label="Sin Fecha" val={rListosSinFecha} color="border-purple-500" />
                    </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Servicio Técnico</h3>
                    <div className="grid grid-cols-3 gap-2">
                        <StatCard label="Pendientes" val={sPendientes} color="border-orange-400" />
                        <StatCard label="Resueltos" val={sResueltos} color="border-emerald-500" />
                        <StatCard label="Sin Fecha" val={sResueltosSinFecha} color="border-purple-500" />
                    </div>
                </div>
            </div>

            {/* BUSCADOR */}
            <section className="mb-4">
                <input type="text" placeholder="🔍 BUSCAR POR CLIENTE, N° REMITO O ZONA..." value={filtro} onChange={(e) => setFiltro(e.target.value)} className="w-full p-5 bg-white border-2 border-slate-100 rounded-[2rem] shadow-sm focus:border-blue-500 outline-none font-bold text-sm uppercase italic" />
            </section>

            {/* BOTÓN COLAPSAR / EXPANDIR TABLA */}
            <div className="flex justify-between items-center mb-4 px-2">
                <h3 className="text-xl font-black italic uppercase text-slate-400 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    Listado de Pedidos ({remitosFiltrados.length})
                </h3>
                <button 
                    onClick={() => setTablaExpandida(!tablaExpandida)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 transition-all font-bold text-xs uppercase text-slate-600"
                >
                    {tablaExpandida ? 'Contraer' : 'Desplegar'}
                    <span className={`text-lg transition-transform duration-300 ${tablaExpandida ? 'rotate-180' : 'rotate-0'}`}>▼</span>
                </button>
            </div>

            {/* TABLA PRINCIPAL (DESPLEGABLE) */}
            {tablaExpandida && (
                <section className="bg-white rounded-[2.5rem] shadow-xl shadow-blue-900/5 border border-slate-100 overflow-hidden mb-12 animate-in slide-in-from-top-4 fade-in duration-300">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left">
                            <thead>
                                <tr className="bg-slate-50/50 text-gray-400 font-black uppercase text-[10px] tracking-widest border-b border-slate-100">
                                    <th className="p-5">N° Remito</th>
                                    <th className="p-5">Cliente</th>
                                    <th className="p-5 text-center">Producción</th>
                                    <th className="p-5 text-center">Estado Prod.</th>
                                    <th className="p-5 text-center">Preparación</th>
                                    <th className="p-5 text-center">Prioridad</th>
                                    <th className="p-5 text-center">Rango Despacho</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {remitosFiltrados.map(([id, r], index) => {
                                    let bgClass = index % 2 === 0 ? 'bg-white' : 'bg-gray-50'; // Default
                                    const sinRango = !r.rangoDespacho || r.rangoDespacho === "";

                                    // Lógica de colores
                                    if (r.estadoPreparacion === 'Despachado') {
                                        bgClass = 'bg-cyan-100 text-cyan-900';
                                    } 
                                    else {
                                        if (r.produccion) {
                                            if (r.estado === 'Listo') {
                                                if (sinRango) bgClass = 'bg-purple-100 text-purple-900';
                                                else if (r.estadoPreparacion === 'Listo') bgClass = 'bg-green-100 text-green-900';
                                                else bgClass = 'bg-yellow-100 text-yellow-900';
                                            }
                                        }
                                        else {
                                            if (r.estadoPreparacion === 'Pendiente' && sinRango) {
                                                bgClass = 'bg-purple-100 text-purple-900';
                                            }
                                            else if (r.estadoPreparacion === 'Listo') {
                                                bgClass = 'bg-green-100 text-green-900';
                                            }
                                        }
                                    }

                                    const borderClass = r.prioridad ? 'border-l-4 border-red-500' : '';

                                    return (
                                        <tr key={id} className={`hover:bg-slate-200 transition-colors text-[11px] font-bold ${bgClass} ${borderClass}`}>
                                            <td 
                                                className="p-5 font-mono cursor-pointer hover:text-blue-600 hover:underline"
                                                onClick={() => setModalDetalle({ open: true, data: r })}
                                                title="Ver detalle del pedido"
                                            >
                                                #{r.numeroRemito}
                                            </td>
                                            
                                            <td className="p-5 uppercase">{r.cliente}</td>
                                            <td className="p-5 text-center">
                                                <input type="checkbox" checked={r.produccion} onChange={(e) => update(ref(db_realtime, `remitos/${id}`), { produccion: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-blue-600" />
                                            </td>
                                            <td className="p-5 text-center">
                                                {r.produccion && <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase shadow-sm ${r.estado === 'Listo' ? 'bg-green-500 text-white' : 'bg-yellow-200 text-yellow-800'}`}>{r.estado || 'PENDIENTE'}</span>}
                                            </td>
                                            <td className="p-5 text-center">
                                                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase shadow-sm bg-white/50 border border-slate-200`}>{r.estadoPreparacion || 'PENDIENTE'}</span>
                                            </td>
                                            <td className="p-5 text-center">
                                                <button onClick={() => update(ref(db_realtime, `remitos/${id}`), { prioridad: !r.prioridad })} className={`text-lg transition-transform active:scale-90 ${r.prioridad ? 'grayscale-0' : 'grayscale opacity-20'}`}>🔥</button>
                                            </td>
                                            <td className="p-5 text-center">
                                                <select value={r.rangoDespacho || ""} onChange={(e) => update(ref(db_realtime, `remitos/${id}`), { rangoDespacho: e.target.value })} className="bg-white/50 border border-slate-300 rounded-xl p-2 text-[10px] font-black uppercase outline-none focus:bg-white">
                                                    <option value="">-- SELECCIONAR --</option>
                                                    {rangos.map(rng => <option key={rng} value={rng}>{rng}</option>)}
                                                </select>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* TABLA SEMANAL */}
            <h3 className="text-xl font-black italic uppercase mb-6 ml-4 text-gray-800 tracking-tighter">Cronograma Semanal</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-20">
                {weekdays.map((dia) => (
                    <div key={dia} className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                        <div className="bg-slate-800 p-5 text-center text-white font-black italic text-sm tracking-widest">{dia}</div>
                        {["Mañana", "Tarde"].map(bloque => {
                            const diaFix = dia === "MIERCOLES" ? "Miércoles" : dia.charAt(0) + dia.slice(1).toLowerCase();
                            const match = `${diaFix} ${bloque}`;
                            return (
                                <div 
                                    key={bloque} 
                                    className="p-5 border-b border-gray-50 min-h-[130px] last:border-0 hover:bg-gray-50 transition-colors" 
                                    onDoubleClick={() => {
                                        const val = prompt(`Nota para ${match}:`);
                                        if(val) set(ref(db_realtime, `tablaManual/${diaFix}_${bloque}/${Date.now()}`), { text: val });
                                    }}
                                >
                                    <p className="text-[10px] font-black text-blue-500 uppercase mb-3 tracking-widest text-center">{bloque}</p>
                                    <div className="flex flex-col gap-2">
                                        {/* REMITOS */}
                                        {Object.entries(remitos).filter(([,r]) => r.rangoDespacho === match && r.estadoPreparacion !== "Entregado").map(([id,r]) => (
                                            <span 
                                                key={id} 
                                                onClick={() => setModalDetalle({ open: true, data: r })}
                                                className={`px-3 py-2 rounded-xl text-[9px] font-black border-l-4 shadow-sm cursor-pointer hover:scale-105 transition-transform ${r.prioridad ? 'bg-red-50 text-red-700 border-red-500' : 'bg-blue-50 text-blue-700 border-blue-400'}`}
                                            >
                                                {r.cliente}
                                            </span>
                                        ))}
                                        
                                        {/* SOPORTES */}
                                        {Object.entries(soportes).filter(([,s]) => s.rangoEntrega === match && s.estado !== "Entregado").map(([id,s]) => (
                                            /* --- CLICK EN SOPORTE --- */
                                            <span 
                                                key={id} 
                                                onClick={() => setModalDetalle({ open: true, data: s })}
                                                className="px-3 py-2 rounded-xl text-[9px] font-black border-l-4 bg-orange-50 text-orange-700 border-orange-500 shadow-sm flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform"
                                            >
                                                <span>🛠️</span> {s.cliente}
                                            </span>
                                        ))}
                                        
                                        {/* NOTAS MANUALES */}
                                        {tablaManual[`${diaFix}_${bloque}`] && Object.entries(tablaManual[`${diaFix}_${bloque}`]).map(([mId,m]:any) => (
                                            <span key={mId} className="px-3 py-2 rounded-xl text-[9px] font-black bg-amber-50 text-amber-700 border-l-4 border-amber-400 italic flex justify-between group">
                                                {m.text}
                                                <button onClick={(e) => {e.stopPropagation(); remove(ref(db_realtime, `tablaManual/${diaFix}_${bloque}/${mId}`));}} className="opacity-0 group-hover:opacity-100">✖</button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>

            {/* SECCIÓN ENTREGADOS */}
            <section>
                <h3 className="text-xl font-black italic uppercase mb-6 ml-4 text-slate-400 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Historial de Entregados (Remitos & Soportes)
                </h3>
                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                    {todosEntregados.length === 0 ? <p className="text-slate-400 text-sm italic text-center">No hay registros entregados aún.</p> : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {todosEntregados.map((item: any) => (
                                <div key={item.id} className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center border border-slate-100 group hover:border-slate-300 transition-colors">
                                    <div>
                                        <div className="flex gap-2 items-center mb-1">
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded text-white ${item._type === 'remito' ? 'bg-blue-400' : 'bg-orange-400'}`}>{item._type === 'remito' ? 'REMITO' : 'SOPORTE'}</span>
                                            <span className="text-[10px] font-black text-slate-400">#{item.displayNumero}</span>
                                        </div>
                                        <p className="font-bold text-slate-800 text-sm uppercase truncate max-w-[150px]">{item.cliente}</p>
                                        <p className="text-[9px] text-slate-400 mt-1 font-mono">{item.fechaEntrega ? item.fechaEntrega.split('T')[0] : 'Sin fecha'}</p>
                                        
                                        {/* --- DATO CHOFER --- */}
                                        <p className="text-[10px] font-bold text-indigo-500 mt-1 flex items-center gap-1">
                                            <span>🚚</span> {item.chofer || 'Sin chofer asignado'}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setModalFirma({open: true, data: item, type: item._type})} className="p-2 bg-white rounded-lg shadow-sm hover:scale-110 transition-transform text-xl" title="Ver Firma">🖋️</button>
                                        <button onClick={() => eliminarItem(item.id, item._type)} className="p-2 bg-red-50 text-red-600 rounded-lg shadow-sm hover:bg-red-100 transition-colors" title="Eliminar">✖</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* BOTÓN FLOTANTE */}
            <button onClick={() => setSidebarOpen(true)} className="fixed bottom-10 right-10 w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center text-3xl font-bold z-50 hover:scale-110 active:scale-95 transition-all">+</button>

            {/* --- MODAL DETALLE PEDIDO --- */}
            {modalDetalle.open && modalDetalle.data && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setModalDetalle({ open: false, data: null })}>
                    <div className="bg-white rounded-[2rem] p-8 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
                        
                        <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">{modalDetalle.data.cliente}</h3>
                                {modalDetalle.data.numeroRemito ? (
                                    <p className="text-blue-600 font-mono font-bold text-sm bg-blue-50 inline-block px-2 py-1 rounded-lg mt-1">Remito #{modalDetalle.data.numeroRemito}</p>
                                ) : (
                                    <p className="text-orange-600 font-mono font-bold text-sm bg-orange-50 inline-block px-2 py-1 rounded-lg mt-1">Soporte #{modalDetalle.data.numeroSoporte}</p>
                                )}
                            </div>
                            <button onClick={() => setModalDetalle({ open: false, data: null })} className="text-slate-300 hover:text-slate-800 text-xl font-bold p-2">✕</button>
                        </div>

                        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                            {/* Lista de Productos */}
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <span>📦</span> Detalle de Productos
                                </h4>
                                <ul className="space-y-3">
                                    {/* CASO REMITO (ARRAY DE OBJETOS) */}
                                    {modalDetalle.data.numeroRemito && Array.isArray(modalDetalle.data.articulos) && modalDetalle.data.articulos.map((art: any, i: number) => (
                                        <li key={i} className="text-sm font-bold text-slate-700 border-b border-slate-200 pb-2 last:border-0 last:pb-0 flex items-start gap-3">
                                            <span className="bg-white text-blue-600 border border-blue-100 px-2 py-0.5 rounded text-xs font-black min-w-[30px] text-center shadow-sm">{art.cantidad}</span>
                                            <div className="flex-1">
                                                <p>{art.codigo}</p>
                                                {art.detalle && <p className="text-[11px] text-slate-400 italic font-normal mt-0.5">{art.detalle}</p>}
                                            </div>
                                        </li>
                                    ))}

                                    {/* CASO SOPORTE (ARRAY DE STRINGS) */}
                                    {modalDetalle.data.numeroSoporte && Array.isArray(modalDetalle.data.productos) && modalDetalle.data.productos.map((prod: string, i: number) => (
                                        <li key={i} className="text-sm font-bold text-slate-700 border-b border-slate-200 pb-2 last:border-0 last:pb-0 flex items-center gap-3">
                                            <span className="text-orange-500">•</span>
                                            <p>{prod}</p>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Aclaraciones (Solo Remitos) */}
                            {modalDetalle.data.aclaraciones && (
                                <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 text-amber-800">
                                    <h4 className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <span>📝</span> Observaciones
                                    </h4>
                                    <p className="text-xs font-bold italic leading-relaxed whitespace-pre-line">{modalDetalle.data.aclaraciones}</p>
                                </div>
                            )}

                            {/* Datos Extra */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                                    <p className="text-[9px] font-black text-slate-400 uppercase">Fecha</p>
                                    <p className="text-xs font-bold text-slate-700">{modalDetalle.data.fechaEmision || modalDetalle.data.fechaSoporte || '-'}</p>
                                </div>
                                {modalDetalle.data.numeroRemito && (
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                                        <p className="text-[9px] font-black text-slate-400 uppercase">Tipo</p>
                                        <p className="text-xs font-bold text-slate-700">{modalDetalle.data.esTransporte ? '🚛 Transporte' : '🏠 Domicilio'}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button onClick={() => setModalDetalle({ open: false, data: null })} className="w-full mt-6 p-4 bg-slate-900 text-white rounded-2xl font-black uppercase italic tracking-widest hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200">
                            Cerrar
                        </button>
                    </div>
                </div>
            )}

            {/* MODAL FIRMA */}
            {modalFirma.open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setModalFirma({...modalFirma, open: false})}>
                    <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-black text-slate-800 uppercase italic mb-4 text-center">Comprobante de Entrega</h3>
                        {modalFirma.data.clienteFirma ? (
                            <div className="space-y-4">
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Recibió</p>
                                    <p className="font-black text-slate-800 uppercase text-lg">{modalFirma.data.clienteFirma.nombre}</p>
                                    <p className="text-xs text-slate-500 font-bold">DNI: {modalFirma.data.clienteFirma.dni}</p>
                                </div>
                                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 flex justify-center bg-white">
                                    <img src={`data:image/png;base64,${modalFirma.data.clienteFirma.firma}`} className="max-h-40 object-contain" alt="Firma" />
                                </div>
                            </div>
                        ) : (
                            <div className="p-10 text-center bg-slate-50 rounded-2xl text-slate-400 font-bold italic border border-slate-100">
                                <p className="text-3xl mb-2">🤷‍♂️</p>
                                Sin firma digital registrada.
                            </div>
                        )}
                        <button onClick={() => setModalFirma({...modalFirma, open: false})} className="w-full mt-6 p-4 bg-slate-900 text-white rounded-2xl font-black uppercase italic tracking-widest hover:bg-slate-800 transition-colors">Cerrar</button>
                    </div>
                </div>
            )}

            {/* SIDEBAR DE CARGA */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-[100] flex justify-end">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
                    <div className="relative w-full max-w-lg bg-white h-full shadow-2xl p-8 overflow-y-auto animate-in slide-in-from-right duration-300">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-black italic uppercase text-slate-800 tracking-tighter">Carga de Datos</h2>
                            <button onClick={() => setSidebarOpen(false)} className="text-slate-300 hover:text-slate-800 text-xl font-bold">✕</button>
                        </div>
                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-2">Tipo de carga</label>
                                <select value={tipoCarga} onChange={(e) => setTipoCarga(e.target.value as any)} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold uppercase text-sm outline-none focus:border-blue-500 transition-all">
                                    <option value="">-- Seleccionar --</option>
                                    <option value="remito">Remito</option>
                                    <option value="soporte">Soporte</option>
                                </select>
                            </div>
                            {tipoCarga === 'remito' && (
                                <div className="space-y-6 animate-in fade-in duration-500">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-2">Datos Remito y Cliente</label>
                                        <textarea rows={6} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono" placeholder="Pega bloque completo aquí..." value={datosRemitoRaw} onChange={e => setDatosRemitoRaw(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-2">Productos y Cantidades</label>
                                        <textarea rows={4} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono" placeholder="Cantidad Código..." value={productosRaw} onChange={e => setProductosRaw(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-2">Detalles / Aclaraciones</label>
                                        <textarea rows={3} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono" placeholder="Ej: MPE 1200 ROJOS..." value={aclaracionesRaw} onChange={e => setAclaracionesRaw(e.target.value)} />
                                    </div>
                                    <div className="grid grid-cols-1 gap-3">
                                        <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border cursor-pointer border-slate-100 hover:border-blue-500 transition-all">
                                            <input type="checkbox" checked={esTransporte} onChange={e => setEsTransporte(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-blue-600" />
                                            <span className="text-[11px] font-black text-slate-600 uppercase italic">Es Transporte</span>
                                        </label>
                                        <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border cursor-pointer border-slate-100 hover:border-green-500 transition-all">
                                            <input type="checkbox" checked={necesitaProduccion} onChange={e => setNecesitaProduccion(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-green-600" />
                                            <span className="text-[11px] font-black text-slate-600 uppercase italic text-green-600">Requiere Producción</span>
                                        </label>
                                    </div>
                                </div>
                            )}
                            {tipoCarga === 'soporte' && (
                                <div className="space-y-4 animate-in fade-in duration-500">
                                    <input type="text" placeholder="N° SOPORTE" className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase text-sm border-slate-100" value={soporteData.numero} onChange={e => setSoporteData({...soporteData, numero: e.target.value})} />
                                    <input type="text" placeholder="CLIENTE" className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase text-sm border-slate-100" value={soporteData.cliente} onChange={e => setSoporteData({...soporteData, cliente: e.target.value})} />
                                    <input type="date" className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm border-slate-100 uppercase" value={soporteData.fecha} onChange={e => setSoporteData({...soporteData, fecha: e.target.value})} />
                                    <textarea rows={5} placeholder="LISTA DE PRODUCTOS..." className="w-full p-4 bg-slate-50 rounded-2xl border-slate-100 font-bold uppercase text-sm" value={soporteData.productos} onChange={e => setSoporteData({...soporteData, productos: e.target.value})} />
                                </div>
                            )}
                            {tipoCarga && (
                                <button disabled={loading} onClick={guardarDatos} className="w-full mt-4 p-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase italic tracking-widest shadow-xl hover:bg-blue-600 transition-all disabled:bg-slate-300">
                                    {loading ? 'Sincronizando...' : 'Confirmar Carga'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

function StatCard({ label, val, color }: { label: string, val: number, color: string }) {
    return (
        <div className={`bg-slate-50 p-3 rounded-xl border-l-4 ${color} transition-transform hover:scale-105`}>
            <h2 className="text-[9px] font-bold text-slate-400 uppercase tracking-wide leading-none truncate">{label}</h2>
            <p className="text-2xl font-black text-slate-800 mt-1 italic leading-none">{val}</p>
        </div>
    );
}

export default ControlDeRemitos;