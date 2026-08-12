import { useState, useEffect } from 'react';
import { db_realtime } from './firebase/config';
import { ref, onValue } from "firebase/database";
import ControlDeRemitos from './pages/ControlDeRemitos';
import ControlSoportes from './pages/ControlSoportes';
import GestionSoportes from './pages/GestionSoportes';
import PantallaProduccion from './pages/PantallaProduccion';
import ContadorArmados from './pages/ContadorArmados';
import HistorialDespachos from './pages/HistorialDespachos';
import Login from './pages/Login';
import Usuarios from './pages/Usuarios';
import Estadisticas from './pages/Estadisticas';
import SoportesRetirados from './pages/SoportesRetirados';
import Pagos from './pages/Pagos';
import Devoluciones from './pages/Devoluciones';
import ControlStock from './pages/ControlStock';
import { AuthProvider, useAuth } from './context/AuthContext';

const globalStyles = `
  .scrollbar-hide::-webkit-scrollbar {
      display: none;
  }
  .scrollbar-hide {
      -ms-overflow-style: none;
      scrollbar-width: none;
  }
`;

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  alertCount?: number;
}

const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon, label, alertCount }) => (
  <button
    onClick={onClick}
    className={`
      w-full md:w-16 h-12 md:h-16 rounded-xl md:rounded-2xl
      flex flex-row md:flex-col items-center justify-start md:justify-center
      gap-3 md:gap-1 px-3 md:px-0
      transition-all duration-300 group/btn relative border shrink-0
      ${
        active
          ? 'bg-cyan-900/30 border-cyan-500/50 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)] md:scale-105'
          : 'bg-transparent border-transparent text-slate-400 md:text-slate-500 hover:text-white hover:bg-white/5 hover:border-slate-700'
      }
    `}
  >
    {alertCount && alertCount > 0 ? (
      <span className="absolute top-1 right-2 md:-top-1 md:-right-1 bg-red-600 text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full shadow-[0_0_10px_red] animate-pulse z-10 border-2 border-[#050b14]">
        {alertCount}
      </span>
    ) : null}

    <span className={`text-xl md:text-2xl md:mb-0.5 transition-transform ${active ? 'md:scale-110 drop-shadow-[0_0_5px_currentColor]' : 'group-hover/btn:scale-110'}`}>
      {icon}
    </span>

    <span className="text-[11px] md:text-[8px] font-bold font-mono uppercase tracking-wider text-left md:text-center leading-none opacity-90 md:opacity-80 group-hover/btn:opacity-100">
      {label}
    </span>
  </button>
);

const AppContent = () => {
  const { user, role, logout } = useAuth();
  const [paginaActual, setPaginaActual] = useState<string>('produccion');
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);

  const [retirosPendientes, setRetirosPendientes] = useState(0);
  const [pagosPendientes, setPagosPendientes] = useState(0);

  const navegarA = (pagina: string) => {
    setPaginaActual(pagina);
    setMenuMovilAbierto(false);
  };

  useEffect(() => {
    if (role !== 'admin') return;

    const unsubscribe = onValue(ref(db_realtime, 'soportesypagos'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const items = Object.values(data);

        const countSoportes = items.filter((item: any) => item.tipo === "Soporte").length;
        setRetirosPendientes(countSoportes);

        const countPagos = items.filter((item: any) => item.tipo === "Pago" && item.estado !== "Registrado").length;
        setPagosPendientes(countPagos);
      } else {
        setRetirosPendientes(0);
        setPagosPendientes(0);
      }
    });

    return () => unsubscribe();
  }, [role]);

  useEffect(() => {
    const nombres: Record<string, string> = {
      remitos: 'Logística',
      control_soportes: 'Admin Soportes',
      historial: 'Historial',
      estadisticas: 'Dashboard',
      retiros: 'Soportes Retirados',
      pagos: 'Control Pagos',
      devoluciones: 'Devoluciones',
      produccion: 'Producción',
      contador: 'Monitor',
      gestion_soportes: 'Taller',
      usuarios: 'Usuarios',
      control_stock: 'Control Stock'
    };

    const titulo = nombres[paginaActual] || 'App';
    document.title = `${titulo} | Gestión Bipokids`;
  }, [paginaActual]);

  useEffect(() => {
    if (role === 'admin' && paginaActual === 'produccion') setPaginaActual('remitos');

    if (role === 'vendedor' && !['devoluciones', 'control_stock'].includes(paginaActual)) {
      setPaginaActual('devoluciones');
    }

    if (role === 'produccion' && !['produccion', 'contador', 'gestion_soportes', 'control_stock'].includes(paginaActual)) {
      setPaginaActual('produccion');
    }
  }, [role]);

  // Si se pasa de móvil a escritorio, cerramos el estado móvil para no dejar overlays colgados.
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) setMenuMovilAbierto(false);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Evita que el contenido de fondo se desplace cuando el menú está abierto en móvil.
  useEffect(() => {
    if (!menuMovilAbierto) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuMovilAbierto]);

  if (!user) return <Login />;

  const hayAlertas = retirosPendientes > 0 || pagosPendientes > 0;

  return (
    <div className="flex min-h-screen bg-[#050b14] font-sans selection:bg-cyan-500 selection:text-black overflow-x-hidden">
      <style>{globalStyles}</style>

      <div
        className="fixed inset-0 z-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 50% 50%, #1e293b 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      {/* BOTÓN MÓVIL: reemplaza el hover inexistente en pantallas táctiles */}
      <button
        type="button"
        onClick={() => setMenuMovilAbierto(true)}
        className="md:hidden fixed top-3 left-3 z-[70] w-11 h-11 rounded-xl bg-[#0f172a]/95 backdrop-blur-xl border border-cyan-500/40 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.25)] flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Abrir menú"
      >
        <span className="text-xl">☰</span>
        {hayAlertas && (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 shadow-[0_0_10px_red] animate-pulse" />
        )}
      </button>

      {/* OVERLAY SOLO MÓVIL */}
      {menuMovilAbierto && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setMenuMovilAbierto(false)}
          className="md:hidden fixed inset-0 z-[55] bg-black/65 backdrop-blur-[2px]"
        />
      )}

      {/*
        MÓVIL: drawer táctil de ancho cómodo.
        PC: conserva exactamente el comportamiento furtivo por hover.
      */}
      <nav
        className={`
          fixed top-0 left-0 h-[100dvh]
          w-[82vw] max-w-[280px] md:w-28 md:max-w-none
          bg-[#0f172a]/95 backdrop-blur-xl
          border-r border-cyan-500/30 shadow-[10px_0_30px_rgba(0,0,0,0.8)]
          z-[60]
          transition-transform duration-500 ease-[cubic-bezier(0.33,1,0.68,1)]
          ${menuMovilAbierto ? 'translate-x-0' : '-translate-x-full'}
          md:-translate-x-[calc(100%-14px)] md:hover:translate-x-0
          group overflow-y-auto scrollbar-hide
          flex flex-col items-center py-5 md:py-8 gap-3 md:gap-4
        `}
      >
        {/* PESTAÑA VISUAL: solo escritorio */}
        <div className="hidden md:flex absolute right-0 top-0 h-full w-[14px] flex-col justify-center items-center pointer-events-none">
          <div className={`w-[1px] h-full transition-colors duration-500 ${hayAlertas ? 'bg-red-900/60' : 'bg-cyan-900/20'}`} />

          <div
            className={`absolute right-[4px] w-[6px] rounded-full transition-all duration-500 ease-in-out group-hover:opacity-0 shadow-lg ${
              hayAlertas
                ? 'h-32 bg-red-500 shadow-[0_0_25px_red] animate-pulse'
                : 'h-16 bg-cyan-500 shadow-[0_0_15px_cyan]'
            }`}
          />
        </div>

        {/* HEADER MÓVIL + LOGO */}
        <div className="w-full px-4 md:px-0 flex items-center justify-between md:justify-center mb-2 md:mb-4 shrink-0">
          <div className="relative group/logo cursor-default opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-500 md:delay-100">
            <div className="text-2xl md:text-3xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-violet-600 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
              BK
            </div>
          </div>

          <span className="md:hidden text-[10px] font-mono font-black tracking-[0.2em] uppercase text-slate-500">
            Menú
          </span>

          <button
            type="button"
            onClick={() => setMenuMovilAbierto(false)}
            className="md:hidden w-9 h-9 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-white/5 flex items-center justify-center"
            aria-label="Cerrar menú"
          >
            ✕
          </button>
        </div>

        {/* MENÚ: visible siempre en móvil; fade por hover en desktop */}
        <div className="flex-1 flex flex-col gap-3 md:gap-4 w-full items-center px-3 md:px-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 md:delay-75">
          {role === 'admin' && (
            <>
              <NavButton active={paginaActual === 'remitos'} onClick={() => navegarA('remitos')} icon="🚚" label="Logística" />
              <NavButton
                active={paginaActual === 'control_soportes' || paginaActual === 'retiros'}
                onClick={() => navegarA('control_soportes')}
                icon="📋"
                label="Soportes"
                alertCount={retirosPendientes}
              />
              <NavButton active={paginaActual === 'historial'} onClick={() => navegarA('historial')} icon="🗂️" label="Despachos" />
              <NavButton
                active={paginaActual === 'pagos'}
                onClick={() => navegarA('pagos')}
                icon="💰"
                label="Pagos"
                alertCount={pagosPendientes}
              />
              <NavButton active={paginaActual === 'estadisticas'} onClick={() => navegarA('estadisticas')} icon="📊" label="Métricas" />
            </>
          )}

          {(role === 'admin' || role === 'produccion') && <div className="w-full md:w-12 h-[1px] bg-slate-800 my-1 md:my-2 shrink-0" />}

          {role !== 'vendedor' && (
            <>
              <NavButton active={paginaActual === 'contador'} onClick={() => navegarA('contador')} icon="🔢" label="Contador" />
              <NavButton active={paginaActual === 'produccion'} onClick={() => navegarA('produccion')} icon="⚙️" label="Producción" />
              <NavButton active={paginaActual === 'gestion_soportes'} onClick={() => navegarA('gestion_soportes')} icon="🔧" label="Taller" />
              <NavButton active={paginaActual === 'control_stock'} onClick={() => navegarA('control_stock')} icon="📦" label="Stock" />
            </>
          )}

          {role === 'vendedor' && (
            <>
              <NavButton active={paginaActual === 'devoluciones'} onClick={() => navegarA('devoluciones')} icon="↩️" label="Devoluciones" />
              <NavButton active={paginaActual === 'control_stock'} onClick={() => navegarA('control_stock')} icon="📦" label="Stock" />
            </>
          )}

          {role === 'admin' && (
            <>
              <div className="w-full md:w-12 h-[1px] bg-slate-800 my-1 md:my-2 shrink-0" />
              <NavButton active={paginaActual === 'devoluciones'} onClick={() => navegarA('devoluciones')} icon="↩️" label="Devoluciones" />
              <NavButton active={paginaActual === 'usuarios'} onClick={() => navegarA('usuarios')} icon="👥" label="Usuarios" />
            </>
          )}

          <div className="mt-auto pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] w-full flex justify-center border-t border-slate-800/50 shrink-0">
            <button
              onClick={logout}
              className="w-full md:w-10 h-11 md:h-10 rounded-xl bg-red-900/20 text-red-500 border border-red-500/20 flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white hover:shadow-[0_0_15px_red] transition-all font-mono text-xs font-bold uppercase"
              title="Cerrar Sesión"
            >
              <span>✕</span>
              <span className="md:hidden">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </nav>

      {/* En móvil dejamos espacio superior para el botón de menú; en PC queda como estaba */}
      <main className="flex-1 ml-0 md:ml-4 pt-16 md:pt-0 transition-all duration-300 relative z-10 w-full min-w-0">
        {role === 'admin' && (
          <>
            {paginaActual === 'remitos' && <ControlDeRemitos />}
            {paginaActual === 'retiros' && <SoportesRetirados />}
            {paginaActual === 'control_soportes' && <ControlSoportes onNavigate={navegarA} />}
            {paginaActual === 'historial' && <HistorialDespachos />}
            {paginaActual === 'pagos' && <Pagos />}
            {paginaActual === 'estadisticas' && <Estadisticas />}
            {paginaActual === 'usuarios' && <Usuarios />}
          </>
        )}

        {(role === 'admin' || role === 'vendedor') && paginaActual === 'devoluciones' && <Devoluciones />}

        {role !== 'vendedor' && (
          <>
            {paginaActual === 'contador' && <ContadorArmados />}
            {paginaActual === 'produccion' && <PantallaProduccion />}
            {paginaActual === 'gestion_soportes' && <GestionSoportes />}
          </>
        )}

        {paginaActual === 'control_stock' && <ControlStock />}
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
