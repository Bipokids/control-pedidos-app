import React, { useEffect, useState, useMemo } from 'react';
import { db_realtime } from '../firebase/config';
import { ref, onValue, push, remove } from "firebase/database";
import { useAuth } from '../context/AuthContext';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, Legend 
} from 'recharts';

// --- TIPOS ---
interface Producto {
    id: string;
    categoria?: string; 
    nombre: string;     
}

interface Devolucion {
    id: string;
    usuario: string; 
    fecha: string;
    timestamp: number;
    producto: string;
    venta: string; 
    motivo: string;
    tieneCosto: boolean;
    costo: number;
}

// --- CONSTANTES DE COLOR NEON ---
const MOTIVOS = [
    "Falla", "Devolución", "Error de preparación", "Cambio", 
    "Disconformidad", "Embalaje defectuoso", "Faltantes", "No entregado"
];

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];
const THEME = {
    grid: '#1e293b',
    textMuted: '#64748b'
};

const Devoluciones: React.FC = () => {
    const { user } = useAuth();
    
    // Estados de Datos
    const [productos, setProductos] = useState<Producto[]>([]);
    const [devoluciones, setDevoluciones] = useState<Devolucion[]>([]);
    const [loading, setLoading] = useState(true);

    // Estados Formulario Devolución
    const [busquedaProd, setBusquedaProd] = useState("");
    const [prodSeleccionado, setProdSeleccionado] = useState<Producto | null>(null);
    const [nroVenta, setNroVenta] = useState("");
    const [motivo, setMotivo] = useState("");
    const [tieneCosto, setTieneCosto] = useState(false);
    const [costo, setCosto] = useState("");

    // Estados Carga de Producto Nuevo
    const [modalProdOpen, setModalProdOpen] = useState(false);
    const [newItemNombre, setNewItemNombre] = useState("");

    // Estado Estadísticas
    const [modalStatsOpen, setModalStatsOpen] = useState(false);

    // --- CARGA DE DATOS ---
    useEffect(() => {
        const unsubProd = onValue(ref(db_realtime, 'productos'), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setProductos(Object.entries(data).map(([id, val]: any) => ({ ...val, id })));
            } else {
                setProductos([]);
            }
        });

        const unsubDev = onValue(ref(db_realtime, 'devoluciones'), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setDevoluciones(Object.entries(data).map(([id, val]: any) => ({ ...val, id })));
            } else {
                setDevoluciones([]);
            }
            setLoading(false);
        });

        return () => { unsubProd(); unsubDev(); };
    }, []);

    // --- LÓGICA DE FORMULARIO ---
    const sugerencias = useMemo(() => {
        if (!busquedaProd) return [];
        return productos.filter(p => 
            (p.categoria && p.categoria.toLowerCase().includes(busquedaProd.toLowerCase())) || 
            p.nombre.toLowerCase().includes(busquedaProd.toLowerCase())
        ).slice(0, 5);
    }, [busquedaProd, productos]);

    const registrarDevolucion = async () => {
        if (!prodSeleccionado || !nroVenta || !motivo) return alert("Faltan datos obligatorios");
        
        try {
            const nombreProductoFinal = prodSeleccionado.categoria 
                ? `${prodSeleccionado.categoria} - ${prodSeleccionado.nombre}`
                : prodSeleccionado.nombre;

            let costoFinal = 0;
            if (tieneCosto && costo) {
                const cleanValue = costo.toString().replace(/\./g, '').replace(',', '.');
                costoFinal = parseFloat(cleanValue);
            }

            await push(ref(db_realtime, 'devoluciones'), {
                usuario: user?.email || "Desconocido",
                fecha: new Date().toLocaleDateString(),
                timestamp: Date.now(),
                producto: nombreProductoFinal,
                venta: nroVenta,
                motivo,
                tieneCosto,
                costo: !isNaN(costoFinal) ? costoFinal : 0
            });
            
            setBusquedaProd("");
            setProdSeleccionado(null);
            setNroVenta("");
            setMotivo("");
            setTieneCosto(false);
            setCosto("");
            alert("Devolución registrada correctamente");
        } catch (e) {
            alert("Error al guardar");
        }
    };

    const guardarNuevoProducto = async () => {
        if (!newItemNombre) return;
        await push(ref(db_realtime, 'productos'), {
            nombre: newItemNombre.toUpperCase()
        });
        setNewItemNombre("");
        setModalProdOpen(false);
    };

    // --- LÓGICA DE VISUALIZACIÓN ---
    const misDevoluciones = devoluciones
        .filter(d => d.usuario === user?.email)
        .sort((a, b) => b.timestamp - a.timestamp);

    const gruposFecha = misDevoluciones.reduce((acc, curr) => {
        const fecha = curr.fecha;
        if (!acc[fecha]) acc[fecha] = [];
        acc[fecha].push(curr);
        return acc;
    }, {} as Record<string, Devolucion[]>);

    // --- ESTADÍSTICAS ---
    const statsMotivos = useMemo(() => {
        const counts: Record<string, number> = {};
        devoluciones.forEach(d => { counts[d.motivo] = (counts[d.motivo] || 0) + 1; });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [devoluciones]);

    const statsProductos = useMemo(() => {
        const counts: Record<string, number> = {};
        devoluciones.forEach(d => { counts[d.producto] = (counts[d.producto] || 0) + 1; });
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a,b) => b.value - a.value)
            .slice(0, 5); 
    }, [devoluciones]);

    const statsUsuarios = useMemo(() => {
        const counts: Record<string, number> = {};
        devoluciones.forEach(d => { counts[d.usuario] = (counts[d.usuario] || 0) + 1; });
        return Object.entries(counts).map(([name, value]) => ({ name: name.split('@')[0], value }));
    }, [devoluciones]);

    const costoTotalUsuario = useMemo(() => {
        return misDevoluciones.reduce((acc, curr) => acc + (curr.costo || 0), 0);
    }, [misDevoluciones]);


    if (loading) return <div className="min-h-screen bg-[#050b14] flex items-center justify-center"><div className="text-violet-500 font-mono animate-pulse uppercase tracking-widest">LOADING RMA SYSTEM...</div></div>;

    return (
        <div className="min-h-screen relative font-sans text-cyan-50 bg-[#050b14] selection:bg-violet-500 selection:text-black pb-20 pt-10 px-4">
            
            {/* GRID DE FONDO DECORATIVO */}
            <div className="fixed inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #1e293b 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

            <div className="max-w-7xl mx-auto relative z-10">
                
                {/* ENCABEZADO */}
                <header className="mb-10 flex flex-col md:flex-row justify-between items-end gap-6 border-b border-violet-900/50 pb-6">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tighter mb-2 uppercase drop-shadow-[0_0_10px_rgba(139,92,246,0.5)]">
                            GESTIÓN <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-600">DEVOLUCIONES</span>
                        </h1>
                        <p className="text-violet-500 font-mono text-xs uppercase tracking-[0.3em]">Control de Devoluciones y Garantías</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-2 font-mono bg-slate-900/50 inline-block px-2 py-1 rounded border border-slate-700">
                            👤 USUARIO: {user?.email?.split('@')[0]}
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button 
                            onClick={() => setModalProdOpen(true)}
                            className="px-4 py-3 bg-[#0f172a] border border-violet-500/30 rounded-xl shadow-[0_0_15px_rgba(139,92,246,0.1)] hover:shadow-[0_0_20px_rgba(139,92,246,0.2)] text-violet-300 font-bold text-xs flex items-center gap-2 uppercase tracking-wide transition-all hover:bg-violet-900/20 font-mono"
                        >
                            📦 + PRODUCTO
                        </button>
                        <button 
                            onClick={() => setModalStatsOpen(true)}
                            className="px-4 py-3 bg-violet-600 text-black rounded-xl shadow-[0_0_15px_rgba(139,92,246,0.4)] hover:bg-violet-400 font-black text-xs flex items-center gap-2 uppercase tracking-wide transition-all font-mono active:scale-95"
                        >
                            📊 ESTADÍSTICAS
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* COLUMNA IZQUIERDA: FORMULARIO */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-[#0f172a]/60 backdrop-blur-md p-6 rounded-[2rem] shadow-xl border border-slate-800 relative overflow-hidden group">
                            
                            {/* Decorative Top */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500"></div>
                            
                            <h2 className="text-xl font-black text-white mb-6 uppercase italic tracking-tighter">REGISTRAR PAQUETE</h2>
                            
                            <div className="space-y-5">
                                <div className="relative">
                                    <label className="text-[10px] font-black text-violet-400 uppercase tracking-widest ml-2 mb-2 block font-mono">PRODUCTO</label>
                                    <input 
                                        type="text" 
                                        placeholder="BUSCAR ITEM..." 
                                        value={busquedaProd}
                                        onChange={(e) => { setBusquedaProd(e.target.value); setProdSeleccionado(null); }}
                                        className={`w-full p-4 border rounded-xl font-bold font-mono text-sm outline-none transition-all uppercase placeholder-slate-600 ${
                                            prodSeleccionado 
                                            ? 'border-emerald-500 bg-emerald-900/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
                                            : 'border-slate-700 bg-black/40 text-slate-300 focus:border-violet-500 focus:shadow-[0_0_15px_rgba(139,92,246,0.2)]'
                                        }`}
                                    />
                                    {busquedaProd && !prodSeleccionado && sugerencias.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 bg-[#0f172a] border border-violet-900 rounded-xl shadow-2xl z-20 mt-2 overflow-hidden">
                                            {sugerencias.map(p => (
                                                <div 
                                                    key={p.id} 
                                                    onClick={() => { 
                                                        const display = p.categoria ? `${p.categoria} - ${p.nombre}` : p.nombre;
                                                        setProdSeleccionado(p); 
                                                        setBusquedaProd(display); 
                                                    }}
                                                    className="p-3 hover:bg-violet-900/30 cursor-pointer border-b border-slate-800 last:border-0 group"
                                                >
                                                    {p.categoria && <span className="font-black text-[9px] text-violet-500 uppercase mr-2 font-mono block group-hover:text-violet-400">{p.categoria}</span>}
                                                    <span className="font-bold text-xs text-slate-300 uppercase group-hover:text-white font-mono">{p.nombre}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-violet-400 uppercase tracking-widest ml-2 mb-2 block font-mono">N° VENTA / REF</label>
                                    <input 
                                        type="text" 
                                        value={nroVenta}
                                        onChange={(e) => setNroVenta(e.target.value)}
                                        className="w-full p-4 bg-black/40 border border-slate-700 rounded-xl font-bold font-mono text-sm outline-none focus:border-violet-500 text-white placeholder-slate-600 transition-all uppercase"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-violet-400 uppercase tracking-widest ml-2 mb-2 block font-mono">MOTIVO</label>
                                    <select 
                                        value={motivo}
                                        onChange={(e) => setMotivo(e.target.value)}
                                        className="w-full p-4 bg-black/40 border border-slate-700 rounded-xl font-bold font-mono text-sm outline-none focus:border-violet-500 text-white uppercase cursor-pointer appearance-none transition-all"
                                    >
                                        <option value="">-- SELECCIONAR --</option>
                                        {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>

                                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="text-[10px] font-black text-violet-400 uppercase tracking-widest font-mono">GENERO COSTO?</label>
                                        <input 
                                            type="checkbox" 
                                            checked={tieneCosto} 
                                            onChange={(e) => setTieneCosto(e.target.checked)}
                                            className="w-5 h-5 accent-violet-500 rounded cursor-pointer bg-slate-800 border-slate-600" 
                                        />
                                    </div>
                                    {tieneCosto && (
                                        <input 
                                            type="text" 
                                            placeholder="$ AMOUNT"
                                            value={costo}
                                            onChange={(e) => setCosto(e.target.value)}
                                            className="w-full p-3 bg-black border border-red-900/50 rounded-lg font-bold font-mono text-sm outline-none focus:border-red-500 text-red-400 placeholder-red-900/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
                                        />
                                    )}
                                </div>

                                <button 
                                    onClick={registrarDevolucion}
                                    className="w-full py-4 bg-violet-600 text-white rounded-xl font-black font-mono uppercase tracking-widest hover:bg-violet-500 shadow-[0_0_20px_rgba(139,92,246,0.4)] active:scale-95 transition-all flex justify-center items-center gap-2"
                                >
                                    <span>💾</span> REGISTRAR
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* COLUMNA DERECHA: LISTADO */}
                    <div className="lg:col-span-2 space-y-6">
                        <h2 className="text-xl font-black text-white uppercase italic flex items-center gap-2 tracking-tight">
                            <span className="text-violet-500">///</span> HISTORIAL DEVOLUCIONES
                        </h2>

                        {Object.keys(gruposFecha).length === 0 ? (
                            <div className="p-10 border-2 border-dashed border-slate-800 rounded-[2rem] text-center text-slate-600 font-mono font-bold bg-[#0f172a]/30">
                                No has registrado devoluciones aún...
                            </div>
                        ) : (
                            Object.entries(gruposFecha).sort((a,b) => b[0].localeCompare(a[0])).map(([fecha, items]) => (
                                <details key={fecha} className="group bg-[#0f172a]/60 backdrop-blur-md rounded-[1.5rem] shadow-lg border border-slate-800 overflow-hidden open:border-violet-500/30 open:shadow-[0_0_20px_rgba(139,92,246,0.1)] transition-all" open>
                                    <summary className="p-5 flex justify-between items-center cursor-pointer bg-slate-900/80 hover:bg-slate-800 transition-colors list-none border-b border-slate-800">
                                        <span className="font-black text-white uppercase tracking-wider font-mono flex items-center gap-2">
                                            <span className="text-violet-500">📅</span> {fecha}
                                        </span>
                                        <span className="bg-violet-900/30 text-violet-300 border border-violet-500/30 px-3 py-1 rounded text-xs font-bold font-mono uppercase">
                                            {items.length} ENTRIES
                                        </span>
                                    </summary>
                                    <div className="p-2 space-y-2">
                                        {items.map(d => (
                                            <div key={d.id} className="p-4 bg-transparent border border-slate-800/50 hover:border-slate-700 hover:bg-slate-800/30 rounded-xl transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group/item">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[9px] font-black bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded uppercase font-mono tracking-wide">REF: {d.venta}</span>
                                                        {d.tieneCosto && <span className="text-[9px] font-black bg-red-900/30 text-red-400 border border-red-500/30 px-2 py-0.5 rounded uppercase font-mono tracking-wide">COSTO: ${d.costo}</span>}
                                                    </div>
                                                    <p className="font-bold text-slate-200 text-sm uppercase tracking-wide">{d.producto}</p>
                                                    <p className="text-[10px] text-violet-400 font-bold uppercase tracking-widest mt-1 font-mono">MOTIVO: {d.motivo}</p>
                                                </div>
                                                <button 
                                                    onClick={() => { if(window.confirm("Purge this record?")) remove(ref(db_realtime, `devoluciones/${d.id}`)); }}
                                                    className="text-slate-600 hover:text-red-500 font-bold text-xl px-2 opacity-0 group-hover/item:opacity-100 transition-all"
                                                    title="Delete"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            ))
                        )}
                    </div>
                </div>

                {/* --- MODAL CARGA PRODUCTO --- */}
                {modalProdOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => setModalProdOpen(false)}>
                        <div className="bg-[#0f172a] rounded-[2rem] p-8 w-full max-w-md shadow-[0_0_50px_rgba(139,92,246,0.2)] animate-in zoom-in border border-violet-900/50" onClick={e => e.stopPropagation()}>
                            <h3 className="text-xl font-black text-white mb-6 uppercase italic tracking-tighter flex items-center gap-2">
                                <span className="text-emerald-500">+</span> NUEVO PRODUCTO
                            </h3>
                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-violet-400 uppercase tracking-widest ml-2 mb-2 block font-mono">NOMBRE DEL PRODUCTO</label>
                                    <input 
                                        className="w-full p-4 bg-black border border-slate-700 rounded-xl font-bold font-mono uppercase text-sm text-white outline-none focus:border-emerald-500 focus:shadow-[0_0_15px_rgba(16,185,129,0.2)] placeholder-slate-700 transition-all"
                                        placeholder="Ej: TRICICLO, PATIN..."
                                        value={newItemNombre}
                                        onChange={e => setNewItemNombre(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <button onClick={guardarNuevoProducto} className="w-full py-4 bg-emerald-600 text-black rounded-xl font-black font-mono uppercase tracking-widest hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all active:scale-95">
                                    GUARDAR PRODUCTO
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- MODAL ESTADÍSTICAS --- */}
                {modalStatsOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md" onClick={() => setModalStatsOpen(false)}>
                        <div className="bg-[#0f172a] rounded-[2.5rem] w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-[0_0_50px_rgba(139,92,246,0.1)] animate-in zoom-in border border-slate-800" onClick={e => e.stopPropagation()}>
                            <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-[#0f172a]/90 sticky top-0 z-10 backdrop-blur-md">
                                <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter flex items-center gap-3">
                                    <span className="text-violet-500">📊</span> Estadísticas de Devoluciones
                                </h3>
                                <button onClick={() => setModalStatsOpen(false)} className="text-slate-500 hover:text-white text-2xl font-bold transition-colors">✕</button>
                            </div>
                            
                            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                                
                                {/* KPI COSTO TOTAL */}
                                <div className="bg-red-900/10 p-6 rounded-[2rem] border border-red-500/30 md:col-span-2 flex justify-between items-center shadow-[0_0_20px_rgba(239,68,68,0.1)] relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="relative z-10">
                                        <h4 className="text-[10px] font-black text-red-400 uppercase tracking-[0.2em] mb-1 font-mono">Mis Costos Totales</h4>
                                        <p className="text-[10px] text-red-300/70 font-mono">Acumulado histórico de devoluciones con costo</p>
                                    </div>
                                    <p className="text-4xl font-black text-red-500 font-mono drop-shadow-[0_0_10px_rgba(239,68,68,0.5)] relative z-10">$ {costoTotalUsuario.toLocaleString()}</p>
                                </div>

                                {/* 1. Motivos Frecuentes */}
                                <div className="bg-[#0f172a]/60 p-6 rounded-[2rem] border border-slate-800">
                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6 text-center font-mono">Motivos más frecuentes</h4>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={statsMotivos} layout="vertical" margin={{left: 30}}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={THEME.grid} />
                                                <XAxis type="number" hide />
                                                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10, fontWeight: 'bold', fill: THEME.textMuted}} axisLine={false} tickLine={false} />
                                                <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '10px', color: '#fff'}} />
                                                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* 2. Productos Más Devueltos */}
                                <div className="bg-[#0f172a]/60 p-6 rounded-[2rem] border border-slate-800">
                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6 text-center font-mono">Top 5 Productos Devueltos</h4>
                                    <div className="space-y-4">
                                        {statsProductos.map((p, i) => (
                                            <div key={i} className="flex justify-between items-center group">
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-6 h-6 flex items-center justify-center rounded text-[10px] font-black font-mono ${i===0 ? 'bg-yellow-500 text-black shadow-[0_0_10px_yellow]' : 'bg-slate-800 text-slate-500'}`}>{i+1}</span>
                                                    <span className="font-bold text-xs text-slate-300 truncate max-w-[200px] uppercase font-mono group-hover:text-violet-400 transition-colors">{p.name}</span>
                                                </div>
                                                <span className="font-black text-white font-mono bg-slate-900 px-2 py-1 rounded border border-slate-700 text-xs">{p.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 3. Usuarios con más devoluciones */}
                                <div className="bg-[#0f172a]/60 p-6 rounded-[2rem] border border-slate-800 md:col-span-2">
                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6 text-center font-mono">Volumen por Usuario (Cuenta)</h4>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={statsUsuarios}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={80}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                    stroke="none"
                                                >
                                                    {statsUsuarios.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '10px', color: '#fff'}} />
                                                <Legend verticalAlign="bottom" height={36} formatter={(value) => <span className="text-slate-400 font-bold text-xs uppercase ml-1 font-mono">{value}</span>} />
                                            </PieChart>
                                        </ResponsiveContainer>
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

export default Devoluciones;