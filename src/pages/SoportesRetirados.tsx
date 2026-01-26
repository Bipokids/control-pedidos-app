import React, { useEffect, useState } from 'react';
import { db_realtime } from '../firebase/config';
import { ref, onValue, remove } from "firebase/database";

const SoportesRetirados: React.FC = () => {
    const [registros, setRegistros] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onValue(ref(db_realtime, 'soportesypagos'), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const lista = Object.entries(data)
                    .map(([id, val]: any) => ({ ...val, id }))
                    .filter((item: any) => item.tipo === "Soporte");
                
                setRegistros(lista);
            } else {
                setRegistros([]);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const marcarRegistrado = async (id: string) => {
        if (window.confirm("¿Confirmas que has recibido y procesado estos equipos? Se eliminarán de la lista de retiros.")) {
            try {
                await remove(ref(db_realtime, `soportesypagos/${id}`));
            } catch (error) {
                alert("Error al eliminar el registro.");
            }
        }
    };

    if (loading) return <div className="min-h-screen bg-[#050b14] flex items-center justify-center"><div className="text-cyan-500 font-mono animate-pulse uppercase tracking-widest">LOADING INCOMING ASSETS...</div></div>;

    return (
        <div className="min-h-screen relative font-sans text-cyan-50 bg-[#050b14] selection:bg-cyan-500 selection:text-black pb-20 pt-10 px-4">
            
            {/* GRID DE FONDO DECORATIVO */}
            <div className="fixed inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #1e293b 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

            <div className="max-w-7xl mx-auto relative z-10">
                
                {/* ENCABEZADO */}
                <header className="mb-12 flex justify-between items-end border-b border-cyan-900/50 pb-6">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tighter mb-2 uppercase drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                            SOPORTES <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">RETIRADOS</span>
                        </h1>
                        <p className="text-cyan-600 font-mono text-xs uppercase tracking-[0.3em]">Registro de Retiros Pendientes de Ingreso</p>
                    </div>
                    <div className="hidden md:block text-right">
                        <div className="bg-[#0f172a]/80 px-6 py-3 rounded-xl border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                            <p className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest font-mono">PENDIENTES</p>
                            <p className="text-2xl font-black text-white text-center font-mono">{registros.length}</p>
                        </div>
                    </div>
                </header>

                {/* GRILLA DE TARJETAS */}
                {registros.length === 0 ? (
                    <div className="text-center py-20 bg-[#0f172a]/50 rounded-[2.5rem] border border-dashed border-cyan-900/50">
                        <p className="text-4xl mb-4 grayscale opacity-50">✨</p>
                        <p className="text-cyan-700 font-mono font-bold text-sm tracking-widest uppercase">:: NO INCOMING TRANSFERS ::</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {registros.map((reg) => (
                            <div key={reg.id} className="bg-[#0f172a]/60 backdrop-blur-md p-6 rounded-[2rem] shadow-xl border border-slate-800 flex flex-col hover:border-cyan-500/40 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)] transition-all duration-300 relative group overflow-hidden">
                                
                                {/* Decorative line */}
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-600"></div>

                                {/* Header Tarjeta */}
                                <div className="flex justify-between items-start mb-6 border-b border-cyan-900/30 pb-4">
                                    <div>
                                        <p className="text-[9px] font-black text-cyan-600 uppercase tracking-widest mb-1 font-mono">CLIENTE</p>
                                        <h3 className="text-lg font-black text-white uppercase leading-tight tracking-wide">{reg.cliente}</h3>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-cyan-600 uppercase tracking-widest mb-1 font-mono">CHOFER</p>
                                        <div className="bg-cyan-900/40 text-cyan-300 px-3 py-1 rounded border border-cyan-500/30 text-xs font-bold inline-block font-mono shadow-[0_0_10px_rgba(34,211,238,0.2)]">
                                            🚚 {reg.chofer}
                                        </div>
                                    </div>
                                </div>

                                {/* Detalle de Items */}
                                <div className="flex-1 mb-6">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 font-mono flex items-center gap-2">
                                        <span className="w-1 h-1 bg-cyan-500 rounded-full"></span> ITEMS RETIRADOS
                                    </p>
                                    <div className="space-y-3">
                                        {reg.items && Array.isArray(reg.items) ? (
                                            reg.items.map((item: any, idx: number) => (
                                                <div key={idx} className="flex gap-3 items-start bg-[#050b14]/50 p-3 rounded-xl border border-slate-800 group-hover:border-slate-700 transition-colors">
                                                    <div className="bg-cyan-900/20 w-8 h-8 rounded flex items-center justify-center text-sm font-black text-cyan-400 border border-cyan-500/20 shrink-0 font-mono">
                                                        {item.cantidad}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-slate-200 uppercase tracking-wide">{item.item}</p>
                                                        
                                                        {/* Color y Detalle */}
                                                        <div className="flex flex-col gap-2 mt-2">
                                                            {item.color && (
                                                                <span className="text-[9px] bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-slate-400 font-bold uppercase w-fit font-mono tracking-wider">
                                                                    {item.color}
                                                                </span>
                                                            )}
                                                            
                                                            {item.detalle && (
                                                                <p className="text-[10px] text-cyan-400/80 italic leading-snug break-words bg-cyan-900/10 p-2 rounded border border-cyan-500/10 font-mono">
                                                                   {'>'} {item.detalle}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-sm text-slate-600 italic font-mono">:: NO MANIFEST DATA ::</p>
                                        )}
                                    </div>
                                </div>

                                {/* Footer / Fecha y Botón */}
                                <div className="mt-auto pt-4 border-t border-slate-800">
                                    <div className="flex justify-between items-center mb-4 font-mono">
                                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">RETIRADO EL:</p>
                                        <p className="text-xs font-bold text-cyan-400">{reg.fecha}</p>
                                    </div>
                                    <button 
                                        onClick={() => marcarRegistrado(reg.id)}
                                        className="w-full py-4 bg-cyan-600 text-black rounded-xl font-black uppercase text-[10px] tracking-[0.2em] font-mono hover:bg-cyan-400 transition-all shadow-[0_0_20px_rgba(8,145,178,0.4)] hover:shadow-[0_0_30px_rgba(34,211,238,0.6)] active:scale-95 flex justify-center items-center gap-2 group/btn"
                                    >
                                        <span className="group-hover/btn:animate-bounce">📥</span> MARCAR COMO REGISTRADO
                                    </button>
                                </div>

                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SoportesRetirados;