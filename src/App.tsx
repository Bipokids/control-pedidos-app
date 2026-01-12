import { useState, useEffect } from 'react';
import ControlDeRemitos from './pages/ControlDeRemitos';
import ControlSoportes from './pages/ControlSoportes';
import GestionSoportes from './pages/GestionSoportes';
import PantallaProduccion from './pages/PantallaProduccion';
import ContadorArmados from './pages/ContadorArmados';
import HistorialDespachos from './pages/HistorialDespachos';
import Login from './pages/Login';
import Usuarios from './pages/Usuarios';
import Estadisticas from './pages/Estadisticas'; // <--- 1. IMPORTAR
import { AuthProvider, useAuth } from './context/AuthContext';

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}

const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all duration-300 group relative ${
      active 
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50 scale-110' 
        : 'bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-white'
    }`}
  >
    {icon}
    <span className="absolute left-14 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-xl border border-slate-700">
      {label}
    </span>
  </button>
);

const AppContent = () => {
  const { user, role, logout } = useAuth();
  const [paginaActual, setPaginaActual] = useState<string>('produccion');

  // <--- 2. LÓGICA PARA CAMBIAR EL TÍTULO DE LA PESTAÑA --->
  useEffect(() => {
    const nombres: Record<string, string> = {
      remitos: 'Logística',
      control_soportes: 'Admin Soportes',
      historial: 'Historial',
      estadisticas: 'Dashboard',
      produccion: 'Producción',
      contador: 'Monitor',
      gestion_soportes: 'Taller',
      usuarios: 'Usuarios'
    };
    
    const titulo = nombres[paginaActual] || 'App';
    document.title = `${titulo} | Bipokids`;
  }, [paginaActual]);

  // Redirección de seguridad
  useEffect(() => {
    // Si es producción, lo sacamos de páginas admin (incluida estadísticas)
    if (role === 'produccion' && ['remitos', 'control_soportes', 'historial', 'usuarios', 'estadisticas'].includes(paginaActual)) {
      setPaginaActual('produccion');
    } else if (role === 'admin') {
       if(paginaActual === 'produccion') setPaginaActual('remitos');
    }
  }, [role]);

  if (!user) return <Login />;

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      
      {/* SIDEBAR DE NAVEGACIÓN */}
      <nav className="w-20 bg-slate-900 flex flex-col items-center py-8 gap-4 fixed h-full z-40 shadow-2xl border-r border-slate-800">
        <div className="text-white font-black italic text-xs text-center mb-6 tracking-widest opacity-50">APP</div>
        
        {/* 1. GRUPO ADMIN: Logística, Soportes, Historial, Estadísticas */}
        {role === 'admin' && (
          <>
            <NavButton active={paginaActual === 'remitos'} onClick={() => setPaginaActual('remitos')} icon="🚚" label="Logística" />
            <NavButton active={paginaActual === 'control_soportes'} onClick={() => setPaginaActual('control_soportes')} icon="🖥️" label="Admin Soportes" />
            <NavButton active={paginaActual === 'historial'} onClick={() => setPaginaActual('historial')} icon="📜" label="Historial" />
            <NavButton active={paginaActual === 'estadisticas'} onClick={() => setPaginaActual('estadisticas')} icon="📈" label="Estadísticas" />
          </>
        )}

        {/* Separador */}
        {role === 'admin' && <div className="w-8 h-[1px] bg-slate-800 my-1"></div>}

        {/* 2. GRUPO OPERATIVO: Contador, Producción, Gestión */}
        <NavButton active={paginaActual === 'contador'} onClick={() => setPaginaActual('contador')} icon="📊" label="Contador" />
        <NavButton active={paginaActual === 'produccion'} onClick={() => setPaginaActual('produccion')} icon="🏭" label="Producción" />
        <NavButton active={paginaActual === 'gestion_soportes'} onClick={() => setPaginaActual('gestion_soportes')} icon="🛠️" label="Gestión Técnica" />

        {/* 3. GRUPO SISTEMA: Usuarios */}
        {role === 'admin' && (
           <>
             <div className="w-8 h-[1px] bg-slate-800 my-1"></div>
             <NavButton active={paginaActual === 'usuarios'} onClick={() => setPaginaActual('usuarios')} icon="👥" label="Usuarios" />
           </>
        )}

        {/* 4. CERRAR SESIÓN */}
        <div className="mt-auto">
             <button onClick={logout} className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors" title="Cerrar Sesión">
                ✕
             </button>
        </div>
      </nav>

      {/* ÁREA DE CONTENIDO */}
      <main className="flex-1 ml-20 transition-all duration-300">
        {paginaActual === 'remitos' && role === 'admin' && <ControlDeRemitos />}
        {paginaActual === 'control_soportes' && role === 'admin' && <ControlSoportes />}
        {paginaActual === 'historial' && role === 'admin' && <HistorialDespachos />}
        {paginaActual === 'estadisticas' && role === 'admin' && <Estadisticas />} {/* <--- RENDERIZAR */}
        
        {paginaActual === 'contador' && <ContadorArmados />}
        {paginaActual === 'produccion' && <PantallaProduccion />}
        {paginaActual === 'gestion_soportes' && <GestionSoportes />}
        
        {paginaActual === 'usuarios' && role === 'admin' && <Usuarios />}
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