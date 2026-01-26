import React, { useEffect, useState } from 'react';
import { db_realtime } from '../firebase/config';
import { ref, onValue, update, set, remove, push } from "firebase/database";
import type { Remito, Soporte } from '../types';

const ControlDeRemitos: React.FC = () => {
    // -------------------------------------------------------------------------
    // 1. ESTADOS Y CONFIGURACIÓN
    // -------------------------------------------------------------------------
    const [remitos, setRemitos] = useState<Record<string, Remito>>({});
    const [soportes, setSoportes] = useState<Record<string, Soporte>>({});
    const [despachos, setDespachos] = useState<any>({});
    const [tablaManual, setTablaManual] = useState<any>({});
    
    // Interfaz y Filtros
    const [filtro, setFiltro] = useState("");
    const [filtroRapido, setFiltroRapido] = useState<'sin_fecha' | 'produccion' | 'listos' | null>(null);
    const [tablaExpandida, setTablaExpandida] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Modals
    const [modalFirma, setModalFirma] = useState<{ open: boolean, data: any, type: 'remito' | 'soporte' }>({ open: false, data: null, type: 'remito' });
    const [modalDetalle, setModalDetalle] = useState<{ open: boolean, data: any | null }>({ open: false, data: null });
    const [modalWhatsapp, setModalWhatsapp] = useState<{ open: boolean, remito: any, nuevoRango: string } | null>(null);

    // Estados del Formulario
    const [tipoCarga, setTipoCarga] = useState<'remito' | 'soporte' | ''>('');
    const [datosRemitoRaw, setDatosRemitoRaw] = useState('');
    const [productosRaw, setProductosRaw] = useState('');
    const [aclaracionesRaw, setAclaracionesRaw] = useState('');
    const [esTransporte, setEsTransporte] = useState(false);
    const [necesitaProduccion, setNecesitaProduccion] = useState(false);

    const [soporteData, setSoporteData] = useState({
        numero: '',
        cliente: '',
        telefono: '',
        fecha: new Date().toISOString().split('T')[0],
        productos: ''
    });

    const rangos = ["Lunes Mañana", "Lunes Tarde", "Martes Mañana", "Martes Tarde", "Miércoles Mañana", "Miércoles Tarde", "Jueves Mañana", "Jueves Tarde", "Viernes Mañana", "Viernes Tarde"];
    const weekdays = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"];

    // -------------------------------------------------------------------------
    // 2. EFECTOS (CARGA DE DATOS)
    // -------------------------------------------------------------------------
    useEffect(() => {
        const unsubRemitos = onValue(ref(db_realtime, 'remitos'), (snapshot) => setRemitos(snapshot.val() || {}));
        const unsubSoportes = onValue(ref(db_realtime, 'soportes'), (snapshot) => setSoportes(snapshot.val() || {}));
        const unsubDespachos = onValue(ref(db_realtime, 'despachos'), (snapshot) => setDespachos(snapshot.val() || {}));
        const unsubManual = onValue(ref(db_realtime, 'tablaManual'), (snapshot) => setTablaManual(snapshot.val() || {}));

        return () => { 
            unsubRemitos(); unsubSoportes(); unsubDespachos(); unsubManual(); 
        };
    }, []);

    // -------------------------------------------------------------------------
    // 3. LÓGICA DE NEGOCIO Y CÁLCULOS
    // -------------------------------------------------------------------------

    // Mapa de datos de despacho (choferes y firmas)
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
                // Mapeamos por ID único y por Número visible para asegurar match
                if (d.remitoId) map[d.remitoId] = info;
                if (d.soporteId) map[d.soporteId] = info;
                if (d.numeroRemito) map[String(d.numeroRemito)] = info;
                if (d.numeroSoporte) map[String(d.numeroSoporte)] = info;
            });
        });
        return map;
    }, [despachos]);

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

    const entregadosRemitos = Object.entries(remitos)
        .filter(([_id, r]) => r.estadoPreparacion === "Entregado" || r.estadoPreparacion === "Entregado Parcial")
        .map(([id, r]) => {
            // Intentamos recuperar info de despacho por ID o por Numero
            const info = datosDespachoMap[id] || datosDespachoMap[String(r.numeroRemito)] || {} as any;
            return { 
                ...r, 
                id, 
                _type: 'remito', 
                displayNumero: r.numeroRemito,
                chofer: info.chofer || 'Sin asignar',
                itemsRechazados: info.itemsRechazados,
                clienteFirma: info.clienteFirma // <--- Aquí se inyecta la firma
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

    // -------------------------------------------------------------------------
    // 4. FUNCIONES AUXILIARES
    // -------------------------------------------------------------------------

    const enviarMensajeWhatsapp = (data: any, rango: string) => {
        const telefonoStr = data.telefono ? String(data.telefono) : "";
        const telefonoLimpio = telefonoStr.replace(/\D/g, ''); 
        
        if (telefonoLimpio) {
            const telefonoFull = telefonoLimpio.startsWith("54") ? telefonoLimpio : `549${telefonoLimpio}`;
            let rangoAmigable = rango;
            const partesRango = rango.split(" ");
            if (partesRango.length === 2) {
                const [dia, turno] = partesRango;
                if (turno === "Mañana") rangoAmigable = `${dia} por la mañana`;
                else if (turno === "Tarde") rangoAmigable = `${dia} por la tarde`;
            }
            const esRemito = !!data.numeroRemito;
            const numeroRef = esRemito ? data.numeroRemito : data.numeroSoporte;
            
            let textoAccion = "";
            if (esRemito) {
                textoAccion = `estaremos ${data.esTransporte ? "despachando" : "entregando"} tu pedido`;
            } else {
                textoAccion = `estaremos entregando tu Soporte`;
            }
            let itemsLista = "• Varios productos";
            if (esRemito && Array.isArray(data.articulos)) {
                itemsLista = data.articulos.map((a: any) => `• ${a.cantidad}x ${a.codigo}`).join('\n');
            } else if (!esRemito && Array.isArray(data.productos)) {
                itemsLista = data.productos.map((p: string) => `• ${p}`).join('\n');
            }
            const mensaje = `Hola *${data.cliente}*. 👋\n\nNos comunicamos para informarte que el día *${rangoAmigable}* ${textoAccion} número *${numeroRef}*.\n\n📋 *Detalle:*\n${itemsLista}\n\nSaludos, *BIPOKIDS*.`;
            const url = `https://web.whatsapp.com/send?phone=${telefonoFull}&text=${encodeURIComponent(mensaje)}`;
            window.open(url, '_blank');
            return true;
        } else {
            alert("Error: El teléfono no tiene un formato válido.");
            return false;
        }
    };

    // Función para descargar el comprobante con firma
    const generarImagenComprobante = async () => {
        if (!modalFirma.data) return;
        const { clienteFirma, itemsRechazados, _type } = modalFirma.data;
        if (!clienteFirma?.firma) return alert("No hay firma disponible para generar imagen.");

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = 600;
        let height = 350; 
        
        const rechazos = (_type === 'remito' && itemsRechazados) ? itemsRechazados : [];
        if (rechazos.length > 0) height += 60 + (rechazos.length * 30);

        canvas.width = width;
        canvas.height = height;

        // Fondo Blanco
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        let currentY = 40;

        // Título
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 24px sans-serif'; 
        ctx.textAlign = 'center'; 
        currentY += 40;

        // Firma (Imagen Base64)
        const img = new Image();
        img.src = `data:image/png;base64,${clienteFirma.firma}`;
        await new Promise((resolve) => { img.onload = resolve; });
        
        // Ajustar imagen
        const destW = 200; 
        const destH = 100;
        const sourceH = img.height * 0.75; 
        ctx.drawImage(img, 0, 0, img.width, sourceH, (width - destW) / 2, currentY, destW, destH);
        currentY += destH + 20;

        // Datos del Cliente
        ctx.fillStyle = '#333333';
        ctx.font = 'bold 18px sans-serif'; 
        ctx.fillText(`Recibió: ${clienteFirma.nombre}`, width / 2, currentY + 20);
        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#666666';
        ctx.fillText(`DNI: ${clienteFirma.dni}`, width / 2, currentY + 45);
        currentY += 70; 

        // Rechazos (Si existen)
        if (rechazos.length > 0) {
            ctx.font = 'bold 20px sans-serif'; 
            ctx.textAlign = 'left';
            const title = "ITEMS NO RECIBIDOS";
            const icon = "⚠️";
            const iconWidth = ctx.measureText(icon).width;
            const titleWidth = ctx.measureText(title).width;
            let startX = (width - (iconWidth + 10 + titleWidth)) / 2;

            ctx.fillText(icon, startX, currentY);
            ctx.fillStyle = '#ef4444'; 
            ctx.fillText(title, startX + iconWidth + 10, currentY);
            currentY += 35;

            ctx.fillStyle = '#b91c1c';
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'center';
            rechazos.forEach((item: any) => {
                ctx.fillText(`• ${item.codigo}: ${item.cantidadRechazada} un.`, width / 2, currentY);
                currentY += 25;
            });
        }

        canvas.toBlob(async (blob) => {
            if (blob) {
                try {
                    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                    alert("✅ Imagen de comprobante copiada al portapapeles.");
                } catch (e) { alert("❌ Error al copiar imagen."); }
            }
        });
    };

    const eliminarItem = (id: string, type: string) => {
        if(window.confirm("¿Eliminar este registro entregado permanentemente?")) {
            const path = type === 'remito' ? 'remitos' : 'soportes';
            remove(ref(db_realtime, `${path}/${id}`));
        }
    };

    // -------------------------------------------------------------------------
    // 5. MANEJADORES DE EVENTOS
    // -------------------------------------------------------------------------

    const handleRangoChange = (remitoId: string, remitoData: any, nuevoRango: string) => {
        if (nuevoRango === "") {
            update(ref(db_realtime, `remitos/${remitoId}`), { rangoDespacho: "", notificado: false });
            return;
        }
        if (remitoData.telefono) {
            setModalWhatsapp({ open: true, remito: { ...remitoData, id: remitoId }, nuevoRango });
        } else {
            update(ref(db_realtime, `remitos/${remitoId}`), { rangoDespacho: nuevoRango, notificado: false });
        }
    };

    const confirmarAsignacion = (enviar: boolean) => {
        if (!modalWhatsapp) return;
        const { remito, nuevoRango } = modalWhatsapp;
        const updates: any = { rangoDespacho: nuevoRango };
        if (enviar) {
            const exito = enviarMensajeWhatsapp(remito, nuevoRango);
            if (exito) updates.notificado = true; 
        } else {
            updates.notificado = false;
        }
        update(ref(db_realtime, `remitos/${remito.id}`), updates);
        setModalWhatsapp(null);
    };

    const notificarDesdeDetalle = () => {
        if (!modalDetalle.data) return;
        const data = modalDetalle.data;
        const rango = data.rangoDespacho || data.rangoEntrega || ""; 

        if (!rango) return alert("❌ Primero debes asignar un rango de entrega.");

        if (window.confirm(`¿Enviar notificación de WhatsApp para el día ${rango}?`)) {
            const exito = enviarMensajeWhatsapp(data, rango);
            if (exito) {
                let realId = (data as any).id;
                const esRemito = !!data.numeroRemito;
                const path = esRemito ? 'remitos' : 'soportes';
                if (!realId) {
                    const collection = esRemito ? remitos : soportes;
                    const keyProp = esRemito ? 'numeroRemito' : 'numeroSoporte';
                    const foundEntry = Object.entries(collection).find(([_, val]: any) => val[keyProp] === data[keyProp]);
                    if (foundEntry) realId = foundEntry[0];
                }
                if (realId) {
                    update(ref(db_realtime, `${path}/${realId}`), { notificado: true });
                    setModalDetalle({ ...modalDetalle, data: { ...data, notificado: true } });
                }
            }
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
                let telefono = ""; 

                const lineasDatos = datosRemitoRaw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                const matchCelular = datosRemitoRaw.match(/\b(?:11|15)\d{8}\b/);
                if (matchCelular) telefono = matchCelular[0]; 

                for (let i = 0; i < lineasDatos.length; i++) {
                    const linea = lineasDatos[i];
                    if (/Raz[oó]n Social:/i.test(linea)) {
                        cliente = linea.replace(/Raz[oó]n Social:/i, "").trim();
                        if (!cliente && lineasDatos[i+1]) cliente = lineasDatos[i+1].trim();
                    }
                    else if (!cliente && linea.length > 3 && !/^CUIT|Fecha|Tel|Domicilio|Vendedor|Condici|DNI/i.test(linea)) {
                        cliente = linea;
                    }
                    if (!telefono && /(Tel[eé]fono|Celular|M[óo]vil|Tel)[:\.]?/i.test(linea)) {
                        let posibleNumero = linea.replace(/(Tel[eé]fono|Celular|M[óo]vil|Tel)[:\.]?/i, "").trim();
                        if (!posibleNumero && lineasDatos[i+1]) {
                             if (!lineasDatos[i+1].includes("30775261") && !/^DNI/i.test(lineasDatos[i+1])) {
                                 posibleNumero = lineasDatos[i+1];
                             }
                        }
                        const soloNumeros = posibleNumero.replace(/\D/g, '');
                        if (soloNumeros.length > 8) telefono = soloNumeros;
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
                    rangoEntrega: "", 
                    notificado: false, 
                    timestamp: new Date().toISOString()
                });
            }
            alert("✅ Guardado correctamente");
            setSidebarOpen(false);
            setDatosRemitoRaw(''); setProductosRaw(''); setAclaracionesRaw(''); setEsTransporte(false); setNecesitaProduccion(false);
        } catch (e) { alert("❌ Error al guardar"); }
        setLoading(false);
    };

    // -------------------------------------------------------------------------
    // 6. RENDERIZADO (JSX)
    // -------------------------------------------------------------------------
    return (
        <div className="min-h-screen relative font-sans text-cyan-50 bg-[#050b14] selection:bg-cyan-500 selection:text-black pb-20 pt-10 px-4">
            
            <div className="fixed inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #1e293b 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

            <div className="max-w-[1400px] mx-auto relative z-10">
                {/* ENCABEZADO */}
                <header className="mb-12 flex justify-between items-end border-b border-cyan-900/50 pb-6">
                    <div>
                        <h1 className="text-5xl font-black tracking-tighter mb-2 uppercase">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                                PANEL DE CONTROL
                            </span>
                        </h1>
                        <p className="text-cyan-600 font-mono text-xs uppercase tracking-[0.3em]">Sistema de Logística Avanzada v.9.0</p>
                    </div>
                    <div className="hidden md:block text-right font-mono">
                        <p className="text-[10px] text-cyan-800 uppercase tracking-widest mb-1">Stardate</p>
                        <p className="text-lg font-bold text-cyan-300 drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]">{new Date().toLocaleDateString()}</p>
                    </div>
                </header>

                {/* CONTADORES */}
                <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-[#0f172a]/60 backdrop-blur-md p-6 rounded-3xl border border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.1)] relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-2 opacity-20 text-6xl select-none group-hover:opacity-30 transition-opacity">📦</div>
                        <h3 className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.2em] mb-4 border-l-2 border-cyan-500 pl-2">Logística Activa</h3>
                        <div className="grid grid-cols-4 gap-3">
                            <StatCard label="Pendientes" val={rPendientes} color="border-orange-500" textColor="text-orange-400" />
                            <StatCard 
                                label="Producción" val={rProduccion} color="border-yellow-400" textColor="text-yellow-400"
                                onClick={() => setFiltroRapido(filtroRapido === 'produccion' ? null : 'produccion')}
                                isActive={filtroRapido === 'produccion'}
                            />
                            <StatCard 
                                label="Listos" val={rDespacho} color="border-emerald-500" textColor="text-emerald-400"
                                onClick={() => setFiltroRapido(filtroRapido === 'listos' ? null : 'listos')}
                                isActive={filtroRapido === 'listos'}
                            />
                            <StatCard 
                                label="Sin Fecha" val={rListosSinFecha} color="border-purple-500" textColor="text-purple-400"
                                onClick={() => setFiltroRapido(filtroRapido === 'sin_fecha' ? null : 'sin_fecha')}
                                isActive={filtroRapido === 'sin_fecha'}
                            />
                        </div>
                    </div>
                    
                    <div className="bg-[#0f172a]/60 backdrop-blur-md p-6 rounded-3xl border border-violet-500/20 shadow-[0_0_20px_rgba(139,92,246,0.1)] relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-2 opacity-20 text-6xl select-none group-hover:opacity-30 transition-opacity">🛠️</div>
                        <h3 className="text-[10px] font-black text-violet-500 uppercase tracking-[0.2em] mb-4 border-l-2 border-violet-500 pl-2">Servicio Técnico</h3>
                        <div className="grid grid-cols-3 gap-3">
                            <StatCard label="Pendientes" val={sPendientes} color="border-orange-500" textColor="text-orange-400" />
                            <StatCard label="Resueltos" val={sResueltos} color="border-emerald-500" textColor="text-emerald-400" />
                            <StatCard label="Sin Fecha" val={sResueltosSinFecha} color="border-purple-500" textColor="text-purple-400" />
                        </div>
                    </div>
                </div>

                {/* BUSCADOR */}
                <section className="mb-6 flex gap-4 items-center">
                    <div className="relative flex-1 group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <span className="text-cyan-700 group-focus-within:text-cyan-400 transition-colors">🔍</span>
                        </div>
                        <input type="text" placeholder="BUSCAR OBJETIVO..." value={filtro} onChange={(e) => setFiltro(e.target.value)} className="w-full pl-12 pr-6 py-4 bg-[#0f172a] border border-cyan-900 rounded-xl shadow-inner focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] outline-none font-mono text-sm text-cyan-100 placeholder-cyan-900 transition-all uppercase tracking-wider" />
                    </div>
                    {filtroRapido && (
                        <button onClick={() => setFiltroRapido(null)} className="px-6 py-4 bg-red-900/20 text-red-400 border border-red-900/50 rounded-xl font-mono text-xs font-bold uppercase hover:bg-red-900/40 hover:text-red-300 hover:shadow-[0_0_15px_rgba(220,38,38,0.4)] transition-all flex items-center gap-2">
                            <span>✖</span> {filtroRapido === 'sin_fecha' ? 'Filtro: Sin Fecha' : filtroRapido === 'produccion' ? 'Filtro: Producción' : 'Filtro: Listos'}
                        </button>
                    )}
                </section>

                <div className="flex justify-between items-center mb-4 px-2">
                    <h3 className="text-xl font-black italic uppercase text-slate-500 flex items-center gap-3 tracking-tight">
                        <span className="w-2 h-2 bg-cyan-500 rounded-full shadow-[0_0_10px_cyan]"></span>
                        Listado de Pedidos <span className="text-cyan-600 font-mono text-sm">[{remitosFiltrados.length}]</span>
                    </h3>
                    <button onClick={() => setTablaExpandida(!tablaExpandida)} className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 hover:text-cyan-300 transition-all font-mono text-[10px] uppercase text-slate-400 tracking-wider">
                        {tablaExpandida ? 'Minimizar' : 'Maximizar'} <span className={`text-xs transition-transform duration-300 ${tablaExpandida ? 'rotate-180' : 'rotate-0'}`}>▼</span>
                    </button>
                </div>

                {/* TABLA PRINCIPAL */}
                {tablaExpandida && (
                    <section className="bg-[#0f172a]/40 backdrop-blur-sm rounded-3xl border border-cyan-900/30 overflow-hidden mb-12 shadow-2xl relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left">
                                <thead>
                                    <tr className="bg-slate-900/80 text-cyan-600 font-mono text-[10px] uppercase tracking-[0.2em] border-b border-cyan-900">
                                        <th className="p-5">ID Ref</th>
                                        <th className="p-5">Entidad / Cliente</th>
                                        <th className="p-5 text-center">Producción</th>
                                        <th className="p-5 text-center">Estado</th>
                                        <th className="p-5 text-center">Preparación</th>
                                        <th className="p-5 text-center">Prioridad</th>
                                        <th className="p-5 text-center">Asignación Temporal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-cyan-900/30 font-mono text-xs">
                                    {remitosFiltrados.map(([id, r], index) => {
                                        let bgClass = 'hover:bg-cyan-900/10 transition-colors bg-transparent';
                                        const sinRango = !r.rangoDespacho || r.rangoDespacho === "";

                                        if (r.prioridad) { bgClass = 'bg-red-900/20 text-red-200 border-l-4 border-red-500 shadow-[inset_0_0_15px_rgba(220,38,38,0.2)]'; } 
                                        else if (r.estadoPreparacion === 'Despachado') { bgClass = 'bg-cyan-900/30 text-cyan-200 border-l-4 border-cyan-500'; }
                                        else if (r.produccion) {
                                            if (r.estado === 'Listo') {
                                                if (sinRango) bgClass = 'bg-purple-900/30 text-purple-200 border-l-4 border-purple-500';
                                                else if (r.estadoPreparacion === 'Listo') bgClass = 'bg-emerald-900/30 text-emerald-200 border-l-4 border-emerald-500 shadow-[inset_0_0_15px_rgba(16,185,129,0.1)]';
                                                else bgClass = 'bg-yellow-900/20 text-yellow-200 border-l-4 border-yellow-500';
                                            } else { bgClass = 'bg-orange-900/10 text-orange-200 hover:bg-orange-900/20'; }
                                        } else {
                                            if (r.estadoPreparacion === 'Pendiente' && sinRango) bgClass = 'bg-purple-900/20 text-purple-200 border-l-4 border-purple-500';
                                            else if (r.estadoPreparacion === 'Listo') bgClass = 'bg-emerald-900/30 text-emerald-200 border-l-4 border-emerald-500 shadow-[inset_0_0_15px_rgba(16,185,129,0.1)]';
                                        }
                                        
                                        return (
                                            <tr key={id} className={`group ${bgClass}`}>
                                                <td className="p-5 cursor-pointer text-cyan-400 font-bold group-hover:text-cyan-200 group-hover:shadow-[0_0_10px_cyan] transition-all duration-300" onClick={() => setModalDetalle({ open: true, data: { ...r, id } })} title="Ver detalle">
                                                    <span className="opacity-50 mr-1">#</span>{r.numeroRemito}
                                                </td>
                                                <td className="p-5 font-sans font-bold uppercase tracking-wide text-white">
                                                    {r.cliente}
                                                    {(r as any).telefono && <span className="ml-2 text-[10px] inline-block align-middle shadow-[0_0_5px_#10b981] bg-emerald-600 text-black px-1.5 rounded font-black border border-emerald-400">📞</span>}
                                                    {(r as any).notificado && <span className="ml-2 text-[10px] inline-block align-middle shadow-[0_0_5px_#3b82f6] bg-blue-600 text-white px-1.5 rounded font-black border border-blue-400">✓ SENT</span>}
                                                </td>
                                                <td className="p-5 text-center"><input type="checkbox" checked={r.produccion} onChange={(e) => update(ref(db_realtime, `remitos/${id}`), { produccion: e.target.checked })} className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-cyan-600 focus:ring-cyan-500 focus:ring-offset-slate-900" /></td>
                                                <td className="p-5 text-center">
                                                    {r.produccion && <span className={`px-3 py-1 rounded-sm text-[10px] font-black uppercase tracking-wider border ${r.estado === 'Listo' ? 'bg-emerald-600 text-black border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-yellow-600/80 text-black border-yellow-400'}`}>{r.estado || 'PENDING'}</span>}
                                                </td>
                                                <td className="p-5 text-center">
                                                    <span className={`px-3 py-1 rounded-sm text-[10px] font-black uppercase tracking-wider border ${r.estadoPreparacion === 'Listo' ? 'bg-emerald-600 text-black border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-800 text-slate-400 border-slate-600'}`}>{r.estadoPreparacion || 'PENDING'}</span>
                                                </td>
                                                <td className="p-5 text-center">
                                                    <button onClick={() => update(ref(db_realtime, `remitos/${id}`), { prioridad: !r.prioridad })} className={`text-lg transition-all active:scale-90 hover:scale-110 ${r.prioridad ? 'grayscale-0 drop-shadow-[0_0_8px_red] animate-pulse' : 'grayscale opacity-20'}`}>🔥</button>
                                                </td>
                                                <td className="p-5 text-center">
                                                    <select value={r.rangoDespacho || ""} onChange={(e) => handleRangoChange(id, r, e.target.value)} className="bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-[10px] font-mono text-cyan-300 uppercase outline-none focus:border-cyan-500 focus:shadow-[0_0_10px_rgba(6,182,212,0.3)] w-full max-w-[140px]">
                                                        <option value="">-- SIN ASIGNAR --</option>
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

                {/* CRONOGRAMA */}
                <h3 className="text-xl font-black italic uppercase mb-6 text-slate-500 tracking-tighter flex items-center gap-2"><span className="text-cyan-600">///</span> Cronograma de Operaciones</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-20">
                    {weekdays.map((dia) => (
                        <div key={dia} className="bg-[#0f172a]/60 backdrop-blur-sm rounded-2xl border border-slate-800 overflow-hidden group hover:border-cyan-500/30 transition-colors">
                            <div className="bg-slate-900/90 p-3 text-center border-b border-slate-800">
                                <span className="text-cyan-500 font-black italic text-xs tracking-[0.3em] group-hover:text-cyan-300 transition-colors">{dia}</span>
                            </div>
                            {["Mañana", "Tarde"].map(bloque => {
                                const diaFix = dia === "MIERCOLES" ? "Miércoles" : dia.charAt(0) + dia.slice(1).toLowerCase();
                                const match = `${diaFix} ${bloque}`;
                                return (
                                    <div key={bloque} className="p-3 border-b border-slate-800/50 min-h-[140px] last:border-0 hover:bg-slate-800/30 transition-colors relative" onDoubleClick={() => { const val = prompt(`Nota para ${match}:`); if(val) set(ref(db_realtime, `tablaManual/${diaFix}_${bloque}/${Date.now()}`), { text: val }); }}>
                                        <p className="text-[9px] font-bold text-slate-600 uppercase mb-3 tracking-widest text-center">{bloque}</p>
                                        <div className="flex flex-col gap-2">
                                            {Object.entries(remitos).filter(([,r]) => r.rangoDespacho === match && r.estadoPreparacion !== "Entregado").map(([id,r]) => {
                                                let bgChip = 'bg-orange-900/60 text-orange-200 border-l-4 border-orange-500 hover:shadow-[0_0_10px_orange]';
                                                if (r.estadoPreparacion === 'Listo') bgChip = 'bg-emerald-900/60 text-emerald-100 border-l-4 border-emerald-500 hover:shadow-[0_0_10px_#10b981]';
                                                if (r.estadoPreparacion === 'Despachado') bgChip = 'bg-cyan-900/60 text-cyan-100 border-l-4 border-cyan-500 hover:shadow-[0_0_10px_cyan]';
                                                if (r.prioridad) bgChip = 'bg-red-900/60 text-red-100 border-l-4 border-red-500 shadow-[0_0_10px_rgba(220,38,38,0.4)] animate-pulse';
                                                return (
                                                    <span key={id} onClick={() => setModalDetalle({ open: true, data: { ...r, id } })} className={`px-2 py-2 rounded-r cursor-pointer transition-all ${bgChip} flex justify-between items-center group/item border-y border-r border-white/10`}>
                                                        <span className="truncate max-w-[90%] text-[10px] font-mono font-bold">{r.cliente}</span>
                                                        {(r as any).notificado && <span className="text-[10px] ml-1 text-cyan-300 drop-shadow-[0_0_2px_cyan]">✓</span>}
                                                    </span>
                                                );
                                            })}
                                            {Object.entries(soportes).filter(([,s]) => s.rangoEntrega === match && s.estado !== "Entregado").map(([id,s]) => (
                                                <span key={id} onClick={() => setModalDetalle({ open: true, data: { ...s, id } })} className="px-2 py-2 rounded-r border-l-4 bg-violet-900/60 text-violet-100 border-violet-500 cursor-pointer hover:shadow-[0_0_10px_#8b5cf6] transition-all flex items-center gap-2 border-y border-r border-white/10">
                                                    <span className="text-[10px] font-mono font-bold truncate">🛠️ {s.cliente}</span>
                                                    {(s as any).notificado && <span className="text-[10px] ml-1 text-cyan-300">✓</span>}
                                                </span>
                                            ))}
                                            {tablaManual[`${diaFix}_${bloque}`] && Object.entries(tablaManual[`${diaFix}_${bloque}`]).map(([mId,m]:any) => (
                                                <span key={mId} className="px-2 py-2 rounded-r border-l-4 text-[10px] font-mono bg-yellow-900/60 text-yellow-100 border-yellow-500 flex justify-between group/manual border-y border-r border-white/10">
                                                    {m.text}
                                                    <button onClick={(e) => {e.stopPropagation(); remove(ref(db_realtime, `tablaManual/${diaFix}_${bloque}/${mId}`));}} className="opacity-0 group-hover/manual:opacity-100 text-red-400 font-bold hover:text-red-200">X</button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>

                {/* HISTORIAL */}
                <section>
                    <h3 className="text-xl font-black italic uppercase mb-6 text-slate-500 flex items-center gap-2 tracking-tighter">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_10px_#10b981]"></span>
                        Historial de Operaciones
                    </h3>
                    <div className="bg-[#0f172a]/40 backdrop-blur-md rounded-[2.5rem] p-8 border border-slate-800 shadow-xl">
                        {todosEntregados.length === 0 ? <p className="text-slate-600 text-sm font-mono italic text-center">Sin datos en el archivo.</p> : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {todosEntregados.map((item: any) => (
                                    <div key={item.id} className="p-4 bg-slate-900/50 rounded-2xl flex justify-between items-center border border-slate-800 group hover:border-cyan-500/40 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all duration-300">
                                        <div>
                                            <div className="flex gap-2 items-center mb-1">
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded text-black ${item._type === 'remito' ? 'bg-cyan-400 shadow-[0_0_8px_cyan]' : 'bg-violet-400 shadow-[0_0_8px_violet]'}`}>{item._type === 'remito' ? 'R-LOG' : 'S-TEC'}</span>
                                                <span className="text-[10px] font-mono text-slate-500">#{item.displayNumero}</span>
                                            </div>
                                            <p className="font-bold text-slate-200 text-sm uppercase truncate max-w-[150px] tracking-wide">{item.cliente}</p>
                                            <p className="text-[9px] text-slate-500 mt-1 font-mono">Date: {item.fechaEntrega ? item.fechaEntrega.split('T')[0] : 'N/A'}</p>
                                            <p className="text-[10px] font-bold text-cyan-600 mt-1 flex items-center gap-1 font-mono"><span>Chofer:</span> {item.chofer || 'UNASSIGNED'}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => setModalFirma({open: true, data: item, type: item._type})} className="p-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-cyan-500 hover:text-black hover:shadow-[0_0_10px_cyan] transition-all" title="Ver Firma">🖋️</button>
                                            <button onClick={() => eliminarItem(item.id, item._type)} className="p-2 bg-red-900/20 text-red-500 rounded-lg hover:bg-red-600 hover:text-white hover:shadow-[0_0_10px_red] transition-all" title="Eliminar">✖</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                {/* FAB */}
                <button onClick={() => setSidebarOpen(true)} className="fixed bottom-10 right-10 w-16 h-16 bg-cyan-600 text-white rounded-full shadow-[0_0_30px_rgba(8,145,178,0.6)] flex items-center justify-center text-3xl font-bold z-50 hover:scale-110 active:scale-95 transition-all border border-cyan-400 hover:bg-cyan-400 hover:text-black hover:rotate-90 duration-300">+</button>

                {/* MODAL DETALLE (CON FIRMA) */}
                {modalDetalle.open && modalDetalle.data && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => setModalDetalle({ open: false, data: null })}>
                        <div className="bg-[#0f172a] rounded-[2rem] p-8 w-full max-w-lg shadow-[0_0_50px_rgba(6,182,212,0.2)] border border-cyan-500/30 animate-in fade-in zoom-in duration-300 relative overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-purple-600"></div>

                            {/* HEADER */}
                            <div className="flex justify-between items-start mb-6 border-b border-slate-800 pb-4">
                                <div>
                                    <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">{modalDetalle.data.cliente}</h3>
                                    <div className="flex gap-2 items-center mt-2">
                                        {modalDetalle.data.numeroRemito ? (
                                            <p className="text-cyan-400 font-mono font-bold text-sm bg-cyan-900/30 px-2 py-1 rounded border border-cyan-500/30">ID: {modalDetalle.data.numeroRemito}</p>
                                        ) : (
                                            <p className="text-violet-400 font-mono font-bold text-sm bg-violet-900/30 px-2 py-1 rounded border border-violet-500/30">ID: {modalDetalle.data.numeroSoporte}</p>
                                        )}
                                        
                                        {(modalDetalle.data.numeroRemito || modalDetalle.data.rangoEntrega) && (
                                            <span className={`px-2 py-1 rounded text-xs font-mono border ${
                                                modalDetalle.data.notificado 
                                                ? "bg-emerald-900/30 text-emerald-400 border-emerald-500/50 shadow-[0_0_5px_#10b981]" 
                                                : "bg-yellow-900/30 text-yellow-400 border-yellow-500/50"
                                            }`}>
                                                {modalDetalle.data.notificado ? "SENT: TRUE" : "SENT: FALSE"}
                                            </span>
                                        )}
                                    </div>
                                    {(modalDetalle.data as any).telefono && (
                                        <p className="text-xs font-mono text-slate-400 mt-2">Contacto: {(modalDetalle.data as any).telefono}</p>
                                    )}
                                </div>
                                <button onClick={() => setModalDetalle({ open: false, data: null })} className="text-slate-500 hover:text-white text-xl font-bold p-2 transition-colors">✕</button>
                            </div>

                            {/* BODY */}
                            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-800">
                                    <h4 className="text-[10px] font-black text-cyan-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">📦 Detalle de envío</h4>
                                    <ul className="space-y-3">
                                        {modalDetalle.data.numeroRemito && Array.isArray(modalDetalle.data.articulos) && modalDetalle.data.articulos.map((art: any, i: number) => (
                                            <li key={i} className="text-sm font-bold text-slate-300 border-b border-slate-800 pb-2 last:border-0 last:pb-0 flex items-start gap-3 font-mono">
                                                <span className="bg-cyan-900/40 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded text-xs min-w-[30px] text-center">{art.cantidad}</span>
                                                <div className="flex-1">
                                                    <p className="uppercase">{art.codigo}</p>
                                                    {art.detalle && <p className="text-[10px] text-slate-500 italic font-normal mt-0.5">{art.detalle}</p>}
                                                </div>
                                            </li>
                                        ))}
                                        {modalDetalle.data.numeroSoporte && Array.isArray(modalDetalle.data.productos) && modalDetalle.data.productos.map((prod: string, i: number) => (
                                            <li key={i} className="text-sm font-bold text-slate-300 border-b border-slate-800 pb-2 last:border-0 last:pb-0 flex items-center gap-3 font-mono"><span className="text-violet-500">›</span><p className="uppercase">{prod}</p></li>
                                        ))}
                                    </ul>
                                </div>
                                
                                {modalDetalle.data.aclaraciones && (
                                    <div className="bg-yellow-900/10 p-5 rounded-2xl border border-yellow-500/20 text-yellow-100">
                                        <h4 className="text-[10px] font-black text-yellow-500 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">📝 Aclaraciones</h4>
                                        <p className="text-xs font-mono leading-relaxed whitespace-pre-line text-yellow-200/80">{modalDetalle.data.aclaraciones}</p>
                                    </div>
                                )}
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Fecha</p>
                                        <p className="text-xs font-bold text-cyan-400 font-mono mt-1">{modalDetalle.data.fechaEmision || modalDetalle.data.fechaSoporte || '-'}</p>
                                    </div>
                                    {modalDetalle.data.numeroRemito && (
                                        <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Modo</p>
                                            <p className="text-xs font-bold text-cyan-400 font-mono mt-1 uppercase">{modalDetalle.data.esTransporte ? '🚛 Transporte' : '🏠 Local'}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ACTIONS */}
                            <div className="mt-6 flex flex-col gap-3">
                                {(modalDetalle.data as any).telefono && (modalDetalle.data.numeroRemito || modalDetalle.data.rangoEntrega) && (
                                    <button 
                                        onClick={notificarDesdeDetalle}
                                        className={`w-full p-4 rounded-xl font-mono text-sm font-bold uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 ${
                                            modalDetalle.data.notificado 
                                            ? "bg-transparent text-emerald-400 border border-emerald-500 hover:bg-emerald-900/20 shadow-[0_0_10px_#10b981]" 
                                            : "bg-emerald-600 text-black hover:bg-emerald-500 hover:shadow-[0_0_20px_#10b981]"
                                        }`}
                                    >
                                        <span>💬</span> 
                                        {modalDetalle.data.notificado ? "Reenviar notificación" : "Initialize Comm"}
                                    </button>
                                )}

                                <button onClick={() => setModalDetalle({ open: false, data: null })} className="w-full p-4 bg-slate-800 text-slate-400 rounded-xl font-mono text-sm font-bold uppercase tracking-wider hover:bg-slate-700 hover:text-white transition-colors border border-slate-700">
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL WHATSAPP */}
                {modalWhatsapp && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                        <div className="bg-[#0f172a] rounded-[2rem] p-8 w-full max-w-sm shadow-[0_0_50px_rgba(16,185,129,0.2)] border border-emerald-900 animate-in zoom-in duration-200">
                            <div className="text-center mb-6">
                                <span className="text-4xl drop-shadow-[0_0_10px_rgba(16,185,129,0.8)]">📡</span>
                                <h3 className="text-xl font-black text-white mt-4 uppercase tracking-wider">Contacto Detectado</h3>
                                <p className="text-xs font-mono text-emerald-400 mt-2">Objetivo con protocolo de comunicación.</p>
                            </div>
                            
                            <div className="space-y-3">
                                <button 
                                    onClick={() => confirmarAsignacion(true)}
                                    className="w-full p-4 bg-emerald-500 text-black rounded-xl font-bold font-mono shadow-[0_0_15px_#10b981] hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 uppercase text-sm"
                                >
                                    <span>💬</span> Asignar + Enviar
                                </button>
                                
                                <button 
                                    onClick={() => confirmarAsignacion(false)}
                                    className="w-full p-4 bg-transparent text-slate-400 border border-slate-600 rounded-xl font-bold font-mono hover:border-slate-400 hover:text-white transition-all uppercase text-sm"
                                >
                                    Solo Asignar 
                                </button>
                            </div>
                            
                            <button 
                                onClick={() => setModalWhatsapp(null)}
                                className="w-full mt-6 text-xs font-bold font-mono text-slate-600 uppercase hover:text-red-400 transition-colors"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}

                {/* SIDEBAR DE CARGA */}
                {sidebarOpen && (
                    <div className="fixed inset-0 z-[100] flex justify-end">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
                        <div className="relative w-full max-w-lg bg-[#050b14] h-full shadow-[-20px_0_50px_rgba(0,0,0,0.5)] border-l border-cyan-900/50 p-8 overflow-y-auto animate-in slide-in-from-right duration-300">
                            <div className="flex justify-between items-center mb-10 border-b border-cyan-900 pb-4">
                                <h2 className="text-2xl font-black italic uppercase text-white tracking-tighter drop-shadow-[0_0_5px_cyan]">PANEL DE CARGA</h2>
                                <button onClick={() => setSidebarOpen(false)} className="text-slate-500 hover:text-cyan-400 text-2xl font-bold transition-colors">✕</button>
                            </div>
                            <div className="space-y-8">
                                <div>
                                    <label className="text-[10px] font-mono text-cyan-600 uppercase tracking-widest block mb-2">Protocolo de Carga</label>
                                    <select value={tipoCarga} onChange={(e) => setTipoCarga(e.target.value as any)} className="w-full p-4 bg-slate-900/50 border border-slate-700 rounded-xl font-bold font-mono uppercase text-sm text-cyan-100 outline-none focus:border-cyan-500 focus:shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all">
                                        <option value="">-- SELECCIONAR --</option>
                                        <option value="remito">Logística (Remito)</option>
                                        <option value="soporte">Técnico (Soporte)</option>
                                    </select>
                                </div>
                                {tipoCarga === 'remito' && (
                                    <div className="space-y-6 animate-in fade-in duration-500">
                                        <div><label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-2">Datos del Cliente</label><textarea rows={6} className="w-full p-4 bg-slate-900/80 border border-slate-700 rounded-xl text-xs font-mono text-green-400 placeholder-slate-700 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none" placeholder="Paste data block here..." value={datosRemitoRaw} onChange={e => setDatosRemitoRaw(e.target.value)} /></div>
                                        <div><label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-2">Productos / Cantidades</label><textarea rows={4} className="w-full p-4 bg-slate-900/80 border border-slate-700 rounded-xl text-xs font-mono text-cyan-200 placeholder-slate-700 focus:border-cyan-500 outline-none" placeholder="QTY CODE..." value={productosRaw} onChange={e => setProductosRaw(e.target.value)} /></div>
                                        <div><label className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-2">Aclaraciones</label><textarea rows={3} className="w-full p-4 bg-slate-900/80 border border-slate-700 rounded-xl text-xs font-mono text-yellow-200 placeholder-slate-700 focus:border-yellow-500 outline-none" placeholder="// Comments..." value={aclaracionesRaw} onChange={e => setAclaracionesRaw(e.target.value)} /></div>
                                        <div className="grid grid-cols-1 gap-3">
                                            <label className="flex items-center gap-3 p-4 bg-slate-900/50 rounded-xl border cursor-pointer border-slate-700 hover:border-cyan-500 transition-all group"><input type="checkbox" checked={esTransporte} onChange={e => setEsTransporte(e.target.checked)} className="w-5 h-5 rounded bg-black border-slate-600 text-cyan-600 focus:ring-0" /><span className="text-[11px] font-black text-slate-400 uppercase italic group-hover:text-cyan-400 transition-colors">Es Transporte</span></label>
                                            <label className="flex items-center gap-3 p-4 bg-slate-900/50 rounded-xl border cursor-pointer border-slate-700 hover:border-green-500 transition-all group"><input type="checkbox" checked={necesitaProduccion} onChange={e => setNecesitaProduccion(e.target.checked)} className="w-5 h-5 rounded bg-black border-slate-600 text-green-600 focus:ring-0" /><span className="text-[11px] font-black text-slate-400 uppercase italic text-green-600/70 group-hover:text-green-400 transition-colors">Requiere Producción</span></label>
                                        </div>
                                    </div>
                                )}
                                {tipoCarga === 'soporte' && (
                                    <div className="space-y-4 animate-in fade-in duration-500">
                                        <input type="text" placeholder="ID REF" className="w-full p-4 bg-slate-900/80 rounded-xl font-bold font-mono uppercase text-sm border border-slate-700 text-white focus:border-violet-500 outline-none" value={soporteData.numero} onChange={e => setSoporteData({...soporteData, numero: e.target.value})} />
                                        <input type="text" placeholder="NOMBRE CLIENTE" className="w-full p-4 bg-slate-900/80 rounded-xl font-bold font-mono uppercase text-sm border border-slate-700 text-white focus:border-violet-500 outline-none" value={soporteData.cliente} onChange={e => setSoporteData({...soporteData, cliente: e.target.value})} />
                                        <input type="text" placeholder="CONTACTO (OPCIONAL)" className="w-full p-4 bg-slate-900/80 rounded-xl font-bold font-mono uppercase text-sm border border-slate-700 text-white focus:border-violet-500 outline-none" value={soporteData.telefono} onChange={e => setSoporteData({...soporteData, telefono: e.target.value})} />
                                        <input type="date" className="w-full p-4 bg-slate-900/80 rounded-xl font-bold text-sm border border-slate-700 uppercase text-slate-400 focus:text-white outline-none" value={soporteData.fecha} onChange={e => setSoporteData({...soporteData, fecha: e.target.value})} />
                                        <textarea rows={5} placeholder="COMPONENTES..." className="w-full p-4 bg-slate-900/80 rounded-xl border border-slate-700 font-bold font-mono uppercase text-sm text-violet-300 outline-none focus:border-violet-500" value={soporteData.productos} onChange={e => setSoporteData({...soporteData, productos: e.target.value})} />
                                    </div>
                                )}
                                {tipoCarga && (
                                    <button disabled={loading} onClick={guardarDatos} className="w-full mt-6 p-5 bg-cyan-600 text-black rounded-xl font-black font-mono uppercase tracking-widest shadow-[0_0_20px_rgba(8,145,178,0.4)] hover:bg-cyan-400 hover:scale-[1.02] transition-all disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none">
                                        {loading ? 'UPLOADING...' : 'EJECUTAR CARGA'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ---------------------------------------------------------- */}
            {/* BLOQUE MODAL FIRMA (PEGAR AL FINAL DEL RETURN)             */}
            {/* ---------------------------------------------------------- */}
            {modalFirma.open && modalFirma.data && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => setModalFirma({ open: false, data: null, type: 'remito' })}>
                    <div className="bg-[#0f172a] rounded-[2rem] p-8 w-full max-w-lg shadow-[0_0_50px_rgba(6,182,212,0.2)] border border-cyan-500/30 animate-in zoom-in duration-300 relative overflow-hidden" onClick={e => e.stopPropagation()}>
                        
                        {/* Decorative Top Line */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600"></div>

                        <div className="text-center mb-8">
                            <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">
                                Firma Digital
                            </h3>
                            <p className="text-xs font-mono text-cyan-400 uppercase tracking-[0.2em] mt-1">Comprobante de Recepción</p>
                        </div>
                        
                        {modalFirma.data.clienteFirma ? (
                            <div className="space-y-6">
                                {/* Contenedor de la firma (Fondo blanco para contraste) */}
                                <div className="border-2 border-dashed border-slate-700 rounded-2xl p-4 bg-white flex justify-center shadow-inner relative group">
                                    <img 
                                        src={`data:image/png;base64,${modalFirma.data.clienteFirma.firma}`} 
                                        alt="Firma Cliente" 
                                        className="max-h-32 object-contain" 
                                    />
                                    <div className="absolute top-2 right-2 text-[8px] font-black text-slate-300 uppercase tracking-widest">Digital Sign</div>
                                </div>

                                <div className="text-center space-y-1 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                                    <p className="font-bold text-white text-lg uppercase font-mono tracking-wide">{modalFirma.data.clienteFirma.nombre}</p>
                                    <p className="text-xs font-bold text-slate-500 font-mono uppercase">DNI / ID: <span className="text-cyan-400">{modalFirma.data.clienteFirma.dni}</span></p>
                                </div>

                                <button 
                                    onClick={generarImagenComprobante} 
                                    className="w-full py-4 bg-cyan-600 text-black rounded-xl font-black font-mono uppercase tracking-widest hover:bg-cyan-400 transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] active:scale-95 flex items-center justify-center gap-2 group/btn"
                                >
                                    <span className="text-lg group-hover/btn:scale-110 transition-transform">📸</span> 
                                    Copiar firma
                                </button>
                            </div>
                        ) : (
                            <div className="p-10 text-center text-slate-500 font-mono font-bold border-2 border-dashed border-slate-800 rounded-xl bg-black/20">
                                <p className="mb-2 text-2xl">⚠️</p>
                                <p>DATA ERROR: Firma no disponible.</p>
                            </div>
                        )}

                        <button onClick={() => setModalFirma({ open: false, data: null, type: 'remito' })} className="absolute top-4 right-4 text-slate-500 hover:text-white font-bold text-xl transition-colors">✕</button>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
};

// Componente StatCard (Refactorizado para modo oscuro/neon)
function StatCard({ label, val, color, textColor, onClick, isActive }: { label: string, val: number, color: string, textColor: string, onClick?: () => void, isActive?: boolean }) {
    return (
        <div 
            onClick={onClick}
            className={`bg-slate-900/50 p-3 rounded-xl border-l-2 ${color} transition-all duration-300 ${onClick ? 'cursor-pointer hover:bg-slate-800 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]' : ''} ${isActive ? 'ring-1 ring-cyan-500 bg-cyan-900/20' : ''}`}
        >
            <h2 className="text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none truncate font-mono">{label}</h2>
            <p className={`text-2xl font-black mt-1 italic leading-none font-mono ${textColor} drop-shadow-[0_0_5px_currentColor]`}>{val}</p>
        </div>
    );
}

export default ControlDeRemitos;