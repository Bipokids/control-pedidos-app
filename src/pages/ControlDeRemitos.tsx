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
    const [remitosPendientes, setRemitosPendientes] = useState<any[]>([]);

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

    // Función para descargar el comprobante con firma (Optimizado: Sin duplicados, sin márgenes extra)
    const generarImagenComprobante = async () => {
        if (!modalFirma.data) return;
        const { clienteFirma, itemsRechazados, _type } = modalFirma.data;
        if (!clienteFirma?.firma) return alert("No hay firma disponible para generar imagen.");

        // 1. Cargar imagen
        const img = new Image();
        img.src = `data:image/png;base64,${clienteFirma.firma}`;
        await new Promise((resolve) => { img.onload = resolve; });

        // --- LÓGICA DE RECORTE (CROP) ---
        // Asumimos que la firma está en la parte superior y el texto pequeño (duplicado) abajo.
        // Usaremos solo el 60% superior de la imagen original para eliminar ese texto.
        const sourceCropHeight = img.height * 0.60; 

        // --- DIMENSIONES DEL CANVAS (Reducido un 40%) ---
        const width = 360; // Antes 600/500 -> Ahora 360 (Compacto)
        
        // Calcular altura de la firma manteniendo proporción
        // Usamos sourceCropHeight para el cálculo de aspecto
        const maxSigH = 100; 
        const scale = Math.min((width - 20) / img.width, maxSigH / sourceCropHeight);
        const finalSigW = img.width * scale;
        const finalSigH = sourceCropHeight * scale;

        // Calcular altura dinámica total con márgenes ajustados (Tight layout)
        // PadTop(10) + Firma(finalSigH) + Gap(5) + Nombre(20) + DNI(18) + PadBot(15)
        let dynamicHeight = 10 + finalSigH + 5 + 20 + 18 + 15;
        
        const rechazos = (_type === 'remito' && itemsRechazados) ? itemsRechazados : [];
        if (rechazos.length > 0) {
            dynamicHeight += 30; // Espacio título
            dynamicHeight += (rechazos.length * 20); // Items más compactos
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = dynamicHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // --- DIBUJAR ---

        // Fondo Blanco
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, dynamicHeight);

        let currentY = 10; // Margen superior mínimo

        // 1. DIBUJAR FIRMA (RECORTADA)
        // sHeight = sourceCropHeight (esto recorta el texto viejo)
        ctx.drawImage(
            img, 
            0, 0, img.width, sourceCropHeight, // Source Rectangle (Solo parte superior)
            (width - finalSigW) / 2, currentY, finalSigW, finalSigH // Destination Rectangle
        );
        currentY += finalSigH + 5; // Gap mínimo

        // 2. DATOS DEL CLIENTE (Nuevos, claros)
        ctx.textAlign = 'center';
        
        ctx.fillStyle = '#0f172a'; // Slate-900 (Más oscuro y nítido)
        ctx.font = 'bold 18px sans-serif'; 
        ctx.fillText(`${clienteFirma.nombre}`, width / 2, currentY + 15);
        currentY += 20;
        
        ctx.fillStyle = '#64748b'; // Slate-500
        ctx.font = '600 14px sans-serif'; 
        ctx.fillText(`DNI: ${clienteFirma.dni}`, width / 2, currentY + 15);
        currentY += 25;

        // 3. RECHAZOS (Si existen)
        if (rechazos.length > 0) {
            // Línea separadora
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(20, currentY);
            ctx.lineTo(width - 20, currentY);
            ctx.stroke();
            currentY += 20;

            ctx.textAlign = 'left';
            const startX = 30;
            
            ctx.fillStyle = '#ef4444'; 
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText("ITEMS NO RECIBIDOS:", startX, currentY);
            currentY += 15;

            ctx.fillStyle = '#334155';
            ctx.font = '11px monospace';
            rechazos.forEach((item: any) => {
                ctx.fillText(`• ${item.cantidadRechazada}x ${item.codigo}`, startX + 5, currentY);
                currentY += 15;
            });
        }

        // Generar Blob
        canvas.toBlob(async (blob) => {
            if (blob) {
                try {
                    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                    alert("✅ Imagen compacta copiada.");
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
                        <p className="text-cyan-600 font-mono text-xs uppercase tracking-[0.3em]">Sistema de Logística BIPOKIDS v.9.0</p>
                    </div>
                    <div className="hidden md:block text-right font-mono">
                        <p className="text-[10px] text-cyan-800 uppercase tracking-widest mb-1">Fecha</p>
                        <p className="text-lg font-bold text-cyan-300 drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]">{new Date().toLocaleDateString()}</p>
                    </div>
                </header>

                {/* CONTADORES (HUD WIDGETS) */}
                <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* Panel Logística */}
                    <div className="bg-[#0f172a]/60 backdrop-blur-md p-6 rounded-3xl border border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.1)] relative overflow-hidden group">
                        {/* ICONO CAJA: Solo Iluminación y Escala (Sin rotación) */}
                        <div className="absolute top-0 right-0 p-4 opacity-20 text-6xl select-none transition-all duration-500 ease-out group-hover:opacity-70 group-hover:scale-110 group-hover:drop-shadow-[0_0_35px_rgba(34,211,238,0.9)]">
                            📦
                        </div>
                        
                        <h3 className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.2em] mb-4 border-l-2 border-cyan-500 pl-2 relative z-10">Logística Activa</h3>
                        <div className="grid grid-cols-4 gap-3 relative z-10">
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
                    
                    {/* Panel Soporte */}
                    <div className="bg-[#0f172a]/60 backdrop-blur-md p-6 rounded-3xl border border-violet-500/20 shadow-[0_0_20px_rgba(139,92,246,0.1)] relative overflow-hidden group">
                        {/* ICONO HERRAMIENTAS: Solo Iluminación y Escala (Sin rotación) */}
                        <div className="absolute top-0 right-0 p-4 opacity-20 text-6xl select-none transition-all duration-500 ease-out group-hover:opacity-70 group-hover:scale-110 group-hover:drop-shadow-[0_0_35px_rgba(139,92,246,0.9)]">
                            🛠️
                        </div>

                        <h3 className="text-[10px] font-black text-violet-500 uppercase tracking-[0.2em] mb-4 border-l-2 border-violet-500 pl-2 relative z-10">Servicio Técnico</h3>
                        <div className="grid grid-cols-3 gap-3 relative z-10">
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
                                        <th className="p-5">Remito</th>
                                        <th className="p-5">Cliente</th>
                                        <th className="p-5 text-center">Producción</th>
                                        <th className="p-5 text-center">Estado</th>
                                        <th className="p-5 text-center">Preparación</th>
                                        <th className="p-5 text-center">Prioridad</th>
                                        <th className="p-5 text-center">Asignación Entrega</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-cyan-900/30 font-mono text-xs">
                                    {remitosFiltrados.map(([id, r], index) => {
                                        // --- LÓGICA DE COLOR FILAS (HIGH CONTRAST) ---
                                        let bgClass = 'hover:bg-cyan-900/10 transition-colors bg-transparent';
                                        const sinRango = !r.rangoDespacho || r.rangoDespacho === "";

                                        // Prioridad: Rojo intenso
                                        if (r.prioridad) {
                                            bgClass = 'bg-red-900/20 text-red-200 border-l-4 border-red-500 shadow-[inset_0_0_15px_rgba(220,38,38,0.2)]';
                                        } 
                                        else if (r.estadoPreparacion === 'Despachado') {
                                            bgClass = 'bg-cyan-900/30 text-cyan-200 border-l-4 border-cyan-500';
                                        }
                                        else if (r.produccion) {
                                            if (r.estado === 'Listo') {
                                                if (sinRango) bgClass = 'bg-purple-900/30 text-purple-200 border-l-4 border-purple-500';
                                                else if (r.estadoPreparacion === 'Listo') bgClass = 'bg-emerald-900/30 text-emerald-200 border-l-4 border-emerald-500 shadow-[inset_0_0_15px_rgba(16,185,129,0.1)]';
                                                else bgClass = 'bg-yellow-900/20 text-yellow-200 border-l-4 border-yellow-500';
                                            } else {
                                                // En Producción (Pendiente)
                                                bgClass = 'bg-orange-900/10 text-orange-200 hover:bg-orange-900/20';
                                            }
                                        } else {
                                            // Sin Producción
                                            if (r.estadoPreparacion === 'Pendiente' && sinRango) bgClass = 'bg-purple-900/20 text-purple-200 border-l-4 border-purple-500';
                                            else if (r.estadoPreparacion === 'Listo') bgClass = 'bg-emerald-900/30 text-emerald-200 border-l-4 border-emerald-500 shadow-[inset_0_0_15px_rgba(16,185,129,0.1)]';
                                        }

                                        // --- LÓGICA DE COLOR BADGE PREPARACIÓN ---
                                        let prepBadgeClass = '';
                                        if (r.estadoPreparacion === 'Listo') {
                                            prepBadgeClass = 'bg-emerald-600 text-black border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]';
                                        } else if (r.estadoPreparacion === 'Despachado') {
                                            prepBadgeClass = 'bg-cyan-600 text-black border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]';
                                        } else {
                                            // Pendiente (Naranja)
                                            prepBadgeClass = 'bg-orange-600/80 text-white border-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.5)]';
                                        }
                                        
                                        return (
                                            <tr key={id} className={`group ${bgClass}`}>
                                                <td className="p-5 cursor-pointer text-cyan-400 font-bold group-hover:text-cyan-200 group-hover:shadow-[0_0_10px_cyan] transition-all duration-300" onClick={() => setModalDetalle({ open: true, data: { ...r, id } })} title="Ver detalle">
                                                    <span className="opacity-50 mr-1">#</span>{r.numeroRemito}
                                                </td>
                                                <td className="p-5 font-sans font-bold uppercase tracking-wide text-white">
                                                    {r.cliente}
                                                    {/* Indicadores neon intensos */}
                                                    {(r as any).telefono && <span className="ml-2 text-[10px] inline-block align-middle shadow-[0_0_5px_#10b981] bg-emerald-600 text-black px-1.5 rounded font-black border border-emerald-400">📞</span>}
                                                    {(r as any).notificado && <span className="ml-2 text-[10px] inline-block align-middle shadow-[0_0_5px_#3b82f6] bg-blue-600 text-white px-1.5 rounded font-black border border-blue-400">✓ SENT</span>}
                                                </td>
                                                <td className="p-5 text-center"><input type="checkbox" checked={r.produccion} onChange={(e) => update(ref(db_realtime, `remitos/${id}`), { produccion: e.target.checked })} className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-cyan-600 focus:ring-cyan-500 focus:ring-offset-slate-900" /></td>
                                                <td className="p-5 text-center">
                                                    {r.produccion && <span className={`px-3 py-1 rounded-sm text-[10px] font-black uppercase tracking-wider border ${r.estado === 'Listo' ? 'bg-emerald-600 text-black border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-yellow-600/80 text-black border-yellow-400'}`}>{r.estado || 'PENDIENTE'}</span>}
                                                </td>
                                                
                                                {/* COLUMNA PREPARACIÓN CON NUEVOS COLORES */}
                                                <td className="p-5 text-center">
                                                    {(!sinRango || r.estadoPreparacion === 'Listo' || r.estadoPreparacion === 'Despachado') ? (
                                                        <span className={`px-3 py-1 rounded-sm text-[10px] font-black uppercase tracking-wider border ${prepBadgeClass}`}>
                                                            {r.estadoPreparacion || 'PENDIENTE'}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-700 font-mono font-bold">-</span>
                                                    )}
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
                <h3 className="text-xl font-black italic uppercase mb-6 text-slate-500 tracking-tighter flex items-center gap-2"><span className="text-cyan-600">///</span> Cronograma de Entregas</h3>
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

                {/* FAB - QUANTUM DATA UPLINK */}
                <button 
                    onClick={() => setSidebarOpen(true)} 
                    className="fixed bottom-10 right-10 z-50 group outline-none"
                    title="Iniciar Carga de Datos"
                >
                    {/* 1. Campo de energía externo (Resplandor pulsante) */}
                    <div className="absolute inset-0 rounded-[1.5rem] bg-cyan-500/20 blur-md group-hover:blur-xl group-hover:bg-cyan-400/40 transition-all duration-500 scale-110 group-hover:scale-125 opacity-50 group-hover:opacity-100 animate-pulse-slow"></div>
                    
                    {/* 2. Estructura del Reactor (Squircle técnico) */}
                    <div className="relative w-16 h-16 bg-[#050b14] rounded-2xl border-[1.5px] border-cyan-500/60 flex items-center justify-center shadow-[inset_0_0_15px_rgba(6,182,212,0.2)] overflow-hidden group-hover:border-cyan-300 group-hover:shadow-[inset_0_0_30px_rgba(6,182,212,0.6),0_0_25px_rgba(6,182,212,0.5)] transition-all duration-300 active:scale-95">
                        
                        {/* Escáner de luz de fondo */}
                        <div className="absolute inset-0 w-full h-full bg-gradient-to-t from-transparent via-cyan-400/10 to-transparent translate-y-full group-hover:-translate-y-full transition-transform duration-1000 ease-in-out"></div>
                        
                        {/* ÍCONO SVG: TRANSMISIÓN DE DATOS ANIMADA */}
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-cyan-500 relative z-10 transition-all duration-500 group-hover:text-cyan-200 group-hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">
                            {/* Anillo de energía exterior giratorio */}
                            <circle cx="12" cy="12" r="10" strokeDasharray="12 8" className="opacity-40 animate-[spin_6s_linear_infinite] group-hover:opacity-80" />
                            
                            {/* Base de datos */}
                            <path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" className="opacity-60" />
                            
                            {/* Núcleo de carga central (Se eleva al hacer hover) */}
                            <g className="group-hover:-translate-y-1.5 transition-transform duration-500 ease-out">
                                <path d="M12 15V3" strokeWidth="1.5" className="group-hover:stroke-white"/>
                                <path d="m8 7 4-4 4 4" strokeWidth="1.5" className="group-hover:stroke-white"/>
                                {/* Partículas de datos ascendentes */}
                                <circle cx="9" cy="12" r="0.5" className="fill-cyan-400 animate-pulse" />
                                <circle cx="15" cy="10" r="0.5" className="fill-cyan-400 animate-pulse delay-150" />
                            </g>
                        </svg>
                    </div>
                </button>

                {/* MODAL DETALLE (SOLO LECTURA + ELIMINAR REMITO) */}
{modalDetalle.open && modalDetalle.data && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => setModalDetalle({ open: false, data: null })}>
        <div className="bg-[#0f172a] rounded-[2rem] p-6 w-full max-w-lg shadow-[0_0_50px_rgba(6,182,212,0.2)] border border-cyan-500/30 animate-in fade-in zoom-in duration-300 relative overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-purple-600"></div>

            {/* HEADER */}
            <div className="flex justify-between items-start mb-4 border-b border-slate-800 pb-4 shrink-0">
                <div className="flex-1 mr-4">
                    <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter drop-shadow-[0_0_5px_rgba(255,255,255,0.5)] truncate">{modalDetalle.data.cliente}</h3>
                    <div className="flex gap-2 items-center mt-2 flex-wrap">
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
                                {modalDetalle.data.notificado ? "NOTIFICADO" : "SIN NOTIFICAR"}
                            </span>
                        )}
                    </div>
                    
                    {/* SECCIÓN DE CONTACTO (SOLO LECTURA) */}
                    {/* SECCIÓN DE CONTACTO EDITABLE */}
<div className="flex items-center gap-2 mt-2 group/edit">
    <p className="text-xs font-mono text-slate-400">
        Contacto: <span className="text-white font-bold tracking-wide">{(modalDetalle.data).telefono || "Sin registrar"}</span>
    </p>
    <button 
        onClick={() => {
            const nuevoTel = prompt("Ingresa el nuevo número de contacto (solo números):", (modalDetalle.data).telefono || "");
            if (nuevoTel !== null) {
                const telLimpio = nuevoTel.replace(/\D/g, '');
                const path = modalDetalle.data.numeroRemito ? 'remitos' : 'soportes';
                const id = (modalDetalle.data).id;
                
                update(ref(db_realtime, `${path}/${id}`), { telefono: telLimpio });
                setModalDetalle(prev => ({...prev, data: { ...prev.data, telefono: telLimpio }}));
            }
        }}
        className="text-slate-600 hover:text-cyan-400 transition-colors p-1 rounded-md hover:bg-slate-800"
        title="Editar teléfono"
    >
        ✏️
    </button>
</div>
                </div>
                <button onClick={() => setModalDetalle({ open: false, data: null })} className="text-slate-500 hover:text-white text-xl font-bold p-2 transition-colors">✕</button>
            </div>

            {/* BODY (Scrollable) */}
            <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar flex-1 min-h-0">
                <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-800">
                    <h4 className="text-[10px] font-black text-cyan-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">📦 Detalle de envío</h4>
                    <ul className="space-y-3">
                        {/* LISTA DE ARTICULOS (SIN BOTONES DE EDICIÓN) */}
                        {modalDetalle.data.numeroRemito && Array.isArray(modalDetalle.data.articulos) && modalDetalle.data.articulos.map((art: any, i: number) => (
                            <li key={i} className="text-sm font-bold text-slate-300 border-b border-slate-800 pb-2 last:border-0 last:pb-0 flex items-start gap-3 font-mono min-h-[2rem]">
                                {/* Cantidad */}
                                <span className="bg-cyan-900/40 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded text-xs min-w-[30px] text-center mt-0.5">
                                    {art.cantidad}
                                </span>
                                
                                {/* Descripción */}
                                <div className="flex-1 pt-0.5">
                                    <p className="uppercase leading-tight">{art.codigo}</p>
                                    {art.detalle && <p className="text-[10px] text-slate-500 italic font-normal mt-0.5">{art.detalle}</p>}
                                </div>
                            </li>
                        ))}
                        
                        {/* Items de Soporte */}
                        {modalDetalle.data.numeroSoporte && Array.isArray(modalDetalle.data.productos) && modalDetalle.data.productos.map((prod: string, i: number) => (
                            <li key={i} className="text-sm font-bold text-slate-300 border-b border-slate-800 pb-2 last:border-0 last:pb-0 flex items-center gap-3 font-mono">
                                <span className="text-violet-500">›</span>
                                <p className="uppercase">{prod}</p>
                            </li>
                        ))}
                    </ul>
                </div>
                
                {/* ACLARACIONES (SOLO LECTURA) */}
                <div className="bg-yellow-900/10 p-5 rounded-2xl border border-yellow-500/20 text-yellow-100 relative">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-[10px] font-black text-yellow-500 uppercase tracking-[0.2em] flex items-center gap-2">📝 Aclaraciones</h4>
                    </div>
                    <p className="text-xs font-mono leading-relaxed whitespace-pre-line text-yellow-200/80 min-h-[1.5em]">
                        {modalDetalle.data.aclaraciones || "Sin aclaraciones"}
                    </p>
                </div>
                
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
            <div className="mt-4 flex flex-col gap-3 shrink-0">
                {(modalDetalle.data.numeroRemito || modalDetalle.data.rangoEntrega) && (
                    <button 
                        onClick={notificarDesdeDetalle}
                        className={`w-full p-4 rounded-xl font-mono text-sm font-bold uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 ${
                            modalDetalle.data.notificado 
                            ? "bg-transparent text-emerald-400 border border-emerald-500 hover:bg-emerald-900/20 shadow-[0_0_10px_#10b981]" 
                            : "bg-emerald-600 text-black hover:bg-emerald-500 hover:shadow-[0_0_20px_#10b981]"
                        }`}
                    >
                        <span>💬</span> 
                        {modalDetalle.data.notificado ? "Reenviar notificación" : "Notificar"}
                    </button>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setModalDetalle({ open: false, data: null })} className="p-4 bg-slate-800 text-slate-400 rounded-xl font-mono text-sm font-bold uppercase tracking-wider hover:bg-slate-700 hover:text-white transition-colors border border-slate-700">
                        Cerrar
                    </button>
                    
                    {/* BOTÓN ELIMINAR (MANTENIDO) */}
                    <button 
                        onClick={() => {
                            if (window.confirm("⚠️ ¿Estás seguro de que quieres ELIMINAR este registro? Esta acción es irreversible.")) {
                                const path = modalDetalle.data.numeroRemito ? 'remitos' : 'soportes';
                                const id = (modalDetalle.data).id;
                                
                                // Eliminar de Firebase
                                remove(ref(db_realtime, `${path}/${id}`))
                                    .then(() => {
                                        setModalDetalle({ open: false, data: null });
                                    })
                                    .catch(err => alert("Error al eliminar: " + err.message));
                            }
                        }}
                        className="p-4 bg-red-900/20 text-red-400 rounded-xl font-mono text-sm font-bold uppercase tracking-wider hover:bg-red-900/50 hover:text-red-200 transition-colors border border-red-900/50 flex items-center justify-center gap-2"
                    >
                        🗑️ Eliminar
                    </button>
                </div>
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
                                    <span>💬</span> Asignar y Notificar
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

            {/* SIDEBAR DE CARGA - CON ÁREA DE PREPARACIÓN (STAGING) */}
{sidebarOpen && (
    <div className="fixed inset-0 z-[100] flex justify-end">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
        <div className="relative w-full max-w-lg bg-[#050b14] h-full shadow-[-20px_0_50px_rgba(0,0,0,0.5)] border-l border-cyan-900/50 p-8 overflow-y-auto animate-in slide-in-from-right duration-300 flex flex-col">
            
            {/* HEADER */}
            <div className="flex justify-between items-center mb-6 border-b border-cyan-900 pb-4 shrink-0">
                <h2 className="text-2xl font-black italic uppercase text-white tracking-tighter drop-shadow-[0_0_5px_cyan]">PANEL DE CARGA</h2>
                <button onClick={() => setSidebarOpen(false)} className="text-slate-500 hover:text-cyan-400 text-2xl font-bold transition-colors">✕</button>
            </div>
            
            <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                
                {/* SELECTOR DE MODO */}
                <div>
                    <label className="text-[10px] font-mono text-cyan-600 uppercase tracking-widest block mb-2">Protocolo de Carga</label>
                    <select value={tipoCarga} onChange={(e) => setTipoCarga(e.target.value as any)} className="w-full p-4 bg-slate-900/50 border border-slate-700 rounded-xl font-bold font-mono uppercase text-sm text-cyan-100 outline-none focus:border-cyan-500 transition-all">
                        <option value="">-- SELECCIONAR --</option>
                        <option value="remito">Remito</option>
                        <option value="soporte">Soporte</option>
                    </select>
                </div>

                {/* --- BLOQUE REMITO (STAGING) --- */}
                {tipoCarga === 'remito' && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        
                        {/* DROPZONE: Solo visible si NO hay pendientes, o para agregar más */}
                        <div className="border-2 border-dashed border-cyan-900/50 rounded-2xl p-6 text-center bg-slate-900/30 hover:bg-cyan-900/10 transition-all group relative cursor-pointer">
                            <input 
                                type="file" 
                                accept=".xlsx, .xls, .csv" 
                                multiple 
                                className="absolute inset-0 opacity-0 cursor-pointer z-50" 
                                onClick={(e) => (e.currentTarget.value = '')}
                                onChange={async (e) => {
                                    const files = e.target.files;
                                    if (!files || files.length === 0) return;
                                    setLoading(true);
                                    
                                    // Procesamos y guardamos en ESTADO LOCAL (remitosPendientes)
                                    // Necesitas agregar este estado arriba en tu componente: 
                                    // const [remitosPendientes, setRemitosPendientes] = useState<any[]>([]);

                                    // Dentro del onChange del input file...

const processFile = (file: File) => new Promise<any>((resolve) => {
    const reader = new FileReader();
    reader.onload = async (evt) => {
        try {
            const { read, utils } = await import('xlsx');
            const wb = read(evt.target?.result, { type: 'binary' });
            const data: any[][] = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });

            // --- EXTRACCIÓN ---
            const nroRemito = data[5]?.[26] || "Sin número"; // <--- La variable se llama nroRemito
            const fechaRaw = data[7]?.[28]; 
            const fechaEmision = typeof fechaRaw === 'number' 
                ? new Date((fechaRaw - 25569) * 86400 * 1000).toLocaleDateString() 
                : String(fechaRaw || new Date().toLocaleDateString());
            const cliente = data[15]?.[8] || "Sin nombre";
            const telRaw = String(data[21]?.[8] || "");      
            const telefono = telRaw.replace(/\D/g, ''); 

            const articulos: any[] = [];
            let textoAclaraciones = "";

            for (let i = 31; i < data.length; i++) {
                const row = data[i];
                if (!row) continue;
                const rowStr = row.join(' ').toUpperCase();
                const celdaNotas = row[3];
                
                if (rowStr.includes("DUPLICADO") || (typeof celdaNotas === 'string' && (celdaNotas.includes("SURTIDO") || celdaNotas.includes("TOTAL") || celdaNotas.includes("BULTOS")))) {
                    if (typeof celdaNotas === 'string') textoAclaraciones = celdaNotas;
                    break; 
                }

                const cant = row[1]; 
                const cod = row[7];
                if (typeof cant === 'number' && cod) {
                    articulos.push({ cantidad: cant, codigo: String(cod).trim(), detalle: "" });
                }
            }

            if (textoAclaraciones) {
                const lineas = textoAclaraciones.split(/\r?\n/);
                lineas.forEach(linea => {
                    const lineaLimpia = linea.toUpperCase().replace(/\s+/g, ""); 
                    articulos.forEach(item => {
                        const codigoLimpio = item.codigo.toUpperCase().replace(/\s+/g, "");
                        if (lineaLimpia.includes(codigoLimpio)) {
                            let detalleExtra = linea.replace(item.codigo, "").replace(item.codigo.split(' ')[0], "").trim(); 
                            if (detalleExtra && !detalleExtra.includes("TOTAL") && !detalleExtra.includes("BULTOS")) {
                                item.detalle = item.detalle ? `${item.detalle} | ${detalleExtra}` : detalleExtra;
                            }
                        }
                    });
                });
            }

            // RETORNAMOS EL OBJETO CON LA CORRECCIÓN
            resolve({
                tempId: Math.random().toString(36),
                numeroRemito: nroRemito, // <--- CORRECCIÓN AQUÍ: Asignamos nroRemito a la propiedad numeroRemito
                fechaEmision, 
                cliente, 
                telefono, 
                articulos,
                aclaraciones: textoAclaraciones,
                produccion: necesitaProduccion, 
                esTransporte: esTransporte,
                estadoPreparacion: "Pendiente", 
                notificado: false, 
                rangoDespacho: ""
            });
            
        } catch (err) { resolve(null); }
    };
    reader.readAsBinaryString(file);
});

                                    const nuevosRemitos = await Promise.all(Array.from(files).map(f => processFile(f)));
                                    // Filtramos nulos y agregamos a la lista de pendientes
                                    const validos = nuevosRemitos.filter(r => r !== null);
                                    setRemitosPendientes(prev => [...prev, ...validos]);
                                    setLoading(false);
                                }}
                            />
                            <div className="pointer-events-none">
                                <span className="text-3xl mb-2 block group-hover:scale-110 transition-transform">📂</span>
                                <p className="text-cyan-400 font-bold uppercase text-[10px] tracking-widest">Agregar Archivos</p>
                            </div>
                        </div>

                        {/* LISTA DE PENDIENTES (STAGING AREA) */}
                        {remitosPendientes.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex justify-between items-end">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                        Por Confirmar ({remitosPendientes.length})
                                    </h3>
                                    <button onClick={() => setRemitosPendientes([])} className="text-[10px] text-red-400 hover:text-red-200 underline">Limpiar todo</button>
                                </div>

                                {remitosPendientes.map((remito, index) => (
                                    <div key={remito.tempId} className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 animate-in zoom-in duration-200 relative group">
                                        {/* Botón Eliminar Individual */}
                                        <button 
                                            onClick={() => setRemitosPendientes(prev => prev.filter((_, i) => i !== index))}
                                            className="absolute top-2 right-2 text-slate-600 hover:text-red-500 font-bold p-1"
                                            title="Quitar"
                                        >✕</button>

                                        <div className="mb-3 pr-6">
                                            <p className="text-cyan-400 font-mono font-bold text-xs">{remito.numeroRemito}</p>
                                            <p className="text-white font-bold text-sm truncate">{remito.cliente}</p>
                                            <p className="text-[10px] text-slate-500 mt-1">{remito.articulos.length} items detectados</p>
                                        </div>

                                        {/* CONTROLES INDIVIDUALES */}
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => {
                                                    const updated = [...remitosPendientes];
                                                    updated[index].esTransporte = !updated[index].esTransporte;
                                                    setRemitosPendientes(updated);
                                                }}
                                                className={`flex-1 py-2 px-1 rounded-lg text-[10px] font-black uppercase border transition-all ${
                                                    remito.esTransporte 
                                                    ? 'bg-cyan-900/40 text-cyan-300 border-cyan-500/50' 
                                                    : 'bg-slate-950 text-slate-600 border-slate-800 hover:border-slate-600'
                                                }`}
                                            >
                                                {remito.esTransporte ? '🚛 Transporte SI' : '🚛 Transporte NO'}
                                            </button>

                                            <button 
                                                onClick={() => {
                                                    const updated = [...remitosPendientes];
                                                    updated[index].produccion = !updated[index].produccion;
                                                    setRemitosPendientes(updated);
                                                }}
                                                className={`flex-1 py-2 px-1 rounded-lg text-[10px] font-black uppercase border transition-all ${
                                                    remito.produccion 
                                                    ? 'bg-green-900/40 text-green-300 border-green-500/50' 
                                                    : 'bg-slate-950 text-slate-600 border-slate-800 hover:border-slate-600'
                                                }`}
                                            >
                                                {remito.produccion ? '⚙️ Producción SI' : '⚙️ Producción NO'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* --- BLOQUE SOPORTE (MANUAL) --- */}
                {tipoCarga === 'soporte' && (
                    <div className="space-y-4 animate-in fade-in duration-500">
                        <input type="text" placeholder="ID REF" className="w-full p-4 bg-slate-900/80 rounded-xl font-bold font-mono uppercase text-sm border border-slate-700 text-white focus:border-violet-500 outline-none" value={soporteData.numero} onChange={e => setSoporteData({...soporteData, numero: e.target.value})} />
                        <input type="text" placeholder="NOMBRE CLIENTE" className="w-full p-4 bg-slate-900/80 rounded-xl font-bold font-mono uppercase text-sm border border-slate-700 text-white focus:border-violet-500 outline-none" value={soporteData.cliente} onChange={e => setSoporteData({...soporteData, cliente: e.target.value})} />
                        <input type="text" placeholder="CONTACTO (OPCIONAL)" className="w-full p-4 bg-slate-900/80 rounded-xl font-bold font-mono uppercase text-sm border border-slate-700 text-white focus:border-violet-500 outline-none" value={soporteData.telefono} onChange={e => setSoporteData({...soporteData, telefono: e.target.value})} />
                        <input type="date" className="w-full p-4 bg-slate-900/80 rounded-xl font-bold text-sm border border-slate-700 uppercase text-slate-400 focus:text-white outline-none" value={soporteData.fecha} onChange={e => setSoporteData({...soporteData, fecha: e.target.value})} />
                        <textarea rows={5} placeholder="COMPONENTES..." className="w-full p-4 bg-slate-900/80 rounded-xl border border-slate-700 font-bold font-mono uppercase text-sm text-violet-300 outline-none focus:border-violet-500" value={soporteData.productos} onChange={e => setSoporteData({...soporteData, productos: e.target.value})} />
                    </div>
                )}
            </div>

            {/* FOOTER ACTIONS (FIJO ABAJO) */}
            <div className="pt-4 mt-4 border-t border-cyan-900/30 shrink-0">
                {tipoCarga === 'remito' ? (
                    <button 
                        disabled={loading || remitosPendientes.length === 0} 
                        onClick={async () => {
                            setLoading(true);
                            try {
                                const promises = remitosPendientes.map(({ tempId, ...data }) => 
                                    push(ref(db_realtime, 'remitos'), {
                                        ...data,
                                        timestamp: new Date().toISOString()
                                    })
                                );
                                await Promise.all(promises);
                                alert(`✅ Se guardaron ${remitosPendientes.length} remitos correctamente.`);
                                setRemitosPendientes([]);
                                setSidebarOpen(false);
                            } catch (e) { alert("❌ Error al guardar."); }
                            setLoading(false);
                        }} 
                        className="w-full p-5 bg-cyan-600 text-black rounded-xl font-black font-mono uppercase tracking-widest shadow-[0_0_20px_rgba(8,145,178,0.4)] hover:bg-cyan-400 hover:scale-[1.02] transition-all disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none disabled:transform-none"
                    >
                        {loading ? 'PROCESANDO...' : `CONFIRMAR (${remitosPendientes.length})`}
                    </button>
                ) : (
                    <button 
                        disabled={loading} 
                        onClick={guardarDatos} // Usamos la función existente para soporte o reescribimos aquí si prefieres
                        className="w-full p-5 bg-violet-600 text-white rounded-xl font-black font-mono uppercase tracking-widest shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:bg-violet-500 hover:scale-[1.02] transition-all disabled:bg-slate-800 disabled:text-slate-600"
                    >
                        {loading ? 'GUARDANDO...' : 'GUARDAR SOPORTE'}
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