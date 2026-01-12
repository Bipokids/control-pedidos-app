import React, { useEffect, useState } from 'react';
import { db_realtime } from '../firebase/config';
import { ref, onValue } from "firebase/database";
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
    AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';
import { format, parseISO, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

// --- COLORES MODERNOS ---
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const Estadisticas: React.FC = () => {
    const [loading, setLoading] = useState(true);
    
    // Estados para las gráficas
    const [topProductos, setTopProductos] = useState<any[]>([]);
    const [topClientes, setTopClientes] = useState<any[]>([]);
    const [evolucionMensual, setEvolucionMensual] = useState<any[]>([]);
    const [distribucionTipos, setDistribucionTipos] = useState<any[]>([]);
    const [kpis, setKpis] = useState({ totalDespachos: 0, totalItems: 0, promedioItems: 0 });

    useEffect(() => {
        const despachosRef = ref(db_realtime, 'despachos');
        const unsubscribe = onValue(despachosRef, (snapshot) => {
            if (!snapshot.exists()) {
                setLoading(false);
                return;
            }

            const data = snapshot.val();
            procesarDatos(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const procesarDatos = (data: any) => {
        // Estructuras temporales para acumular datos
        const prodCount: Record<string, number> = {};
        const clientVol: Record<string, number> = {}; // Volumen de items por cliente
        const timeline: Record<string, number> = {}; // Items por mes (YYYY-MM)
        let countRemitos = 0;
        let countSoportes = 0;
        let totalItemsGlobal = 0;
        let totalDespachosGlobal = 0;

        // Iterar Fechas
        Object.entries(data).forEach(([fecha, items]: [string, any]) => {
            // Iterar Despachos dentro de la fecha
            Object.values(items).forEach((d: any) => {
                totalDespachosGlobal++;
                
                // 1. Distinguir Tipo
                if (d.numeroRemito) countRemitos++;
                else countSoportes++;

                // Solo analizamos productos de REMITOS (Ventas)
                if (d.numeroRemito && d.productos) {
                    let itemsEnEsteDespacho = 0;

                    // Manejar estructura de productos (Map o Array)
                    if (typeof d.productos === 'object') {
                        Object.entries(d.productos).forEach(([prodName, qty]: [string, any]) => {
                            const cantidad = Number(qty);
                            if (!isNaN(cantidad)) {
                                // Acumular Producto
                                prodCount[prodName] = (prodCount[prodName] || 0) + cantidad;
                                itemsEnEsteDespacho += cantidad;
                            }
                        });
                    }

                    // Acumular Cliente
                    const cliente = d.cliente || 'Desconocido';
                    clientVol[cliente] = (clientVol[cliente] || 0) + itemsEnEsteDespacho;

                    // Acumular Timeline (Mes)
                    // La fecha viene como YYYY-MM-DD
                    const mesKey = fecha.substring(0, 7); // YYYY-MM
                    timeline[mesKey] = (timeline[mesKey] || 0) + itemsEnEsteDespacho;

                    totalItemsGlobal += itemsEnEsteDespacho;
                }
            });
        });

        // --- TRANSFORMAR A ARRAYS PARA RECHARTS ---

        // 1. Top 10 Productos
        const arrProd = Object.entries(prodCount)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

        // 2. Top 10 Clientes
        const arrClient = Object.entries(clientVol)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

        // 3. Evolución Mensual (Ordenada cronológicamente)
        const arrTime = Object.entries(timeline)
            .map(([dateKey, value]) => ({
                dateKey, 
                name: format(parseISO(`${dateKey}-01`), 'MMM yy', { locale: es }), // Ej: "Ene 24"
                value
            }))
            .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

        // 4. Distribución
        const arrType = [
            { name: 'Ventas (Remitos)', value: countRemitos },
            { name: 'Soportes (Taller)', value: countSoportes },
        ];

        setTopProductos(arrProd);
        setTopClientes(arrClient);
        setEvolucionMensual(arrTime);
        setDistribucionTipos(arrType);
        setKpis({
            totalDespachos: totalDespachosGlobal,
            totalItems: totalItemsGlobal,
            promedioItems: totalDespachosGlobal > 0 ? Math.round(totalItemsGlobal / countRemitos) : 0
        });
    };

    if (loading) return <div className="p-10 text-center text-slate-400 font-bold animate-pulse">Cargando Estadísticas...</div>;

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 font-sans min-h-screen bg-slate-50">
            
            <header className="mb-10">
                <h1 className="text-3xl font-black text-slate-800 italic uppercase tracking-tighter">
                    Dashboard <span className="text-indigo-600">Estadísticas</span>
                </h1>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">
                    Análisis de datos de despacho
                </p>
            </header>

            {/* --- KPIs (Tarjetas Superiores) --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-indigo-100 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Movimientos</p>
                        <p className="text-4xl font-black text-slate-800 mt-2">{kpis.totalDespachos}</p>
                    </div>
                    <div className="text-4xl">📦</div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-100 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Productos Vendidos</p>
                        <p className="text-4xl font-black text-emerald-600 mt-2">{kpis.totalItems}</p>
                    </div>
                    <div className="text-4xl">🚲</div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-purple-100 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Promedio x Pedido</p>
                        <p className="text-4xl font-black text-purple-600 mt-2">{kpis.promedioItems} <span className="text-sm text-slate-400 font-bold">unid.</span></p>
                    </div>
                    <div className="text-4xl">📊</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                
                {/* 1. GRÁFICO: EVOLUCIÓN MENSUAL (Area) */}
                <div className="bg-white p-6 rounded-[2rem] shadow-lg border border-slate-100">
                    <h3 className="text-lg font-black text-slate-700 uppercase mb-6 flex items-center gap-2">
                        📈 Tendencia de Ventas <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-400">Mensual</span>
                    </h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={evolucionMensual}>
                                <defs>
                                    <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                                <YAxis tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                    cursor={{ stroke: '#6366f1', strokeWidth: 2 }}
                                />
                                <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorVentas)" name="Unidades" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. GRÁFICO: DISTRIBUCIÓN TIPOS (Pie) */}
                <div className="bg-white p-6 rounded-[2rem] shadow-lg border border-slate-100 flex flex-col">
                    <h3 className="text-lg font-black text-slate-700 uppercase mb-6">Operaciones</h3>
                    <div className="h-64 w-full flex-1 relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={distribucionTipos}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {distribucionTipos.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#f59e0b'} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Texto central */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center mt-[-20px]">
                                <span className="block text-3xl font-black text-slate-800">{kpis.totalDespachos}</span>
                                <span className="text-[10px] uppercase font-bold text-slate-400">Total</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* 3. TOP PRODUCTOS (Bar Chart Horizontal) */}
                <div className="bg-white p-6 rounded-[2rem] shadow-lg border border-slate-100">
                    <h3 className="text-lg font-black text-slate-700 uppercase mb-6">🏆 Top 10 Productos</h3>
                    <div className="h-96 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={topProductos} margin={{ left: 40, right: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                <XAxis type="number" hide />
                                <YAxis 
                                    dataKey="name" 
                                    type="category" 
                                    width={100} 
                                    tick={{fontSize: 10, fontWeight: 'bold', fill: '#475569'}} 
                                    axisLine={false} 
                                    tickLine={false}
                                />
                                <Tooltip cursor={{fill: '#f8fafc'}} />
                                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} name="Unidades Vendidas" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 4. TOP CLIENTES (Bar Chart Vertical) */}
                <div className="bg-white p-6 rounded-[2rem] shadow-lg border border-slate-100">
                    <h3 className="text-lg font-black text-slate-700 uppercase mb-6">⭐ Mejores Clientes (Volumen)</h3>
                    <div className="h-96 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topClientes}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="name" 
                                    tick={{fontSize: 9, fill: '#64748b'}} 
                                    interval={0} 
                                    angle={-45} 
                                    textAnchor="end" 
                                    height={60} 
                                    axisLine={false} 
                                    tickLine={false}
                                />
                                <YAxis tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{fill: '#f8fafc'}} />
                                <Bar dataKey="value" fill="#ec4899" radius={[4, 4, 0, 0]} name="Unidades Compradas" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Estadisticas;