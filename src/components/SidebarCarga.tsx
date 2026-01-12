import React, { useState } from 'react';
import { db_realtime } from '../firebase/config';
import { ref, push, set } from "firebase/database";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const SidebarCarga: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const [tipoCarga, setTipoCarga] = useState<'remito' | 'soporte' | ''>('');
  const [loading, setLoading] = useState(false);

  // Estados Form Remito
  const [datosRemito, setDatosRemito] = useState('');
  const [productosTexto, setProductosTexto] = useState('');
  const [aclaraciones, setAclaraciones] = useState('');
  const [esTransporte, setEsTransporte] = useState(false);

  // Estados Form Soporte
  const [soporteData, setSoporteData] = useState({
    numero: '',
    cliente: '',
    fecha: new Date().toISOString().split('T')[0],
    productos: ''
  });

  const asociarDetalles = (articulos: any[], aclaracionesStr: string) => {
    if (!aclaracionesStr) return articulos;
    const lineas = aclaracionesStr.split(/\r?\n|\/\//).map(l => l.trim()).filter(Boolean);
    
    return articulos.map(item => {
      let nuevoDetalle = item.detalle || "";
      const codNorm = item.codigo.replace(/\s+/g, "");
      
      lineas.forEach(linea => {
        if (linea.replace(/\s+/g, "").includes(codNorm)) {
          let detalleExtra = linea.replace(item.codigo, "").trim();
          if (detalleExtra) {
            nuevoDetalle = nuevoDetalle ? `${nuevoDetalle} | ${detalleExtra}` : detalleExtra;
          }
        }
      });
      return { ...item, detalle: nuevoDetalle };
    });
  };

  const guardar = async () => {
    if (!tipoCarga) return;
    setLoading(true);

    try {
      if (tipoCarga === 'remito') {
        const numeroRemito = (datosRemito.match(/\b\d{4}-\d{8}\b/) || [""])[0];
        const fechaEmision = (datosRemito.match(/\b\d{2}\/\d{2}\/\d{2,4}\b/) || [""])[0];

        let cliente = "";
        const lineasDatos = datosRemito.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        for (let i = 0; i < lineasDatos.length; i++) {
          if (/Raz[oó]n Social:/i.test(lineasDatos[i])) {
            cliente = lineasDatos[i].replace(/Raz[oó]n Social:/i, "").trim();
            if (!cliente && lineasDatos[i+1]) cliente = lineasDatos[i+1].trim();
            break;
          }
          if (!cliente && lineasDatos[i].length > 3 && !/^CUIT|Fecha|Tel|Domicilio/i.test(lineasDatos[i])) {
            cliente = lineasDatos[i];
          }
        }

        const articulos: any[] = [];
        productosTexto.split(/\r?\n/).filter(Boolean).forEach(l => {
          const partes = l.trim().split(/\s+/);
          if (partes.length >= 2) {
            const cantidad = parseFloat(partes.shift()!.replace(",", "."));
            const codigo = partes.join(" ");
            if (codigo && !isNaN(cantidad)) articulos.push({ codigo, cantidad, detalle: "" });
          }
        });

        const articulosConDetalle = asociarDetalles(articulos, aclaraciones);

        const nuevoRemitoRef = push(ref(db_realtime, 'remitos'));
        await set(nuevoRemitoRef, {
          numeroRemito,
          fechaEmision,
          cliente,
          articulos: articulosConDetalle,
          aclaraciones,
          produccion: false,
          estado: null,
          estadoPreparacion: "Pendiente",
          rangoDespacho: "",
          esTransporte,
          timestamp: new Date().toISOString()
        });

      } else {
        const nuevoSoporteRef = push(ref(db_realtime, 'soportes'));
        await set(nuevoSoporteRef, {
          numeroSoporte: soporteData.numero,
          cliente: soporteData.cliente,
          fechaSoporte: soporteData.fecha,
          productos: soporteData.productos.split(/\r?\n/).filter(Boolean),
          estado: "Pendiente",
          timestamp: new Date().toISOString()
        });
      }

      alert("✅ Guardado con éxito");
      onClose();
      // Limpiar estados
      setDatosRemito(''); setProductosTexto(''); setAclaraciones('');
    } catch (error) {
      alert("❌ Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[100]" onClick={onClose} />
      )}

      {/* Sidebar */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[101] transform transition-transform duration-300 ease-in-out p-6 overflow-y-auto ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-black italic text-slate-800 uppercase">Carga de Datos</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">✕</button>
        </div>

        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Tipo de carga</label>
        <select 
          value={tipoCarga} 
          onChange={(e) => setTipoCarga(e.target.value as any)}
          className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold uppercase text-sm mb-6 outline-none focus:border-blue-500"
        >
          <option value="">-- Seleccionar --</option>
          <option value="remito">Remito</option>
          <option value="soporte">Soporte</option>
        </select>

        {tipoCarga === 'remito' && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Bloque Remito y Cliente</label>
              <textarea 
                rows={6} 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs outline-none focus:bg-white transition-all"
                placeholder="Pegue aquí el bloque completo..."
                value={datosRemito}
                onChange={(e) => setDatosRemito(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Productos y Cantidades</label>
              <textarea 
                rows={4} 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs outline-none focus:bg-white"
                placeholder="Cantidad Código..."
                value={productosTexto}
                onChange={(e) => setProductosTexto(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Detalles / Aclaraciones</label>
              <textarea 
                rows={3} 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs outline-none focus:bg-white"
                placeholder="Ej: MPE 1200 ROJOS..."
                value={aclaraciones}
                onChange={(e) => setAclaraciones(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-3 cursor-pointer bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <input type="checkbox" checked={esTransporte} onChange={(e) => setEsTransporte(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-blue-600" />
              <span className="text-[11px] font-black text-slate-600 uppercase italic">Corresponde a Transporte</span>
            </label>
          </div>
        )}

        {tipoCarga === 'soporte' && (
          <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
            <input type="text" placeholder="N° SOPORTE" className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-slate-100 uppercase text-sm" value={soporteData.numero} onChange={e => setSoporteData({...soporteData, numero: e.target.value})} />
            <input type="text" placeholder="CLIENTE" className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-slate-100 uppercase text-sm" value={soporteData.cliente} onChange={e => setSoporteData({...soporteData, cliente: e.target.value})} />
            <input type="date" className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-slate-100 text-sm" value={soporteData.fecha} onChange={e => setSoporteData({...soporteData, fecha: e.target.value})} />
            <textarea rows={5} placeholder="LISTA DE PRODUCTOS..." className="w-full p-4 bg-slate-50 rounded-2xl border-slate-100 font-bold uppercase text-sm" value={soporteData.productos} onChange={e => setSoporteData({...soporteData, productos: e.target.value})} />
          </div>
        )}

        {tipoCarga && (
          <button 
            disabled={loading}
            onClick={guardar}
            className={`w-full mt-8 p-5 rounded-[2rem] font-black uppercase italic tracking-widest text-white shadow-xl transition-all ${loading ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-blue-500/20'}`}
          >
            {loading ? 'Guardando...' : 'Guardar Datos'}
          </button>
        )}
      </div>
    </>
  );
};

export default SidebarCarga;