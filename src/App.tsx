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
import { AuthProvider, useAuth } from './context/AuthContext';

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
    className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-300 group relative border ${
      active 
        ? 'bg-cyan-900/30 border-cyan-500/50 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)] scale-105' 
        : 'bg-transparent border-transparent text-slate-500 hover:text-white hover:bg-white/5 hover:border-slate-700'
    }`}
  >
    {/* Alert Badge (Holographic Pulse) */}
    {alertCount && alertCount > 0 ? (
      <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full shadow-[0_0_10px_red] animate-pulse z-10 border-2 border-[#050b14]">
        {alertCount}
      </span>
    ) : null}

    {/* Icon Glow Effect */}
    <span className={`text-2xl mb-0.5 transition-transform ${active ? 'scale-110 drop-shadow-[0_0_5px_currentColor]' : 'group-hover:scale-110'}`}>
        {icon}
    </span>
    
    <span className="text-[8px] font-bold font-mono uppercase tracking-wider text-center leading-none max-w-full break-words opacity-80 group-hover:opacity-100">
      {label}
    </span>
  </button>
);

const AppContent = () => {
  const { user, role, logout } = useAuth();
  const [paginaActual, setPaginaActual] = useState<string>('produccion');
  const [retirosPendientes, setRetirosPendientes] = useState(0);

  useEffect(() => {
    if (role !== 'admin') return;

    const unsubscribe = onValue(ref(db_realtime, 'soportesypagos'), (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            const count = Object.values(data).filter((item: any) => item.tipo === "Soporte").length;
            setRetirosPendientes(count);
        } else {
            setRetirosPendientes(0);
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
      usuarios: 'Usuarios'
    };
    
    const titulo = nombres[paginaActual] || 'App';
    document.title = `${titulo} | Nebula Control`;
  }, [paginaActual]);

  useEffect(() => {
    if (role === 'admin' && paginaActual === 'produccion') setPaginaActual('remitos');
    if (role === 'vendedor' && paginaActual !== 'devoluciones') setPaginaActual('devoluciones');
    if (role === 'produccion' && !['produccion', 'contador', 'gestion_soportes'].includes(paginaActual)) {
        setPaginaActual('produccion');
    }
  }, [role]);

  if (!user) return <Login />;

  return (
    <div className="flex min-h-screen bg-[#050b14] font-sans selection:bg-cyan-500 selection:text-black overflow-hidden">
      
      {/* GLOBAL BACKGROUND GRID (Persistente) */}
      <div className="fixed inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #1e293b 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

      {/* SIDEBAR NAVIGATION */}
      <nav className="w-24 bg-[#0f172a]/80 backdrop-blur-xl flex flex-col items-center py-8 gap-4 fixed h-full z-50 border-r border-slate-800/60 shadow-[5px_0_30px_rgba(0,0,0,0.5)] overflow-y-auto custom-scrollbar">
        
        {/* LOGO */}
        <div className="mb-4 relative group cursor-default">
            <div className="text-3xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-violet-600 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                BK
            </div>
            <div className="absolute inset-0 bg-cyan-500 blur-xl opacity-0 group-hover:opacity-20 transition-opacity duration-500"></div>
        </div>
        
        {/* 1. GRUPO SUPERIOR (ADMIN) */}
        {role === 'admin' && (
          <>
            <NavButton active={paginaActual === 'remitos'} onClick={() => setPaginaActual('remitos')} icon="🚚" label="Logística" />
            <NavButton 
                active={paginaActual === 'control_soportes' || paginaActual === 'retiros'} 
                onClick={() => setPaginaActual('control_soportes')} 
                icon="📋" 
                label="Soportes"
                alertCount={retirosPendientes} 
            />
            <NavButton active={paginaActual === 'historial'} onClick={() => setPaginaActual('historial')} icon="🗂️" label="Despachos" />
            <NavButton active={paginaActual === 'pagos'} onClick={() => setPaginaActual('pagos')} icon="💰" label="Pagos" />
            <NavButton active={paginaActual === 'estadisticas'} onClick={() => setPaginaActual('estadisticas')} icon="📊" label="Métricas" />
          </>
        )}

        {/* Separador */}
        {(role === 'admin' || role === 'produccion') && <div className="w-12 h-[1px] bg-slate-800 my-2"></div>}

        {/* 2. GRUPO OPERATIVO (Todos menos vendedor puro) */}
        {role !== 'vendedor' && (
            <>
                <NavButton active={paginaActual === 'contador'} onClick={() => setPaginaActual('contador')} icon="🔢" label="Contador" />
                <NavButton active={paginaActual === 'produccion'} onClick={() => setPaginaActual('produccion')} icon="⚙️" label="Producción" />
                <NavButton active={paginaActual === 'gestion_soportes'} onClick={() => setPaginaActual('gestion_soportes')} icon="🔧" label="Reparación" />
            </>
        )}

        {/* 3. SOLO VENDEDOR (Acceso principal) */}
        {role === 'vendedor' && (
             <NavButton active={paginaActual === 'devoluciones'} onClick={() => setPaginaActual('devoluciones')} icon="↩️" label="Devoluciones" />
        )}

        {/* 4. GRUPO INFERIOR (ADMIN) */}
        {role === 'admin' && (
           <>
             <div className="w-12 h-[1px] bg-slate-800 my-2"></div>
             
             {/* Devoluciones aquí para admin (sobre Usuarios) */}
             <NavButton active={paginaActual === 'devoluciones'} onClick={() => setPaginaActual('devoluciones')} icon="↩️" label="Devoluciones" />
             
             <NavButton active={paginaActual === 'usuarios'} onClick={() => setPaginaActual('usuarios')} icon="👥" label="Usuarios" />
           </>
        )}

        <div className="mt-auto pb-4 pt-4 w-full flex justify-center border-t border-slate-800/50">
             <button 
                onClick={logout} 
                className="w-10 h-10 rounded-xl bg-red-900/20 text-red-500 border border-red-500/20 flex items-center justify-center hover:bg-red-500 hover:text-white hover:shadow-[0_0_15px_red] transition-all" 
                title="Cerrar Sesión"
             >
                ✕
             </button>
        </div>
      </nav>

      {/* MAIN CONTENT WRAPPER */}
      <main className="flex-1 ml-24 transition-all duration-300 relative z-10">
        
        {/* VISTAS ADMIN */}
        {role === 'admin' && (
            <>
                {paginaActual === 'remitos' && <ControlDeRemitos />}
                {paginaActual === 'retiros' && <SoportesRetirados />}
                {paginaActual === 'control_soportes' && <ControlSoportes onNavigate={setPaginaActual} />}
                {paginaActual === 'historial' && <HistorialDespachos />}
                {paginaActual === 'pagos' && <Pagos />}
                {paginaActual === 'estadisticas' && <Estadisticas />}
                {paginaActual === 'usuarios' && <Usuarios />}
            </>
        )}

        {/* VISTAS DEVOLUCIONES (Admin + Vendedor) */}
        {(role === 'admin' || role === 'vendedor') && paginaActual === 'devoluciones' && (
            <Devoluciones />
        )}
        
        {/* VISTAS OPERATIVAS (Todos menos vendedor puro) */}
        {role !== 'vendedor' && (
            <>
                {paginaActual === 'contador' && <ContadorArmados />}
                {paginaActual === 'produccion' && <PantallaProduccion />}
                {paginaActual === 'gestion_soportes' && <GestionSoportes />}
            </>
        )}

      </main>

    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;