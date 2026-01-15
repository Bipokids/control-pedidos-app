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
                // Convertimos objeto a array y filtramos solo los de tipo "Soporte"
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

    if (loading) return <div className="p-10 text-center text-slate-400 font-bold animate-pulse">Cargando Retiros...</div>;

    return (
        <div className="max-w-7xl mx-auto px-4 py-10 font-sans min-h-screen bg-slate-50">
            
            {/* ENCABEZADO */}
            <header className="mb-12 flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">
                        Soportes <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">Retirados</span>
                    </h1>
                    <p className="text-slate-500 font-medium text-sm">Equipos retirados por choferes pendientes de ingreso al taller.</p>
                </div>
                <div className="hidden md:block text-right">
                    <div className="bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pendientes</p>
                        <p className="text-2xl font-black text-slate-800 text-center">{registros.length}</p>
                    </div>
                </div>
            </header>

            {/* GRILLA DE TARJETAS */}
            {registros.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                    <p className="text-4xl mb-4">✨</p>
                    <p className="text-slate-400 font-bold text-lg">No hay retiros pendientes</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {registros.map((reg) => (
                        <div key={reg.id} className="bg-white p-6 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col hover:shadow-2xl transition-all duration-300">
                            
                            {/* Header Tarjeta */}
                            <div className="flex justify-between items-start mb-4 border-b border-slate-50 pb-4">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cliente</p>
                                    <h3 className="text-lg font-black text-slate-800 uppercase leading-tight">{reg.cliente}</h3>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Chofer</p>
                                    <div className="bg-cyan-50 text-cyan-700 px-3 py-1 rounded-lg text-xs font-bold inline-block">
                                        🚚 {reg.chofer}
                                    </div>
                                </div>
                            </div>

                            {/* Detalle de Items */}
                            <div className="flex-1 mb-6">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Items Retirados</p>
                                <div className="space-y-3">
                                    {reg.items && Array.isArray(reg.items) ? (
                                        reg.items.map((item: any, idx: number) => (
                                            <div key={idx} className="flex gap-3 items-start bg-slate-50 p-3 rounded-xl">
                                                <div className="bg-white w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black text-slate-700 shadow-sm border border-slate-100">
                                                    {item.cantidad}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-bold text-slate-800">{item.item}</p>
                                                    <div className="flex gap-2 mt-1">
                                                        {item.color && <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-slate-100 text-slate-500 font-bold uppercase">{item.color}</span>}
                                                        {item.detalle && <span className="text-[10px] text-slate-400 italic truncate max-w-[120px]">{item.detalle}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-slate-400 italic">Sin detalle de items</p>
                                    )}
                                </div>
                            </div>

                            {/* Footer / Fecha y Botón */}
                            <div className="mt-auto">
                                <div className="flex justify-between items-center mb-4">
                                    <p className="text-[10px] font-bold text-slate-300 uppercase">Retirado el:</p>
                                    <p className="text-xs font-bold text-slate-500 font-mono">{reg.fecha}</p>
                                </div>
                                <button 
                                    onClick={() => marcarRegistrado(reg.id)}
                                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-emerald-500 transition-colors shadow-lg active:scale-95 flex justify-center items-center gap-2"
                                >
                                    <span>📥</span> Marcar como Registrado
                                </button>
                            </div>

                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SoportesRetirados;