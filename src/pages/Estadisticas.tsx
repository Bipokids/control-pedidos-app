import React, { useEffect, useState } from 'react';
import { db_realtime } from '../firebase/config';
import { ref, onValue } from "firebase/database";
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';
import { format, parseISO, getDay } from 'date-fns';
import { es } from 'date-fns/locale';

// --- PALETA DE COLORES PROFESIONAL ---
const THEME = {
    primary: '#4f46e5',   // Indigo 600
    secondary: '#8b5cf6', // Violet 500
    success: '#10b981',   // Emerald 500
    warning: '#f59e0b',   // Amber 500
    danger: '#ef4444',    // Red 500
    dark: '#1e293b',      // Slate 800
    grid: '#f1f5f9'       // Slate 100
};

const COLORS_PIE = [THEME.primary, THEME.success, THEME.warning, THEME.secondary];

const Estadisticas: React.FC = () => {
    const [loading, setLoading] = useState(true);
    
    // Estados de datos
    const [topProductos, setTopProductos] = useState<any[]>([]);
    const [topClientes, setTopClientes] = useState<any[]>([]);
    const [topClientesSoportes, setTopClientesSoportes] = useState<any[]>([]); // NUEVO
    const [evolucionMensual, setEvolucionMensual] = useState<any[]>([]);
    const [distribucionTipos, setDistribucionTipos] = useState<any[]>([]);
    const [actividadSemanal, setActividadSemanal] = useState<any[]>([]); 
    const [kpis, setKpis] = useState({ 
        totalDespachos: 0, 
        totalItems: 0, 
        promedioItems: 0
    });

    useEffect(() => {
        const despachosRef = ref(db_realtime, 'despachos');
        const unsubscribe = onValue(despachosRef, (snapshot) => {
            if (!snapshot.exists()) {
                setLoading(false); return;
            }
            procesarDatos(snapshot.val());
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const procesarDatos = (data: any) => {
        const prodCount: Record<string, number> = {};
        const clientVol: Record<string, number> = {}; 
        const clientSoporteCount: Record<string, number> = {}; // Acumulador Soportes
        const timeline: Record<string, number> = {}; 
        const weeklyStats = [0,0,0,0,0,0,0]; // Dom (0) a Sab (6)
        
        let countRemitos = 0;
        let countSoportes = 0;
        let totalItemsGlobal = 0;
        let totalDespachosGlobal = 0;

        Object.entries(data).forEach(([fecha, items]: [string, any]) => {
            const dateObj = parseISO(fecha);
            const dayIndex = getDay(dateObj); // 0 = Domingo, 1 = Lunes...
            
            Object.values(items).forEach((d: any) => {
                totalDespachosGlobal++;
                weeklyStats[dayIndex]++; 

                if (d.numeroRemito) {
                    countRemitos++;
                    // Lógica Productos y Volumne Ventas
                    if (d.productos) {
                        let itemsEnEsteDespacho = 0;
                        if (typeof d.productos === 'object') {
                            Object.entries(d.productos).forEach(([prodName, qty]: [string, any]) => {
                                const cantidad = Number(qty);
                                if (!isNaN(cantidad)) {
                                    prodCount[prodName] = (prodCount[prodName] || 0) + cantidad;
                                    itemsEnEsteDespacho += cantidad;
                                }
                            });
                        }
                        const cliente = d.cliente || 'Desconocido';
                        clientVol[cliente] = (clientVol[cliente] || 0) + itemsEnEsteDespacho;

                        const mesKey = fecha.substring(0, 7); 
                        timeline[mesKey] = (timeline[mesKey] || 0) + itemsEnEsteDespacho;
                        totalItemsGlobal += itemsEnEsteDespacho;
                    }
                } else {
                    countSoportes++;
                    // Lógica Soportes por Cliente
                    const cliente = d.cliente || 'Desconocido';
                    clientSoporteCount[cliente] = (clientSoporteCount[cliente] || 0) + 1;
                }
            });
        });

        // 1. Tops (Limitados a 10)
        const arrProd = Object.entries(prodCount).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
        const arrClient = Object.entries(clientVol).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
        const arrClientSoporte = Object.entries(clientSoporteCount).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);

        // 2. Evolución
        const arrTime = Object.entries(timeline).map(([dateKey, value]) => ({
            dateKey, 
            name: format(parseISO(`${dateKey}-01`), 'MMM', { locale: es }).toUpperCase(),
            fullDate: format(parseISO(`${dateKey}-01`), 'MMMM yyyy', { locale: es }),
            value
        })).sort((a, b) => a.dateKey.localeCompare(b.dateKey));

        // 3. Distribución
        const arrType = [
            { name: 'Ventas', value: countRemitos },
            { name: 'Soportes', value: countSoportes },
        ];

        // 4. Actividad Semanal (Filtrando Sábado index 6 y Domingo index 0 si quisieras)
        const daysLabels = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];
        // Filtramos para quitar Sábado (index 6) y Domingo (index 0) para dejar solo días hábiles
        const arrWeekly = weeklyStats
            .map((val, i) => ({ name: daysLabels[i], value: val, index: i }))
            .filter(d => d.index !== 0 && d.index !== 6); // Quitamos Dom y Sab

        setTopProductos(arrProd);
        setTopClientes(arrClient);
        setTopClientesSoportes(arrClientSoporte);
        setEvolucionMensual(arrTime);
        setDistribucionTipos(arrType);
        setActividadSemanal(arrWeekly);
        setKpis({
            totalDespachos: totalDespachosGlobal,
            totalItems: totalItemsGlobal,
            promedioItems: totalDespachosGlobal > 0 ? Math.round(totalItemsGlobal / countRemitos) : 0
        });
    };

    // Componente Custom Tooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-800 text-white p-3 rounded-xl shadow-2xl border border-slate-700">
                    <p className="text-xs font-bold text-slate-400 mb-1">{label}</p>
                    <p className="text-lg font-black">{payload[0].value} <span className="text-xs font-normal text-slate-400">unid.</span></p>
                </div>
            );
        }
        return null;
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400 font-bold animate-pulse">Cargando Intelligence...</div>;

    return (
        <div className="max-w-7xl mx-auto px-6 py-10 font-sans min-h-screen bg-slate-50/[0.5]">
            
            <header className="mb-12 flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">
                        Panel <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Métricas</span>
                    </h1>
                    <p className="text-slate-500 font-medium text-sm">Análisis de rendimiento y logística.</p>
                </div>
                <div className="hidden md:block text-right">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Última actualización</p>
                    <p className="text-sm font-bold text-slate-700">{new Date().toLocaleDateString()}</p>
                </div>
            </header>

            {/* --- SECCIÓN KPI (3 Columnas ahora) --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <KpiCard title="Total Movimientos" value={kpis.totalDespachos} icon="📦" trend="Global" color="text-indigo-600" />
                <KpiCard title="Productos Salida" value={kpis.totalItems} icon="🚀" trend="Ventas" color="text-emerald-600" />
                <KpiCard title="Promedio x Pedido" value={kpis.promedioItems} unit="items" icon="⚖️" color="text-amber-500" />
            </div>

            {/* --- SECCIÓN GRÁFICOS PRINCIPALES --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                
                {/* 1. TENDENCIA MENSUAL */}
                <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-xl shadow-indigo-100/50 border border-slate-50">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-xl font-bold text-slate-800">Evolución de Ventas</h3>
                        <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-black uppercase">Anual</span>
                    </div>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={evolucionMensual}>
                                <defs>
                                    <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={THEME.primary} stopOpacity={0.4}/>
                                        <stop offset="95%" stopColor={THEME.primary} stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={THEME.grid} />
                                <XAxis dataKey="name" tick={{fontSize: 12, fill: '#94a3b8', fontWeight: 'bold'}} axisLine={false} tickLine={false} dy={10} />
                                <YAxis tick={{fontSize: 12, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: THEME.primary, strokeWidth: 2, strokeDasharray: '5 5' }} />
                                <Area type="monotone" dataKey="value" stroke={THEME.primary} strokeWidth={4} fill="url(#colorGradient)" activeDot={{ r: 8, strokeWidth: 0 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. TIPOS DE OPERACIÓN */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-indigo-100/50 border border-slate-50 flex flex-col justify-center">
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Distribución</h3>
                    <p className="text-sm text-slate-400 mb-6">Comparativa Ventas vs. Soportes</p>
                    <div className="h-64 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={distribucionTipos}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={90}
                                    paddingAngle={5}
                                    dataKey="value"
                                    cornerRadius={10}
                                    stroke="none"
                                >
                                    {distribucionTipos.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS_PIE[index % COLORS_PIE.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-20px]">
                            <span className="text-4xl font-black text-slate-800">{kpis.totalDespachos}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ops Totales</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- SECCIÓN DETALLES (2 COLUMNAS) --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">

                {/* 3. ACTIVIDAD SEMANAL */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-indigo-100/50 border border-slate-50">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">📅 Actividad Semanal (Lun-Vie)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={actividadSemanal}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={THEME.grid} />
                                <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '10px'}} />
                                <Bar dataKey="value" fill={THEME.warning} radius={[6, 6, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 4. TOP 10 PRODUCTOS */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-indigo-100/50 border border-slate-50">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">🏆 Top 10 Productos</h3>
                    <div className="space-y-3 overflow-y-auto max-h-64 pr-2 custom-scrollbar">
                        {topProductos.map((prod, i) => (
                            <div key={i} className="flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${i < 3 ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                        {i + 1}
                                    </span>
                                    <span className="text-xs font-bold text-slate-600 truncate max-w-[150px]" title={prod.name}>{prod.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(prod.value / topProductos[0].value) * 100}%` }}></div>
                                    </div>
                                    <span className="text-xs font-black text-slate-800 w-8 text-right">{prod.value}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* --- SECCIÓN CLIENTES (COMPARATIVA) --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* 5. TOP 10 CLIENTES (VENTAS) */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-indigo-100/50 border border-slate-50">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        ⭐ Mejores Clientes <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded uppercase">Ventas</span>
                    </h3>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={topClientes} margin={{ left: 0, right: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={THEME.grid} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={90} tick={{fontSize: 9, fill: '#64748b', fontWeight:'bold'}} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{fill: '#f8fafc'}} />
                                <Bar dataKey="value" fill={THEME.success} radius={[0, 4, 4, 0]} barSize={15} name="Unidades" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 6. TOP 10 CLIENTES (SOPORTES) */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-indigo-100/50 border border-slate-50">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        🛠️ Más solicitudes <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-1 rounded uppercase">Soportes</span>
                    </h3>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={topClientesSoportes} margin={{ left: 0, right: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={THEME.grid} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={90} tick={{fontSize: 9, fill: '#64748b', fontWeight:'bold'}} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{fill: '#f8fafc'}} />
                                <Bar dataKey="value" fill={THEME.warning} radius={[0, 4, 4, 0]} barSize={15} name="Solicitudes" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>
        </div>
    );
};

// Componente Auxiliar para Tarjetas KPI
const KpiCard = ({ title, value, unit, icon, trend, color }: any) => (
    <div className="bg-white p-6 rounded-[2rem] shadow-lg shadow-indigo-50 border border-slate-50 transition-transform hover:-translate-y-1 hover:shadow-xl">
        <div className="flex justify-between items-start mb-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${color.replace('text-', 'bg-').replace('600', '100').replace('500','100')}`}>
                {icon}
            </div>
            {trend && (
                <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wide">
                    {trend}
                </span>
            )}
        </div>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">{title}</p>
        <h2 className="font-black text-slate-800 text-4xl">
            {value} <span className="text-sm text-slate-400 font-bold">{unit}</span>
        </h2>
    </div>
);

export default Estadisticas;