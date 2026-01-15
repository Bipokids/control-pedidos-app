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
import Devoluciones from './pages/Devoluciones'; // <--- Importamos Devoluciones
import { AuthProvider, useAuth } from './context/AuthContext';

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  alertCount?: number;
}

// 🎨 COMPONENTE DE BOTÓN ACTUALIZADO CON ALERTA
const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon, label, alertCount }) => (
  <button 
    onClick={onClick}
    className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-300 group p-1 relative ${
      active 
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50 scale-105' 
        : 'text-slate-500 hover:bg-slate-800 hover:text-white'
    }`}
  >
    {/* Globo de Alerta Roja */}
    {alertCount && alertCount > 0 ? (
      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full shadow-md animate-pulse z-10 border-2 border-slate-900">
        {alertCount}
      </span>
    ) : null}

    <span className="text-xl mb-0.5">{icon}</span>
    <span className="text-[8px] font-bold uppercase tracking-tight text-center leading-none max-w-full break-words">
      {label}
    </span>
  </button>
);

const AppContent = () => {
  const { user, role, logout } = useAuth();
  const [paginaActual, setPaginaActual] = useState<string>('produccion');
  
  // Estado para la alerta de retiros
  const [retirosPendientes, setRetirosPendientes] = useState(0);

  // 1. Escuchar Soportes Retirados para la alerta en el menú (Solo Admin)
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

  // Lógica de títulos
  useEffect(() => {
    const nombres: Record<string, string> = {
      remitos: 'Logística',
      control_soportes: 'Admin Soportes',
      historial: 'Historial',
      estadisticas: 'Dashboard',
      retiros: 'Soportes Retirados',
      pagos: 'Control Pagos',
      devoluciones: 'Devoluciones', // <--- Titulo nuevo
      produccion: 'Producción',
      contador: 'Monitor',
      gestion_soportes: 'Taller',
      usuarios: 'Usuarios'
    };
    
    const titulo = nombres[paginaActual] || 'App';
    document.title = `${titulo} | Bipokids`;
  }, [paginaActual]);

  // Seguridad: Redirección inicial según rol
  useEffect(() => {
    // Si es admin entra a logística por defecto si estaba en producción
    if (role === 'admin' && paginaActual === 'produccion') setPaginaActual('remitos');
    
    // Si es vendedor entra a devoluciones por defecto
    if (role === 'vendedor' && paginaActual !== 'devoluciones') setPaginaActual('devoluciones');
    
    // Si es producción, lo mantenemos en producción (o contador/gestion)
    if (role === 'produccion' && !['produccion', 'contador', 'gestion_soportes'].includes(paginaActual)) {
        setPaginaActual('produccion');
    }
  }, [role]);

  if (!user) return <Login />;

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      
      {/* SIDEBAR DE NAVEGACIÓN */}
      <nav className="w-24 bg-slate-900 flex flex-col items-center py-6 gap-3 fixed h-full z-40 shadow-2xl border-r border-slate-800 overflow-y-auto scrollbar-hide">
        <div className="text-white font-black italic text-xl text-center mb-1 tracking-widest opacity-50">BK</div>
        
        {/* 1. GRUPO ADMIN */}
        {role === 'admin' && (
          <>
            <NavButton active={paginaActual === 'remitos'} onClick={() => setPaginaActual('remitos')} icon="🚚" label="Logística" />
            
            {/* BOTÓN SOPORTES CON ALERTA */}
            <NavButton 
                active={paginaActual === 'control_soportes' || paginaActual === 'retiros'} 
                onClick={() => setPaginaActual('control_soportes')} 
                icon="📋" 
                label="Soportes"
                alertCount={retirosPendientes} 
            />
            
            <NavButton active={paginaActual === 'historial'} onClick={() => setPaginaActual('historial')} icon="🗂️" label="Despachos" />
            <NavButton active={paginaActual === 'pagos'} onClick={() => setPaginaActual('pagos')} icon="💰" label="Pagos" />
            
            <div className="w-10 h-[1px] bg-slate-800 my-1"></div>
          </>
        )}

        {/* 2. GRUPO DEVOLUCIONES (Admin + Vendedores) */}
        {(role === 'admin' || role === 'vendedor') && (
            <NavButton active={paginaActual === 'devoluciones'} onClick={() => setPaginaActual('devoluciones')} icon="↩️" label="Devoluc." />
        )}

        {role === 'admin' && (
             <NavButton active={paginaActual === 'estadisticas'} onClick={() => setPaginaActual('estadisticas')} icon="📊" label="Métricas" />
        )}

        {/* Separador */}
        {(role === 'admin' || role === 'produccion') && <div className="w-10 h-[1px] bg-slate-800 my-1"></div>}

        {/* 3. GRUPO OPERATIVO (Visible para todos menos vendedor puro) */}
        {role !== 'vendedor' && (
            <>
                <NavButton active={paginaActual === 'contador'} onClick={() => setPaginaActual('contador')} icon="🔢" label="Contador" />
                <NavButton active={paginaActual === 'produccion'} onClick={() => setPaginaActual('produccion')} icon="⚙️" label="Producción" />
                <NavButton active={paginaActual === 'gestion_soportes'} onClick={() => setPaginaActual('gestion_soportes')} icon="🔧" label="Reparación" />
            </>
        )}

        {/* 4. GRUPO SISTEMA */}
        {role === 'admin' && (
           <>
             <div className="w-10 h-[1px] bg-slate-800 my-1"></div>
             <NavButton active={paginaActual === 'usuarios'} onClick={() => setPaginaActual('usuarios')} icon="👥" label="Usuarios" />
           </>
        )}

        {/* 5. CERRAR SESIÓN */}
        <div className="mt-auto pb-4">
             <button onClick={logout} className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors" title="Cerrar Sesión">
                ✕
             </button>
        </div>
      </nav>

      {/* ÁREA DE CONTENIDO */}
      <main className="flex-1 ml-24 transition-all duration-300">
        
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