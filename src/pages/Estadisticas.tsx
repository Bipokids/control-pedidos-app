import React, { useEffect, useState } from 'react';
import { db_realtime } from '../firebase/config';
import { ref, onValue } from "firebase/database";
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';
import { format, parseISO, getDay } from 'date-fns';
import { es } from 'date-fns/locale';

// --- PALETA DE COLORES NEON / DEEP SPACE ---
const THEME = {
    primary: '#06b6d4',   // Cyan 500
    secondary: '#8b5cf6', // Violet 500
    success: '#10b981',   // Emerald 500
    warning: '#f59e0b',   // Amber 500
    danger: '#ef4444',    // Red 500
    dark: '#0f172a',      // Slate 900
    grid: '#1e293b',      // Slate 800 (Lineas sutiles)
    textMuted: '#64748b'  // Slate 500
};

const COLORS_PIE = [THEME.primary, THEME.success, THEME.warning, THEME.secondary];

const Estadisticas: React.FC = () => {
    const [loading, setLoading] = useState(true);
    
    // Estados de datos
    const [topProductos, setTopProductos] = useState<any[]>([]);
    const [topClientes, setTopClientes] = useState<any[]>([]);
    const [topClientesSoportes, setTopClientesSoportes] = useState<any[]>([]);
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
        // ... (LÓGICA DE PROCESAMIENTO INTACTA)
        const prodCount: Record<string, number> = {};
        const clientVol: Record<string, number> = {}; 
        const clientSoporteCount: Record<string, number> = {};
        const timeline: Record<string, number> = {}; 
        const weeklyStats = [0,0,0,0,0,0,0];
        
        let countRemitos = 0;
        let countSoportes = 0;
        let totalItemsGlobal = 0;
        let totalDespachosGlobal = 0;

        Object.entries(data).forEach(([fecha, items]: [string, any]) => {
            const dateObj = parseISO(fecha);
            const dayIndex = getDay(dateObj);
            
            Object.values(items).forEach((d: any) => {
                totalDespachosGlobal++;
                weeklyStats[dayIndex]++; 

                if (d.numeroRemito) {
                    countRemitos++;
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
                    const cliente = d.cliente || 'Desconocido';
                    clientSoporteCount[cliente] = (clientSoporteCount[cliente] || 0) + 1;
                }
            });
        });

        const arrProd = Object.entries(prodCount).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
        const arrClient = Object.entries(clientVol).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
        const arrClientSoporte = Object.entries(clientSoporteCount).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);

        const arrTime = Object.entries(timeline).map(([dateKey, value]) => ({
            dateKey, 
            name: format(parseISO(`${dateKey}-01`), 'MMM', { locale: es }).toUpperCase(),
            fullDate: format(parseISO(`${dateKey}-01`), 'MMMM yyyy', { locale: es }),
            value
        })).sort((a, b) => a.dateKey.localeCompare(b.dateKey));

        const arrType = [
            { name: 'Ventas', value: countRemitos },
            { name: 'Soportes', value: countSoportes },
        ];

        const daysLabels = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];
        const arrWeekly = weeklyStats
            .map((val, i) => ({ name: daysLabels[i], value: val, index: i }))
            .filter(d => d.index !== 0 && d.index !== 6);

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

    // Componente Custom Tooltip (Estilo Dark Glass)
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-[#0f172a]/90 backdrop-blur-md text-cyan-50 p-4 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.5)] border border-cyan-500/30">
                    <p className="text-[10px] font-bold text-cyan-400 mb-1 uppercase tracking-widest">{label}</p>
                    <p className="text-xl font-black font-mono">{payload[0].value} <span className="text-xs font-normal text-slate-400">unid.</span></p>
                </div>
            );
        }
        return null;
    };

    if (loading) return <div className="min-h-screen bg-[#050b14] flex items-center justify-center"><div className="text-cyan-500 font-mono animate-pulse uppercase tracking-widest">Calculando Métricas...</div></div>;

    return (
        <div className="min-h-screen relative font-sans text-cyan-50 bg-[#050b14] selection:bg-cyan-500 selection:text-black pb-20 pt-10 px-6">
            
            {/* GRID DE FONDO */}
            <div className="fixed inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #1e293b 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

            <div className="max-w-7xl mx-auto relative z-10">

                <header className="mb-12 flex justify-between items-end border-b border-cyan-900/50 pb-6">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tighter mb-2 uppercase drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                            CONTROL <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-500">MÉTRICAS</span>
                        </h1>
                        <p className="text-cyan-600 font-mono text-xs uppercase tracking-[0.3em]">Análisis de Rendimiento & Logística</p>
                    </div>
                    <div className="hidden md:block text-right">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Last Sync</p>
                        <p className="text-sm font-bold text-cyan-400 font-mono">{new Date().toLocaleDateString()}</p>
                    </div>
                </header>

                {/* --- SECCIÓN KPI --- */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    <KpiCard title="Total Movimientos" value={kpis.totalDespachos} icon="📦" trend="GLOBAL" color="text-cyan-400" borderColor="border-cyan-500/30" shadow="shadow-cyan-500/10" />
                    <KpiCard title="Productos Salida" value={kpis.totalItems} icon="🚀" trend="VENTAS" color="text-violet-400" borderColor="border-violet-500/30" shadow="shadow-violet-500/10" />
                    <KpiCard title="Promedio x Pedido" value={kpis.promedioItems} unit="items" icon="⚖️" color="text-emerald-400" borderColor="border-emerald-500/30" shadow="shadow-emerald-500/10" />
                </div>

                {/* --- SECCIÓN GRÁFICOS PRINCIPALES --- */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                    
                    {/* 1. TENDENCIA MENSUAL */}
                    <div className="lg:col-span-2 bg-[#0f172a]/60 backdrop-blur-md p-8 rounded-[2rem] shadow-xl border border-slate-800 relative group hover:border-cyan-500/30 transition-all">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-bold text-white uppercase tracking-tight">Evolución de Ventas</h3>
                            <span className="bg-cyan-900/30 text-cyan-400 px-3 py-1 rounded text-[10px] font-black uppercase font-mono border border-cyan-500/30">Anual</span>
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
                                    <XAxis dataKey="name" tick={{fontSize: 10, fill: THEME.textMuted, fontWeight: 'bold'}} axisLine={false} tickLine={false} dy={10} />
                                    <YAxis tick={{fontSize: 10, fill: THEME.textMuted}} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: THEME.primary, strokeWidth: 1, strokeDasharray: '4 4' }} />
                                    <Area type="monotone" dataKey="value" stroke={THEME.primary} strokeWidth={3} fill="url(#colorGradient)" activeDot={{ r: 6, strokeWidth: 0, fill: '#fff' }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 2. TIPOS DE OPERACIÓN */}
                    <div className="bg-[#0f172a]/60 backdrop-blur-md p-8 rounded-[2rem] shadow-xl border border-slate-800 flex flex-col justify-center relative hover:border-violet-500/30 transition-all">
                        <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-tight">Distribución</h3>
                        <p className="text-[10px] text-slate-400 mb-6 font-mono uppercase tracking-widest">Ventas vs. Soportes</p>
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
                                        cornerRadius={6}
                                        stroke="none"
                                    >
                                        {distribucionTipos.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS_PIE[index % COLORS_PIE.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '10px', color: '#fff'}} itemStyle={{color: '#fff'}} />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" formatter={(value) => <span className="text-slate-400 font-bold text-xs uppercase ml-1">{value}</span>} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-20px]">
                                <span className="text-4xl font-black text-white font-mono drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">{kpis.totalDespachos}</span>
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Ops Totales</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- SECCIÓN DETALLES --- */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">

                    {/* 3. ACTIVIDAD SEMANAL */}
                    <div className="bg-[#0f172a]/60 backdrop-blur-md p-8 rounded-[2rem] shadow-xl border border-slate-800 hover:border-emerald-500/30 transition-all">
                        <h3 className="text-lg font-bold text-white mb-6 uppercase tracking-tight">📅 Actividad Semanal (Lun-Vie)</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={actividadSemanal}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={THEME.grid} />
                                    <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 'bold', fill: THEME.textMuted}} axisLine={false} tickLine={false} />
                                    <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '10px', color: '#fff'}} />
                                    <Bar dataKey="value" fill={THEME.warning} radius={[4, 4, 0, 0]} barSize={30} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 4. TOP 10 PRODUCTOS */}
                    <div className="bg-[#0f172a]/60 backdrop-blur-md p-8 rounded-[2rem] shadow-xl border border-slate-800 hover:border-cyan-500/30 transition-all">
                        <h3 className="text-lg font-bold text-white mb-6 uppercase tracking-tight">🏆 Top 10 Productos</h3>
                        <div className="space-y-4 overflow-y-auto max-h-64 pr-2 custom-scrollbar">
                            {topProductos.map((prod, i) => (
                                <div key={i} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <span className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-black font-mono ${i < 3 ? 'bg-cyan-500 text-black shadow-[0_0_10px_cyan]' : 'bg-slate-800 text-slate-500'}`}>
                                            {i + 1}
                                        </span>
                                        <span className="text-xs font-bold text-slate-300 truncate max-w-[150px] group-hover:text-cyan-400 transition-colors" title={prod.name}>{prod.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-cyan-500 rounded-full shadow-[0_0_5px_cyan]" style={{ width: `${(prod.value / topProductos[0].value) * 100}%` }}></div>
                                        </div>
                                        <span className="text-xs font-black text-white w-8 text-right font-mono">{prod.value}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* --- SECCIÓN CLIENTES --- */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    {/* 5. TOP 10 CLIENTES (VENTAS) */}
                    <div className="bg-[#0f172a]/60 backdrop-blur-md p-8 rounded-[2rem] shadow-xl border border-slate-800 hover:border-emerald-500/30 transition-all">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-tight">
                            ⭐ Top Clientes <span className="text-[9px] bg-emerald-900/30 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded uppercase font-mono">Ventas</span>
                        </h3>
                        <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart layout="vertical" data={topClientes} margin={{ left: 0, right: 30 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={THEME.grid} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={90} tick={{fontSize: 9, fill: THEME.textMuted, fontWeight:'bold'}} axisLine={false} tickLine={false} />
                                    <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '10px', color: '#fff'}} />
                                    <Bar dataKey="value" fill={THEME.success} radius={[0, 4, 4, 0]} barSize={12} name="Unidades" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 6. TOP 10 CLIENTES (SOPORTES) */}
                    <div className="bg-[#0f172a]/60 backdrop-blur-md p-8 rounded-[2rem] shadow-xl border border-slate-800 hover:border-orange-500/30 transition-all">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-tight">
                            🛠️ Solicitudes <span className="text-[9px] bg-orange-900/30 text-orange-400 border border-orange-500/30 px-2 py-1 rounded uppercase font-mono">Soportes</span>
                        </h3>
                        <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart layout="vertical" data={topClientesSoportes} margin={{ left: 0, right: 30 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={THEME.grid} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={90} tick={{fontSize: 9, fill: THEME.textMuted, fontWeight:'bold'}} axisLine={false} tickLine={false} />
                                    <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '10px', color: '#fff'}} />
                                    <Bar dataKey="value" fill={THEME.warning} radius={[0, 4, 4, 0]} barSize={12} name="Solicitudes" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

// Componente Auxiliar para Tarjetas KPI (Estilo Glass Neon)
const KpiCard = ({ title, value, unit, icon, trend, color, borderColor, shadow }: any) => (
    <div className={`bg-[#0f172a]/40 backdrop-blur-md p-6 rounded-[2rem] border ${borderColor || 'border-slate-800'} shadow-lg ${shadow} transition-transform hover:-translate-y-1 hover:bg-[#0f172a]/60 group`}>
        <div className="flex justify-between items-start mb-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-black/40 border border-slate-700 group-hover:scale-110 transition-transform`}>
                {icon}
            </div>
            {trend && (
                <span className="bg-slate-800 text-slate-400 text-[9px] font-black px-2 py-1 rounded uppercase tracking-wide border border-slate-700 font-mono">
                    {trend}
                </span>
            )}
        </div>
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-1 font-mono">{title}</p>
        <h2 className={`font-black text-4xl font-mono ${color} drop-shadow-[0_0_5px_rgba(0,0,0,0.5)]`}>
            {value} <span className="text-xs text-slate-500 font-bold">{unit}</span>
        </h2>
    </div>
);

export default Estadisticas;