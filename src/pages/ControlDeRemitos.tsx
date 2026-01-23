import React, { useEffect, useState } from 'react';
import { db_realtime } from '../firebase/config';
import { ref, onValue, update, set, remove, push } from "firebase/database";
import type { Remito, Soporte } from '../types';

const ControlDeRemitos: React.FC = () => {
    // ESTADOS DE DATOS
    const [remitos, setRemitos] = useState<Record<string, Remito>>({});
    const [soportes, setSoportes] = useState<Record<string, Soporte>>({});
    const [despachos, setDespachos] = useState<any>({});
    const [tablaManual, setTablaManual] = useState<any>({});
    
    // ESTADOS DE INTERFAZ
    const [filtro, setFiltro] = useState("");
    const [filtroRapido, setFiltroRapido] = useState<'sin_fecha' | 'produccion' | 'listos' | null>(null);

    const [sidebarOpen, setSidebarOpen] = useState(false);
    
    // Modals existentes
    const [modalFirma, setModalFirma] = useState<{ open: boolean, data: any, type: 'remito' | 'soporte' }>({ open: false, data: null, type: 'remito' });
    const [modalDetalle, setModalDetalle] = useState<{ open: boolean, data: any | null }>({ open: false, data: null });
    
    // --- NUEVO: Modal para WhatsApp (Asignación Automática) ---
    const [modalWhatsapp, setModalWhatsapp] = useState<{ open: boolean, remito: any, nuevoRango: string } | null>(null);

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
        telefono: '', // Campo de teléfono para soportes
        fecha: new Date().toISOString().split('T')[0],
        productos: ''
    });

    const rangos = ["Lunes Mañana", "Lunes Tarde", "Martes Mañana", "Martes Tarde", "Miércoles Mañana", "Miércoles Tarde", "Jueves Mañana", "Jueves Tarde", "Viernes Mañana", "Viernes Tarde"];
    const weekdays = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"];

    // 1. CARGA DE DATOS
    useEffect(() => {
        const unsubRemitos = onValue(ref(db_realtime, 'remitos'), (snapshot) => setRemitos(snapshot.val() || {}));
        const unsubSoportes = onValue(ref(db_realtime, 'soportes'), (snapshot) => setSoportes(snapshot.val() || {}));
        const unsubDespachos = onValue(ref(db_realtime, 'despachos'), (snapshot) => setDespachos(snapshot.val() || {}));
        const unsubManual = onValue(ref(db_realtime, 'tablaManual'), (snapshot) => setTablaManual(snapshot.val() || {}));

        return () => { unsubRemitos(); unsubSoportes(); unsubDespachos(); unsubManual(); };
    }, []);

    // 2. LÓGICA DE DATOS DESPACHO
    const datosDespachoMap = React.useMemo(() => {
        const map: Record<string, { chofer: string, itemsRechazados?: any[], clienteFirma?: any }> = {};
        if (!despachos) return map;

        Object.values(despachos).forEach((itemsDia: any) => {
            if (!itemsDia) return;
            Object.values(itemsDia).forEach((d: any) => {
                const info = { 
                    chofer: d.chofer, 
                    itemsRechazados: d.itemsRechazados || [],
                    clienteFirma: d.clienteFirma 
                };
                if (d.remitoId) map[d.remitoId] = info;
                if (d.soporteId) map[d.soporteId] = info;
                if (d.numeroRemito) map[String(d.numeroRemito)] = info;
                if (d.numeroSoporte) map[String(d.numeroSoporte)] = info;
            });
        });
        return map;
    }, [despachos]);

    // 3. CÁLCULO DE CONTADORES
    const rPendientes = Object.values(remitos).filter(r => r.estadoPreparacion !== "Entregado").length;
    const rProduccion = Object.values(remitos).filter(r => r.produccion && r.estado === "Listo" && r.estadoPreparacion !== "Entregado").length;
    const rDespacho = Object.values(remitos).filter(r => r.estadoPreparacion === "Listo").length;
    
    const rListosSinFecha = Object.values(remitos).filter(r => {
        if (r.estadoPreparacion === "Entregado") return false;
        if (r.rangoDespacho && r.rangoDespacho !== "") return false;
        if (r.produccion) return r.estado === "Listo";
        else return r.estadoPreparacion === "Pendiente";
    }).length;

    const sPendientes = Object.values(soportes).filter(s => s.estado === "Pendiente").length;
    const sResueltos = Object.values(soportes).filter(s => s.estado === "Resuelto").length;
    const sResueltosSinFecha = Object.values(soportes).filter(s => s.estado === "Resuelto" && (!s.rangoEntrega || s.rangoEntrega === "")).length;

    // 4. FILTRADO TABLA PRINCIPAL
    const remitosFiltrados = Object.entries(remitos).filter(([_id, r]) => {
        if (r.estadoPreparacion === "Entregado") return false;

        const matchTexto = r.cliente?.toLowerCase().includes(filtro.toLowerCase()) || r.numeroRemito?.toString().includes(filtro);
        
        if (filtroRapido === 'sin_fecha') {
            const sinRango = !r.rangoDespacho || r.rangoDespacho === "";
            if (!sinRango) return false;
            if (r.produccion) return r.estado === "Listo" && matchTexto;
            else return r.estadoPreparacion === "Pendiente" && matchTexto;
        }

        if (filtroRapido === 'produccion') return r.produccion && r.estado === "Listo" && matchTexto;
        if (filtroRapido === 'listos') return r.estadoPreparacion === "Listo" && matchTexto;

        return matchTexto;
    });

    // 5. ENTREGADOS
    const entregadosRemitos = Object.entries(remitos)
        .filter(([_id, r]) => r.estadoPreparacion === "Entregado" || r.estadoPreparacion === "Entregado Parcial")
        .map(([id, r]) => {
            const info = datosDespachoMap[id] || datosDespachoMap[String(r.numeroRemito)] || {} as any;
            return { 
                ...r, 
                id, 
                _type: 'remito', 
                displayNumero: r.numeroRemito,
                chofer: info.chofer || 'Sin asignar',
                itemsRechazados: info.itemsRechazados,
                clienteFirma: info.clienteFirma 
            };
        });
    
    const entregadosSoportes = Object.entries(soportes)
        .filter(([_id, s]) => s.estado === "Entregado" || s.estado === "Entregado Parcial")
        .map(([id, s]) => {
            const info = datosDespachoMap[id] || datosDespachoMap[String(s.numeroSoporte)] || {} as any;
            return { 
                ...s, 
                id, 
                _type: 'soporte', 
                displayNumero: s.numeroSoporte, 
                clienteFirma: info.clienteFirma || (s as any).clienteFirma, 
                chofer: info.chofer || 'Sin asignar',
                itemsRechazados: info.itemsRechazados
            };
        });

    const todosEntregados = [...entregadosRemitos, ...entregadosSoportes];

    // --- HELPER: GENERAR Y ENVIAR WHATSAPP ---
    const enviarMensajeWhatsapp = (data: any, rango: string) => {
        const telefonoStr = data.telefono ? String(data.telefono) : "";
        const telefonoLimpio = telefonoStr.replace(/\D/g, ''); 
        
        if (telefonoLimpio) {
            // Agregar 549 para Argentina (Asumiendo números locales)
            const telefonoFull = telefonoLimpio.startsWith("54") ? telefonoLimpio : `549${telefonoLimpio}`;

            // --- Lógica de Fecha Amigable ---
            let rangoAmigable = rango;
            const partesRango = rango.split(" ");
            if (partesRango.length === 2) {
                const [dia, turno] = partesRango;
                if (turno === "Mañana") rangoAmigable = `${dia} por la mañana`;
                else if (turno === "Tarde") rangoAmigable = `${dia} por la tarde`;
            }

            // --- Lógica de Verbo Dinámico ---
            const verboAccion = data.esTransporte ? "despachando" : "entregando";

            // --- Lógica de Lista Vertical de Items ---
            const itemsLista = Array.isArray(data.articulos) 
                ? data.articulos.map((a: any) => `• ${a.cantidad}x ${a.codigo}`).join('\n')
                : "• Varios productos";

            // --- Construcción del Mensaje ---
            const mensaje = `Hola *${data.cliente}*. 👋
            
Nos comunicamos de *BIPOKIDS* para informarte que el día *${rangoAmigable}* estaremos ${verboAccion} tu pedido número *${data.numeroRemito}*.

📋 *Detalle del pedido:*
${itemsLista}

Saludos, *BIPOKIDS*.`;
            
            const url = `https://web.whatsapp.com/send?phone=${telefonoFull}&text=${encodeURIComponent(mensaje)}`;
            window.open(url, '_blank');
            return true; // Éxito
        } else {
            alert("Error: El teléfono no tiene un formato válido.");
            return false; // Fallo
        }
    };

    // --- ACCIONES ---

    const generarImagenComprobante = async () => { /* ... Lógica existente ... */ 
        if (!modalFirma.data) return;
        const { clienteFirma, itemsRechazados, _type } = modalFirma.data;
        if (!clienteFirma?.firma) return alert("No hay firma disponible");

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const width = 600;
        let height = 220; 
        const rechazos = (_type === 'remito' && itemsRechazados) ? itemsRechazados : [];
        if (rechazos.length > 0) height += 60 + (rechazos.length * 30);
        canvas.width = width; canvas.height = height;

        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);

        let currentY = 20;
        const img = new Image();
        img.src = `data:image/png;base64,${clienteFirma.firma}`;
        await new Promise((resolve) => { img.onload = resolve; });
        
        const destW = 200; const destH = 100; const sourceH = img.height * 0.75; 
        ctx.drawImage(img, 0, 0, img.width, sourceH, (width - destW) / 2, currentY, destW, destH);
        currentY += destH + 10;

        ctx.fillStyle = '#000000'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; 
        ctx.fillText(`${clienteFirma.nombre}`, width / 2, currentY + 20);
        ctx.font = '16px sans-serif'; ctx.fillText(`DNI: ${clienteFirma.dni}`, width / 2, currentY + 45);
        currentY += 70; 

        if (rechazos.length > 0) {
            ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'left';
            const title = "ITEMS NO RECIBIDOS / RECHAZADOS"; const icon = "⚠️";
            const iconWidth = ctx.measureText(icon).width; const titleWidth = ctx.measureText(title).width;
            const totalW = iconWidth + 10 + titleWidth; let startX = (width - totalW) / 2;

            ctx.fillText(icon, startX, currentY); ctx.fillStyle = '#ef4444'; 
            ctx.fillText(title, startX + iconWidth + 10, currentY); currentY += 35;

            ctx.fillStyle = '#b91c1c'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
            rechazos.forEach((item: any) => { ctx.fillText(`• ${item.codigo}: ${item.cantidadRechazada} un.`, width / 2, currentY); currentY += 25; });
        }

        canvas.toBlob(async (blob) => {
            if (blob) { try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); alert("✅ Imagen copiada."); } catch (e) { alert("❌ Error al copiar."); } }
        });
    };

    const eliminarItem = (id: string, type: string) => {
        if(window.confirm("¿Eliminar este registro entregado permanentemente?")) {
            const path = type === 'remito' ? 'remitos' : 'soportes';
            remove(ref(db_realtime, `${path}/${id}`));
        }
    };

    // --- NUEVO: Manejo de Cambio de Rango (Intercepción) ---
    const handleRangoChange = (remitoId: string, remitoData: any, nuevoRango: string) => {
        if (nuevoRango === "") {
            // Si borra el rango, reseteamos y marcamos como no notificado
            update(ref(db_realtime, `remitos/${remitoId}`), { rangoDespacho: "", notificado: false });
            return;
        }

        // Si tiene teléfono, ofrecemos enviar WhatsApp
        if (remitoData.telefono) {
            setModalWhatsapp({ open: true, remito: { ...remitoData, id: remitoId }, nuevoRango });
        } else {
            // Si no tiene teléfono, solo actualizamos y marcamos como no notificado
            update(ref(db_realtime, `remitos/${remitoId}`), { rangoDespacho: nuevoRango, notificado: false });
        }
    };

    // --- NUEVO: Confirmar Asignación (Desde Modal WhatsApp) ---
    const confirmarAsignacion = (enviar: boolean) => {
        if (!modalWhatsapp) return;
        const { remito, nuevoRango } = modalWhatsapp;

        const updates: any = { rangoDespacho: nuevoRango };

        if (enviar) {
            const exito = enviarMensajeWhatsapp(remito, nuevoRango);
            if (exito) updates.notificado = true; // Marcamos como notificado si se abrió el WhatsApp
        } else {
            updates.notificado = false; // El usuario eligió "Solo Asignar", por lo tanto NO está notificado
        }

        update(ref(db_realtime, `remitos/${remito.id}`), updates);
        setModalWhatsapp(null);
    };

    // --- NUEVO: Notificar Manualmente (Desde Modal Detalle) ---
    const notificarDesdeDetalle = () => {
        if (!modalDetalle.data) return;
        const data = modalDetalle.data;
        const rango = data.rangoDespacho || "";

        if (!rango) return alert("❌ Primero debes asignar un rango de entrega.");

        if (window.confirm(`¿Enviar notificación de WhatsApp para el día ${rango}?`)) {
            const exito = enviarMensajeWhatsapp(data, rango);
            if (exito) {
                // Actualizamos la base de datos
                let realId = (data as any).id;
                // Fallback por si el ID no vino directo
                if (!realId) {
                    const foundEntry = Object.entries(remitos).find(([_, val]) => val.numeroRemito === data.numeroRemito);
                    if (foundEntry) realId = foundEntry[0];
                }

                if (realId) {
                    update(ref(db_realtime, `remitos/${realId}`), { notificado: true });
                    // Actualizamos vista local para feedback inmediato
                    setModalDetalle({ ...modalDetalle, data: { ...data, notificado: true } });
                }
            }
        }
    };

    // --- PARSER INTELIGENTE (Francotirador de Teléfonos) ---
    const guardarDatos = async () => {
        if (!tipoCarga) return;
        setLoading(true);
        try {
            if (tipoCarga === 'remito') {
                const numeroRemito = (datosRemitoRaw.match(/\b\d{4}-\d{8}\b/) || [""])[0];
                const fechaEmision = (datosRemitoRaw.match(/\b\d{2}\/\d{2}\/\d{2,4}\b/) || [""])[0];
                let cliente = "";
                let telefono = ""; 

                const lineasDatos = datosRemitoRaw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                
                // --- ESTRATEGIA 1: FRANCOTIRADOR (PRIORIDAD MÁXIMA) ---
                // Buscamos cualquier número de 10 dígitos que empiece con 11 o 15 en todo el texto
                const matchCelular = datosRemitoRaw.match(/\b(?:11|15)\d{8}\b/);
                if (matchCelular) {
                    telefono = matchCelular[0]; 
                }

                // --- BUCLE DE PARSEO (FALLBACK) ---
                for (let i = 0; i < lineasDatos.length; i++) {
                    const linea = lineasDatos[i];

                    // Buscar Cliente
                    if (/Raz[oó]n Social:/i.test(linea)) {
                        cliente = linea.replace(/Raz[oó]n Social:/i, "").trim();
                        if (!cliente && lineasDatos[i+1]) cliente = lineasDatos[i+1].trim();
                    }
                    else if (!cliente && linea.length > 3 && !/^CUIT|Fecha|Tel|Domicilio|Vendedor|Condici|DNI/i.test(linea)) {
                        cliente = linea;
                    }

                    // ESTRATEGIA 2: Si el francotirador falló, buscamos etiquetas
                    if (!telefono && /(Tel[eé]fono|Celular|M[óo]vil|Tel)[:\.]?/i.test(linea)) {
                        let posibleNumero = linea.replace(/(Tel[eé]fono|Celular|M[óo]vil|Tel)[:\.]?/i, "").trim();
                        
                        if (!posibleNumero && lineasDatos[i+1]) {
                             // Evitamos DNI
                             if (!lineasDatos[i+1].includes("30775261") && !/^DNI/i.test(lineasDatos[i+1])) {
                                 posibleNumero = lineasDatos[i+1];
                             }
                        }

                        const soloNumeros = posibleNumero.replace(/\D/g, '');
                        if (soloNumeros.length > 8) { 
                            telefono = soloNumeros;
                        }
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
                    numeroRemito, fechaEmision, cliente, 
                    telefono, 
                    articulos, aclaraciones: aclaracionesRaw,
                    produccion: necesitaProduccion, esTransporte, estado: null, estadoPreparacion: "Pendiente",
                    rangoDespacho: "", notificado: false, timestamp: new Date().toISOString()
                });
            } else {
                await push(ref(db_realtime, 'soportes'), {
                    numeroSoporte: soporteData.numero, 
                    cliente: soporteData.cliente,
                    telefono: soporteData.telefono,
                    fechaSoporte: soporteData.fecha, 
                    productos: soporteData.productos.split('\n').filter(Boolean),
                    estado: "Pendiente", 
                    timestamp: new Date().toISOString()
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
            <header className="mb-12 flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">
                        Panel de <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Control</span>
                    </h1>
                    <p className="text-slate-500 font-medium text-sm">Logística y monitoreo centralizado.</p>
                </div>
                <div className="hidden md:block text-right">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Fecha Actual</p>
                    <p className="text-sm font-bold text-slate-700">{new Date().toLocaleDateString()}</p>
                </div>
            </header>

            {/* CONTADORES */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Logística (Remitos)</h3>
                    <div className="grid grid-cols-4 gap-2">
                        <StatCard label="Pendientes" val={rPendientes} color="border-orange-300" />
                        <StatCard 
                            label="Producción" val={rProduccion} color="border-yellow-400" 
                            onClick={() => setFiltroRapido(filtroRapido === 'produccion' ? null : 'produccion')}
                            isActive={filtroRapido === 'produccion'}
                        />
                        <StatCard 
                            label="Listos" val={rDespacho} color="border-green-500" 
                            onClick={() => setFiltroRapido(filtroRapido === 'listos' ? null : 'listos')}
                            isActive={filtroRapido === 'listos'}
                        />
                        <StatCard 
                            label="Sin Fecha" val={rListosSinFecha} color="border-purple-500" 
                            onClick={() => setFiltroRapido(filtroRapido === 'sin_fecha' ? null : 'sin_fecha')}
                            isActive={filtroRapido === 'sin_fecha'}
                        />
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
            <section className="mb-4 flex gap-4 items-center">
                <div className="relative flex-1">
                    <input type="text" placeholder="🔍 BUSCAR POR CLIENTE, N° REMITO O ZONA..." value={filtro} onChange={(e) => setFiltro(e.target.value)} className="w-full p-5 bg-white border-2 border-slate-100 rounded-[2rem] shadow-sm focus:border-blue-500 outline-none font-bold text-sm uppercase italic" />
                </div>
                {filtroRapido && (
                    <button onClick={() => setFiltroRapido(null)} className="px-4 py-2 bg-red-50 text-red-600 rounded-xl font-bold text-xs uppercase hover:bg-red-100 transition-colors flex items-center gap-2 border border-red-100">
                        <span>✖</span> {filtroRapido === 'sin_fecha' ? 'Viendo Sin Fecha' : filtroRapido === 'produccion' ? 'Viendo Producción' : 'Viendo Listos'}
                    </button>
                )}
            </section>

            {/* BOTÓN COLAPSAR */}
            <div className="flex justify-between items-center mb-4 px-2">
                <h3 className="text-xl font-black italic uppercase text-slate-400 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    Listado de Pedidos ({remitosFiltrados.length})
                </h3>
                <button onClick={() => setTablaExpandida(!tablaExpandida)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 transition-all font-bold text-xs uppercase text-slate-600">
                    {tablaExpandida ? 'Contraer' : 'Desplegar'}
                    <span className={`text-lg transition-transform duration-300 ${tablaExpandida ? 'rotate-180' : 'rotate-0'}`}>▼</span>
                </button>
            </div>

            {/* TABLA PRINCIPAL */}
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
                                    let bgClass = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                                    const sinRango = !r.rangoDespacho || r.rangoDespacho === "";

                                    if (r.estadoPreparacion === 'Despachado') bgClass = 'bg-cyan-100 text-cyan-900';
                                    else {
                                        if (r.produccion) {
                                            if (r.estado === 'Listo') {
                                                if (sinRango) bgClass = 'bg-purple-100 text-purple-900';
                                                else if (r.estadoPreparacion === 'Listo') bgClass = 'bg-green-100 text-green-900';
                                                else bgClass = 'bg-yellow-100 text-yellow-900';
                                            }
                                        } else {
                                            if (r.estadoPreparacion === 'Pendiente' && sinRango) bgClass = 'bg-purple-100 text-purple-900';
                                            else if (r.estadoPreparacion === 'Listo') bgClass = 'bg-green-100 text-green-900';
                                        }
                                    }
                                    const borderClass = r.prioridad ? 'border-l-4 border-red-500' : '';

                                    return (
                                        <tr key={id} className={`hover:bg-slate-200 transition-colors text-[11px] font-bold ${bgClass} ${borderClass}`}>
                                            <td className="p-5 font-mono cursor-pointer hover:text-blue-600 hover:underline" onClick={() => setModalDetalle({ open: true, data: { ...r, id } })} title="Ver detalle">#{r.numeroRemito}</td>
                                            <td className="p-5 uppercase">
                                                {r.cliente}
                                                {/* Indicador visual de que tiene teléfono */}
                                                {(r as any).telefono && <span className="ml-1 text-[8px] bg-green-100 text-green-600 px-1 rounded border border-green-200">📞</span>}
                                                {/* Indicador visual de NOTIFICADO */}
                                                {(r as any).notificado && <span className="ml-1 text-[8px] bg-blue-100 text-blue-600 px-1 rounded border border-blue-200" title="Cliente Notificado">✅</span>}
                                            </td>
                                            <td className="p-5 text-center"><input type="checkbox" checked={r.produccion} onChange={(e) => update(ref(db_realtime, `remitos/${id}`), { produccion: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-blue-600" /></td>
                                            <td className="p-5 text-center">{r.produccion && <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase shadow-sm ${r.estado === 'Listo' ? 'bg-green-500 text-white' : 'bg-yellow-200 text-yellow-800'}`}>{r.estado || 'PENDIENTE'}</span>}</td>
                                            <td className="p-5 text-center"><span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase shadow-sm bg-white/50 border border-slate-200`}>{r.estadoPreparacion || 'PENDIENTE'}</span></td>
                                            <td className="p-5 text-center"><button onClick={() => update(ref(db_realtime, `remitos/${id}`), { prioridad: !r.prioridad })} className={`text-lg transition-transform active:scale-90 ${r.prioridad ? 'grayscale-0' : 'grayscale opacity-20'}`}>🔥</button></td>
                                            <td className="p-5 text-center">
                                                <select value={r.rangoDespacho || ""} onChange={(e) => handleRangoChange(id, r, e.target.value)} className="bg-white/50 border border-slate-300 rounded-xl p-2 text-[10px] font-black uppercase outline-none focus:bg-white">
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
                                <div key={bloque} className="p-5 border-b border-gray-50 min-h-[130px] last:border-0 hover:bg-gray-50 transition-colors" onDoubleClick={() => { const val = prompt(`Nota para ${match}:`); if(val) set(ref(db_realtime, `tablaManual/${diaFix}_${bloque}/${Date.now()}`), { text: val }); }}>
                                    <p className="text-[10px] font-black text-blue-500 uppercase mb-3 tracking-widest text-center">{bloque}</p>
                                    <div className="flex flex-col gap-2">
                                        {Object.entries(remitos).filter(([,r]) => r.rangoDespacho === match && r.estadoPreparacion !== "Entregado").map(([id,r]) => {
                                            let bgChip = 'bg-orange-100 text-orange-700 border-orange-400';
                                            if (r.estadoPreparacion === 'Listo') bgChip = 'bg-green-100 text-green-700 border-green-500';
                                            if (r.estadoPreparacion === 'Despachado') bgChip = 'bg-cyan-100 text-cyan-700 border-cyan-500';
                                            if (r.prioridad) bgChip = 'bg-red-50 text-red-700 border-red-500';
                                            return (
                                                <span key={id} onClick={() => setModalDetalle({ open: true, data: { ...r, id } })} className={`px-3 py-2 rounded-xl text-[9px] font-black border-l-4 shadow-sm cursor-pointer hover:scale-105 transition-transform ${bgChip} flex justify-between items-center`}>
                                                    <span className="truncate max-w-[90%]">{r.cliente}</span>
                                                    {(r as any).notificado && <span className="text-[8px] ml-1">✅</span>}
                                                </span>
                                            );
                                        })}
                                        {Object.entries(soportes).filter(([,s]) => s.rangoEntrega === match && s.estado !== "Entregado").map(([id,s]) => (
                                            <span key={id} onClick={() => setModalDetalle({ open: true, data: { ...s, id } })} className="px-3 py-2 rounded-xl text-[9px] font-black border-l-4 bg-orange-50 text-orange-700 border-orange-500 shadow-sm flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform"><span>🛠️</span> {s.cliente}</span>
                                        ))}
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
                                        <p className="text-[10px] font-bold text-indigo-500 mt-1 flex items-center gap-1"><span>🚚</span> {item.chofer || 'Sin chofer asignado'}</p>
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

            {/* MODALS */}
            {modalDetalle.open && modalDetalle.data && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setModalDetalle({ open: false, data: null })}>
                    <div className="bg-white rounded-[2rem] p-8 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">{modalDetalle.data.cliente}</h3>
                                <div className="flex gap-2 items-center mt-1">
                                    {modalDetalle.data.numeroRemito ? (
                                        <p className="text-blue-600 font-mono font-bold text-sm bg-blue-50 inline-block px-2 py-1 rounded-lg">Remito #{modalDetalle.data.numeroRemito}</p>
                                    ) : (
                                        <p className="text-orange-600 font-mono font-bold text-sm bg-orange-50 inline-block px-2 py-1 rounded-lg">Soporte #{modalDetalle.data.numeroSoporte}</p>
                                    )}

                                    {/* STATUS NOTIFICADO EN DETALLE */}
                                    {modalDetalle.data.numeroRemito && (
                                        <span className={`px-2 py-1 rounded-lg text-xs font-bold border ${
                                            modalDetalle.data.notificado 
                                            ? "bg-green-100 text-green-700 border-green-200" 
                                            : "bg-yellow-50 text-yellow-600 border-yellow-200"
                                        }`}>
                                            {modalDetalle.data.notificado ? "✅ Notificado" : "⚠️ No Notificado"}
                                        </span>
                                    )}
                                </div>

                                {/* Mostrar teléfono en detalle si existe */}
                                {(modalDetalle.data as any).telefono && (
                                    <p className="text-xs font-bold text-slate-500 mt-1">📞 {(modalDetalle.data as any).telefono}</p>
                                )}
                            </div>
                            <button onClick={() => setModalDetalle({ open: false, data: null })} className="text-slate-300 hover:text-slate-800 text-xl font-bold p-2">✕</button>
                        </div>
                        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><span>📦</span> Detalle de Productos</h4>
                                <ul className="space-y-3">
                                    {modalDetalle.data.numeroRemito && Array.isArray(modalDetalle.data.articulos) && modalDetalle.data.articulos.map((art: any, i: number) => (
                                        <li key={i} className="text-sm font-bold text-slate-700 border-b border-slate-200 pb-2 last:border-0 last:pb-0 flex items-start gap-3">
                                            <span className="bg-white text-blue-600 border border-blue-100 px-2 py-0.5 rounded text-xs font-black min-w-[30px] text-center shadow-sm">{art.cantidad}</span>
                                            <div className="flex-1">
                                                <p>{art.codigo}</p>
                                                {art.detalle && <p className="text-[11px] text-slate-400 italic font-normal mt-0.5">{art.detalle}</p>}
                                            </div>
                                        </li>
                                    ))}
                                    {modalDetalle.data.numeroSoporte && Array.isArray(modalDetalle.data.productos) && modalDetalle.data.productos.map((prod: string, i: number) => (
                                        <li key={i} className="text-sm font-bold text-slate-700 border-b border-slate-200 pb-2 last:border-0 last:pb-0 flex items-center gap-3"><span className="text-orange-500">•</span><p>{prod}</p></li>
                                    ))}
                                </ul>
                            </div>
                            {modalDetalle.data.aclaraciones && (
                                <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 text-amber-800">
                                    <h4 className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2 flex items-center gap-2"><span>📝</span> Observaciones</h4>
                                    <p className="text-xs font-bold italic leading-relaxed whitespace-pre-line">{modalDetalle.data.aclaraciones}</p>
                                </div>
                            )}
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

                        {/* ACCIONES DEL MODAL DETALLE */}
                        <div className="mt-6 flex flex-col gap-3">
                            
                            {/* BOTÓN NOTIFICAR (Solo si tiene teléfono y es remito) */}
                            {modalDetalle.data.numeroRemito && (modalDetalle.data as any).telefono && (
                                <button 
                                    onClick={notificarDesdeDetalle}
                                    className={`w-full p-4 rounded-2xl font-black uppercase italic tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 ${
                                        modalDetalle.data.notificado
                                        ? "bg-white text-green-600 border-2 border-green-500 hover:bg-green-50"
                                        : "bg-green-500 text-white hover:bg-green-600"
                                    }`}
                                >
                                    <span>💬</span> 
                                    {modalDetalle.data.notificado ? "Re-enviar WhatsApp" : "Notificar por WhatsApp"}
                                </button>
                            )}

                            <button onClick={() => setModalDetalle({ open: false, data: null })} className="w-full p-4 bg-slate-900 text-white rounded-2xl font-black uppercase italic tracking-widest hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200">
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL WHATSAPP (NUEVO) */}
            {modalWhatsapp && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
                    <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl animate-in zoom-in duration-200">
                        <div className="text-center mb-6">
                            <span className="text-4xl">📱</span>
                            <h3 className="text-xl font-black text-slate-800 mt-2">Notificar al Cliente</h3>
                            <p className="text-sm text-slate-500 mt-1">Este remito tiene un teléfono asociado.</p>
                        </div>
                        
                        <div className="space-y-3">
                            <button 
                                onClick={() => confirmarAsignacion(true)}
                                className="w-full p-4 bg-green-500 text-white rounded-xl font-bold shadow-lg hover:bg-green-600 transition-all flex items-center justify-center gap-2"
                            >
                                <span>💬</span> Asignar y Enviar WhatsApp
                            </button>
                            
                            <button 
                                onClick={() => confirmarAsignacion(false)}
                                className="w-full p-4 bg-white text-slate-600 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all"
                            >
                                Solo Asignar (Sin notificar)
                            </button>
                        </div>
                        
                        <button 
                            onClick={() => setModalWhatsapp(null)}
                            className="w-full mt-6 text-xs font-bold text-slate-400 uppercase hover:text-slate-600"
                        >
                            Cancelar
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
                                {/* Datos Recibió */}
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Recibió</p>
                                    <p className="font-black text-slate-800 uppercase text-lg">{modalFirma.data.clienteFirma.nombre}</p>
                                    <p className="text-xs text-slate-500 font-bold">DNI: {modalFirma.data.clienteFirma.dni}</p>
                                </div>
                                
                                {/* Firma */}
                                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 flex justify-center bg-white">
                                    <img src={`data:image/png;base64,${modalFirma.data.clienteFirma.firma}`} className="max-h-40 object-contain" alt="Firma" />
                                </div>

                                {/* LISTA DE RECHAZOS */}
                                {modalFirma.data.itemsRechazados && modalFirma.data.itemsRechazados.length > 0 && (
                                    <div className="bg-red-50 p-4 rounded-2xl border border-red-100 text-center">
                                        <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-2 flex items-center justify-center gap-1">⚠️ Items No Recibidos</p>
                                        <ul className="space-y-2">
                                            {modalFirma.data.itemsRechazados.map((item: any, idx: number) => (
                                                <li key={idx} className="text-xs font-bold text-red-700 flex justify-between border-b border-red-100 pb-1 last:border-0 last:pb-0">
                                                    <span>{item.codigo}</span>
                                                    <span>{item.cantidadRechazada} un.</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* BOTÓN COPIAR IMAGEN */}
                                <button 
                                    onClick={generarImagenComprobante}
                                    className="w-full py-3 bg-indigo-50 text-indigo-600 rounded-xl font-black uppercase text-xs hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2 border border-indigo-100"
                                >
                                    📋 Copiar como Imagen
                                </button>
                            </div>
                        ) : (
                            <div className="p-10 text-center bg-slate-50 rounded-2xl text-slate-400 font-bold italic border border-slate-100"><p className="text-3xl mb-2">🤷‍♂️</p>Sin firma digital registrada.</div>
                        )}
                        <button onClick={() => setModalFirma({...modalFirma, open: false})} className="w-full mt-4 p-4 bg-slate-900 text-white rounded-2xl font-black uppercase italic tracking-widest hover:bg-slate-800 transition-colors">Cerrar</button>
                    </div>
                </div>
            )}

            {/* SIDEBAR DE CARGA */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-[100] flex justify-end">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
                    <div className="relative w-full max-w-lg bg-white h-full shadow-2xl p-8 overflow-y-auto animate-in slide-in-from-right duration-300">
                        {/* ... SIDEBAR CONTENT ... */}
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
                                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-2">Datos Remito y Cliente</label><textarea rows={6} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono" placeholder="Pega bloque completo aquí..." value={datosRemitoRaw} onChange={e => setDatosRemitoRaw(e.target.value)} /></div>
                                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-2">Productos y Cantidades</label><textarea rows={4} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono" placeholder="Cantidad Código..." value={productosRaw} onChange={e => setProductosRaw(e.target.value)} /></div>
                                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-2">Detalles / Aclaraciones</label><textarea rows={3} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono" placeholder="Ej: MPE 1200 ROJOS..." value={aclaracionesRaw} onChange={e => setAclaracionesRaw(e.target.value)} /></div>
                                    <div className="grid grid-cols-1 gap-3">
                                        <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border cursor-pointer border-slate-100 hover:border-blue-500 transition-all"><input type="checkbox" checked={esTransporte} onChange={e => setEsTransporte(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-blue-600" /><span className="text-[11px] font-black text-slate-600 uppercase italic">Es Transporte</span></label>
                                        <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border cursor-pointer border-slate-100 hover:border-green-500 transition-all"><input type="checkbox" checked={necesitaProduccion} onChange={e => setNecesitaProduccion(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-green-600" /><span className="text-[11px] font-black text-slate-600 uppercase italic text-green-600">Requiere Producción</span></label>
                                    </div>
                                </div>
                            )}
                            {tipoCarga === 'soporte' && (
                                <div className="space-y-4 animate-in fade-in duration-500">
                                    <input type="text" placeholder="N° SOPORTE" className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase text-sm border-slate-100" value={soporteData.numero} onChange={e => setSoporteData({...soporteData, numero: e.target.value})} />
                                    <input type="text" placeholder="CLIENTE" className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase text-sm border-slate-100" value={soporteData.cliente} onChange={e => setSoporteData({...soporteData, cliente: e.target.value})} />
                                    
                                    {/* --- NUEVO CAMPO DE TELÉFONO --- */}
                                    <input type="text" placeholder="TELÉFONO (OPCIONAL)" className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase text-sm border-slate-100" value={soporteData.telefono} onChange={e => setSoporteData({...soporteData, telefono: e.target.value})} />

                                    <input type="date" className="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm border-slate-100 uppercase" value={soporteData.fecha} onChange={e => setSoporteData({...soporteData, fecha: e.target.value})} />
                                    <textarea rows={5} placeholder="LISTA DE PRODUCTOS..." className="w-full p-4 bg-slate-50 rounded-2xl border-slate-100 font-bold uppercase text-sm" value={soporteData.productos} onChange={e => setSoporteData({...soporteData, productos: e.target.value})} />
                                </div>
                            )}
                            {tipoCarga && (
                                <button disabled={loading} onClick={guardarDatos} className="w-full mt-4 p-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase italic tracking-widest shadow-xl hover:bg-blue-600 transition-all disabled:bg-slate-300">{loading ? 'Sincronizando...' : 'Confirmar Carga'}</button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Componente StatCard
function StatCard({ label, val, color, onClick, isActive }: { label: string, val: number, color: string, onClick?: () => void, isActive?: boolean }) {
    return (
        <div 
            onClick={onClick}
            className={`bg-slate-50 p-3 rounded-xl border-l-4 ${color} transition-all hover:scale-105 ${onClick ? 'cursor-pointer hover:bg-slate-100' : ''} ${isActive ? 'ring-2 ring-indigo-500 bg-indigo-50' : ''}`}
        >
            <h2 className="text-[9px] font-bold text-slate-400 uppercase tracking-wide leading-none truncate">{label}</h2>
            <p className="text-2xl font-black text-slate-800 mt-1 italic leading-none">{val}</p>
        </div>
    );
}

export default ControlDeRemitos;