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
    categoria?: string; // Opcional (para compatibilidad con datos viejos)
    nombre: string;     // Este es el "Item"
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

// --- CONSTANTES ---
const MOTIVOS = [
    "Falla", "Devolución", "Error de preparación", "Cambio", 
    "Disconformidad", "Embalaje defectuoso", "Faltantes", "No entregado"
];

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe', '#00C49F', '#FFBB28', '#FF8042'];

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

    // Estados Carga de Producto Nuevo (SIMPLIFICADO)
    const [modalProdOpen, setModalProdOpen] = useState(false);
    const [newItemNombre, setNewItemNombre] = useState(""); // Solo pedimos el Item

    // Estado Estadísticas
    const [modalStatsOpen, setModalStatsOpen] = useState(false);

    // --- CARGA DE DATOS ---
    useEffect(() => {
        // 1. Cargar Productos
        const unsubProd = onValue(ref(db_realtime, 'productos'), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setProductos(Object.entries(data).map(([id, val]: any) => ({ ...val, id })));
            } else {
                setProductos([]);
            }
        });

        // 2. Cargar Devoluciones
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

    // --- LÓGICA DE FORMULARIO DEVOLUCIÓN ---
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
            // Construimos el nombre completo (Si tiene categoría la usamos, sino solo el nombre)
            const nombreProductoFinal = prodSeleccionado.categoria 
                ? `${prodSeleccionado.categoria} - ${prodSeleccionado.nombre}`
                : prodSeleccionado.nombre;

            await push(ref(db_realtime, 'devoluciones'), {
                usuario: user?.email || "Desconocido",
                fecha: new Date().toLocaleDateString(),
                timestamp: Date.now(),
                producto: nombreProductoFinal,
                venta: nroVenta,
                motivo,
                tieneCosto,
                costo: tieneCosto ? Number(costo) : 0
            });
            
            // Reset form
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

    // GUARDAR PRODUCTO (SOLO ITEM)
    const guardarNuevoProducto = async () => {
        if (!newItemNombre) return;
        
        await push(ref(db_realtime, 'productos'), {
            nombre: newItemNombre.toUpperCase()
            // No guardamos categoría
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

    // Estadísticas
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


    if (loading) return <div className="p-10 text-center font-bold animate-pulse">Cargando Sistema de Devoluciones...</div>;

    return (
        <div className="max-w-7xl mx-auto px-4 py-10 font-sans min-h-screen bg-slate-50">
            
            {/* ENCABEZADO */}
            <header className="mb-10 flex flex-col md:flex-row justify-between items-end gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">
                        Gestión <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600">Devoluciones</span>
                    </h1>
                    <p className="text-slate-500 font-medium text-sm">Registro y control de paquetería inversa.</p>
                    <p className="text-xs font-bold text-violet-500 mt-1 uppercase tracking-widest">
                        👤 Cuenta: {user?.email?.split('@')[0]}
                    </p>
                </div>

                <div className="flex gap-3">
                    <button 
                        onClick={() => setModalProdOpen(true)}
                        className="px-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md text-slate-600 font-bold text-xs flex items-center gap-2 uppercase tracking-wide transition-all"
                    >
                        📦 + Producto
                    </button>
                    <button 
                        onClick={() => setModalStatsOpen(true)}
                        className="px-4 py-3 bg-slate-900 text-white rounded-2xl shadow-lg hover:bg-violet-600 font-bold text-xs flex items-center gap-2 uppercase tracking-wide transition-all"
                    >
                        📊 Estadísticas Globales
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* COLUMNA IZQUIERDA: FORMULARIO DE CARGA */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-[2.5rem] shadow-xl shadow-violet-100/50 border border-slate-100 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-violet-500 to-fuchsia-500"></div>
                        <h2 className="text-xl font-black text-slate-800 mb-6 uppercase italic">Registrar Paquete</h2>
                        
                        <div className="space-y-4">
                            {/* 1. Buscador de Producto */}
                            <div className="relative">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Producto</label>
                                <input 
                                    type="text" 
                                    placeholder="🔍 Buscar Item..." 
                                    value={busquedaProd}
                                    onChange={(e) => { setBusquedaProd(e.target.value); setProdSeleccionado(null); }}
                                    className={`w-full p-4 border-2 rounded-2xl font-bold text-sm outline-none transition-all ${prodSeleccionado ? 'border-green-400 bg-green-50 text-green-800' : 'border-slate-100 bg-slate-50 focus:border-violet-400'}`}
                                />
                                {/* Sugerencias */}
                                {busquedaProd && !prodSeleccionado && sugerencias.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 bg-white border border-slate-100 rounded-xl shadow-xl z-20 mt-1 overflow-hidden">
                                        {sugerencias.map(p => (
                                            <div 
                                                key={p.id} 
                                                onClick={() => { 
                                                    const display = p.categoria ? `${p.categoria} - ${p.nombre}` : p.nombre;
                                                    setProdSeleccionado(p); 
                                                    setBusquedaProd(display); 
                                                }}
                                                className="p-3 hover:bg-violet-50 cursor-pointer border-b border-slate-50 last:border-0"
                                            >
                                                {p.categoria && <span className="font-black text-[10px] text-slate-400 uppercase mr-2">{p.categoria}</span>}
                                                <span className="font-bold text-xs text-slate-700 uppercase">{p.nombre}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 2. Nro Venta */}
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">N° Venta / Ref</label>
                                <input 
                                    type="text" 
                                    value={nroVenta}
                                    onChange={(e) => setNroVenta(e.target.value)}
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-violet-400"
                                />
                            </div>

                            {/* 3. Motivo */}
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Motivo</label>
                                <select 
                                    value={motivo}
                                    onChange={(e) => setMotivo(e.target.value)}
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-violet-400 uppercase cursor-pointer"
                                >
                                    <option value="">-- Seleccionar --</option>
                                    {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>

                            {/* 4. Costo */}
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">¿Generó Costo?</label>
                                    <input 
                                        type="checkbox" 
                                        checked={tieneCosto} 
                                        onChange={(e) => setTieneCosto(e.target.checked)}
                                        className="w-5 h-5 accent-violet-500 rounded cursor-pointer" 
                                    />
                                </div>
                                {tieneCosto && (
                                    <input 
                                        type="number" 
                                        placeholder="$ Importe..."
                                        value={costo}
                                        onChange={(e) => setCosto(e.target.value)}
                                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-red-400 text-red-600"
                                    />
                                )}
                            </div>

                            <button 
                                onClick={registrarDevolucion}
                                className="w-full py-4 bg-violet-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-violet-700 shadow-lg shadow-violet-200 active:scale-95 transition-all"
                            >
                                Registrar
                            </button>
                        </div>
                    </div>
                </div>

                {/* COLUMNA DERECHA: LISTADO */}
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-xl font-black text-slate-800 uppercase italic flex items-center gap-2">
                        <span>📂</span> Historial de Devoluciones
                    </h2>

                    {Object.keys(gruposFecha).length === 0 ? (
                        <div className="p-10 border-2 border-dashed border-slate-200 rounded-[2rem] text-center text-slate-400 font-bold">
                            No has registrado devoluciones aún.
                        </div>
                    ) : (
                        Object.entries(gruposFecha).sort((a,b) => b[0].localeCompare(a[0])).map(([fecha, items]) => (
                            <details key={fecha} className="group bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden open:shadow-lg transition-all" open>
                                <summary className="p-5 flex justify-between items-center cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors list-none">
                                    <span className="font-black text-slate-700 uppercase tracking-wider">{fecha}</span>
                                    <span className="bg-violet-100 text-violet-700 px-3 py-1 rounded-full text-xs font-bold">{items.length} items</span>
                                </summary>
                                <div className="p-2 space-y-2">
                                    {items.map(d => (
                                        <div key={d.id} className="p-4 bg-white border-b border-slate-50 last:border-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-slate-50 rounded-xl transition-colors">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black bg-slate-200 text-slate-600 px-2 py-0.5 rounded uppercase">Venta: {d.venta}</span>
                                                    {d.tieneCosto && <span className="text-[10px] font-black bg-red-100 text-red-600 px-2 py-0.5 rounded uppercase">Costó: ${d.costo}</span>}
                                                </div>
                                                <p className="font-bold text-slate-800 mt-1">{d.producto}</p>
                                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wide mt-1">Motivo: {d.motivo}</p>
                                            </div>
                                            <button 
                                                onClick={() => { if(window.confirm("Borrar registro?")) remove(ref(db_realtime, `devoluciones/${d.id}`)); }}
                                                className="text-slate-300 hover:text-red-500 font-bold text-xl px-2"
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

            {/* --- MODAL CARGA PRODUCTO SIMPLIFICADO --- */}
            {modalProdOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setModalProdOpen(false)}>
                    <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-black text-slate-800 mb-4 uppercase italic">Nuevo Producto</h3>
                        <div className="space-y-4">
                            
                            {/* UN SOLO CAMPO: ITEM DEL PRODUCTO */}
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Item del Producto</label>
                                <input 
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold uppercase text-sm outline-none focus:border-violet-400"
                                    placeholder="Ej: TRICICLO ROSA, AUTO..."
                                    value={newItemNombre}
                                    onChange={e => setNewItemNombre(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <button onClick={guardarNuevoProducto} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-green-600 transition-colors shadow-lg">
                                Guardar Producto
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL ESTADÍSTICAS --- */}
            {modalStatsOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md" onClick={() => setModalStatsOpen(false)}>
                    <div className="bg-white rounded-[2.5rem] w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in" onClick={e => e.stopPropagation()}>
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
                            <h3 className="text-2xl font-black text-slate-800 uppercase italic">📊 Estadísticas de Devoluciones</h3>
                            <button onClick={() => setModalStatsOpen(false)} className="text-slate-400 hover:text-red-500 text-2xl font-bold">✕</button>
                        </div>
                        
                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* 1. Motivos Frecuentes */}
                            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                                <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 text-center">Motivos más frecuentes</h4>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={statsMotivos} layout="vertical" margin={{left: 30}}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10, fontWeight: 'bold'}} />
                                            <Tooltip />
                                            <Bar dataKey="value" fill="#8b5cf6" radius={[0, 10, 10, 0]} barSize={20} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* 2. Productos Más Devueltos */}
                            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                                <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 text-center">Top 5 Productos Devueltos</h4>
                                <div className="space-y-3">
                                    {statsProductos.map((p, i) => (
                                        <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200">
                                            <div className="flex items-center gap-3">
                                                <span className={`w-6 h-6 flex items-center justify-center rounded-lg text-xs font-black ${i===0 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>{i+1}</span>
                                                <span className="font-bold text-xs text-slate-700 truncate max-w-[150px]">{p.name}</span>
                                            </div>
                                            <span className="font-black text-slate-900">{p.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 3. Usuarios con más devoluciones */}
                            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 md:col-span-2">
                                <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 text-center">Volumen por Usuario (Cuenta)</h4>
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
                                            >
                                                {statsUsuarios.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Devoluciones;