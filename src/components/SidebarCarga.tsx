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

  const [datosRemito, setDatosRemito] = useState('');
  const [productosTexto, setProductosTexto] = useState('');
  const [aclaraciones, setAclaraciones] = useState('');
  const [esTransporte, setEsTransporte] = useState(false);

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
            if (!cliente && lineasDatos[i + 1]) cliente = lineasDatos[i + 1].trim();
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
      setDatosRemito('');
      setProductosTexto('');
      setAclaraciones('');
    } catch (error) {
      alert("❌ Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] transition-opacity"
          onClick={onClose}
        />
      )}

      <div
        className={`
          fixed top-0 right-0 h-[100dvh] w-full sm:max-w-md
          bg-[#0f172a] border-l border-cyan-900/50
          shadow-[-20px_0_50px_rgba(0,0,0,0.5)] z-[101]
          transform transition-transform duration-300 ease-in-out
          overflow-y-auto custom-scrollbar
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div className="p-4 sm:p-6 md:p-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8 pt-1 pb-4 mb-6 md:mb-10 bg-[#0f172a]/95 backdrop-blur-xl border-b border-cyan-900/30 flex justify-between items-center">
            <h2 className="text-xl sm:text-2xl font-black italic text-white uppercase tracking-tighter drop-shadow-[0_0_5px_cyan]">
              Data <span className="text-cyan-500">Ingest</span>
            </h2>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors border border-slate-800"
              aria-label="Cerrar panel"
            >
              ✕
            </button>
          </div>

          <div className="mb-6 md:mb-8">
            <label className="text-[10px] font-black text-cyan-600 uppercase tracking-widest block mb-2 font-mono">
              Input Protocol
            </label>
            <select
              value={tipoCarga}
              onChange={(e) => setTipoCarga(e.target.value as any)}
              className="w-full min-h-12 p-3 sm:p-4 bg-[#050b14] border border-slate-700 rounded-xl font-bold font-mono uppercase text-sm text-cyan-100 outline-none focus:border-cyan-500 focus:shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all cursor-pointer appearance-none"
            >
              <option value="">-- SELECT TYPE --</option>
              <option value="remito">LOGISTICS (Remito)</option>
              <option value="soporte">TECHNICAL (Soporte)</option>
            </select>
          </div>

          {tipoCarga === 'remito' && (
            <div className="space-y-4 sm:space-y-6 animate-in slide-in-from-right-4 duration-300 fade-in">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 font-mono">Raw Data Block</label>
                <textarea
                  rows={6}
                  className="w-full p-3 sm:p-4 bg-[#050b14]/50 border border-slate-700 rounded-xl font-mono text-xs text-green-400 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all placeholder-slate-700 resize-y"
                  placeholder="> Paste raw data stream here..."
                  value={datosRemito}
                  onChange={(e) => setDatosRemito(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 font-mono">Product Matrix</label>
                <textarea
                  rows={4}
                  className="w-full p-3 sm:p-4 bg-[#050b14]/50 border border-slate-700 rounded-xl font-mono text-xs text-cyan-200 outline-none focus:border-cyan-500 transition-all placeholder-slate-700 resize-y"
                  placeholder="> QTY CODE..."
                  value={productosTexto}
                  onChange={(e) => setProductosTexto(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 font-mono">Metadata / Notes</label>
                <textarea
                  rows={3}
                  className="w-full p-3 sm:p-4 bg-[#050b14]/50 border border-slate-700 rounded-xl font-mono text-xs text-yellow-200 outline-none focus:border-yellow-500 transition-all placeholder-slate-700 resize-y"
                  placeholder="// Comments..."
                  value={aclaraciones}
                  onChange={(e) => setAclaraciones(e.target.value)}
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer bg-[#050b14] p-3 sm:p-4 rounded-xl border border-slate-700 hover:border-cyan-500 transition-colors group">
                <input
                  type="checkbox"
                  checked={esTransporte}
                  onChange={(e) => setEsTransporte(e.target.checked)}
                  className="w-5 h-5 rounded bg-black border-slate-500 text-cyan-500 focus:ring-0 shrink-0"
                />
                <span className="text-[11px] font-black text-slate-400 uppercase italic font-mono group-hover:text-cyan-400 transition-colors">
                  External Route (Transport)
                </span>
              </label>
            </div>
          )}

          {tipoCarga === 'soporte' && (
            <div className="space-y-4 sm:space-y-5 animate-in slide-in-from-right-4 duration-300 fade-in">
              <input
                type="text"
                placeholder="ID REF"
                className="w-full min-h-12 p-3 sm:p-4 bg-[#050b14] border border-slate-700 rounded-xl font-bold font-mono text-sm text-white outline-none focus:border-violet-500 transition-all placeholder-slate-600"
                value={soporteData.numero}
                onChange={e => setSoporteData({ ...soporteData, numero: e.target.value })}
              />
              <input
                type="text"
                placeholder="CLIENT ENTITY"
                className="w-full min-h-12 p-3 sm:p-4 bg-[#050b14] border border-slate-700 rounded-xl font-bold font-mono text-sm text-white outline-none focus:border-violet-500 transition-all placeholder-slate-600 uppercase"
                value={soporteData.cliente}
                onChange={e => setSoporteData({ ...soporteData, cliente: e.target.value })}
              />
              <input
                type="date"
                className="w-full min-h-12 p-3 sm:p-4 bg-[#050b14] border border-slate-700 rounded-xl font-bold font-mono text-sm text-slate-300 outline-none focus:border-violet-500 transition-all"
                value={soporteData.fecha}
                onChange={e => setSoporteData({ ...soporteData, fecha: e.target.value })}
              />
              <textarea
                rows={5}
                placeholder="> SERVICE DETAILS..."
                className="w-full p-3 sm:p-4 bg-[#050b14] border border-slate-700 rounded-xl font-bold font-mono text-sm text-violet-200 outline-none focus:border-violet-500 transition-all placeholder-slate-600 resize-y"
                value={soporteData.productos}
                onChange={e => setSoporteData({ ...soporteData, productos: e.target.value })}
              />
            </div>
          )}

          {tipoCarga && (
            <button
              disabled={loading}
              onClick={guardar}
              className={`w-full mt-6 md:mt-8 min-h-14 p-4 sm:p-5 rounded-xl font-black font-mono uppercase tracking-[0.12em] sm:tracking-[0.2em] text-black shadow-[0_0_20px_rgba(0,0,0,0.5)] transition-all relative overflow-hidden group ${loading ? 'bg-slate-700 text-slate-500' : 'bg-cyan-500 hover:bg-cyan-400 hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] active:scale-[0.98]'}`}
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              <span className="relative z-10">{loading ? 'PROCESSING...' : 'EXECUTE UPLOAD'}</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default SidebarCarga;
