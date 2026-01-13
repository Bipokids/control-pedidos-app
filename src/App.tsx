import { useState, useEffect } from 'react';
import ControlDeRemitos from './pages/ControlDeRemitos';
import ControlSoportes from './pages/ControlSoportes';
import GestionSoportes from './pages/GestionSoportes';
import PantallaProduccion from './pages/PantallaProduccion';
import ContadorArmados from './pages/ContadorArmados';
import HistorialDespachos from './pages/HistorialDespachos';
import Login from './pages/Login';
import Usuarios from './pages/Usuarios';
import Estadisticas from './pages/Estadisticas'; 
import { AuthProvider, useAuth } from './context/AuthContext';

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}

// 🎨 COMPONENTE DE BOTÓN ACTUALIZADO
// Ahora muestra el texto debajo del icono
const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-300 group p-1 ${
      active 
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50 scale-105' 
        : 'text-slate-500 hover:bg-slate-800 hover:text-white'
    }`}
  >
    <span className="text-xl mb-0.5">{icon}</span>
    <span className="text-[8px] font-bold uppercase tracking-tight text-center leading-none max-w-full break-words">
      {label}
    </span>
  </button>
);

const AppContent = () => {
  const { user, role, logout } = useAuth();
  const [paginaActual, setPaginaActual] = useState<string>('produccion');

  // LÓGICA PARA CAMBIAR EL TÍTULO DE LA PESTAÑA
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
      <nav className="w-24 bg-slate-900 flex flex-col items-center py-6 gap-3 fixed h-full z-40 shadow-2xl border-r border-slate-800 overflow-y-auto scrollbar-hide">
        
        {/* 1. GRUPO ADMIN: Logística, Soportes, Historial, Estadísticas */}
        {role === 'admin' && (
          <>
            <NavButton active={paginaActual === 'remitos'} onClick={() => setPaginaActual('remitos')} icon="🚚" label="Logística" />
            <NavButton active={paginaActual === 'control_soportes'} onClick={() => setPaginaActual('control_soportes')} icon="📋" label="Soportes" />
            <NavButton active={paginaActual === 'historial'} onClick={() => setPaginaActual('historial')} icon="🗂️" label="Despachos" />
            <NavButton active={paginaActual === 'estadisticas'} onClick={() => setPaginaActual('estadisticas')} icon="📊" label="Métricas" />
          </>
        )}

        {/* Separador */}
        {role === 'admin' && <div className="w-10 h-[1px] bg-slate-800 my-1"></div>}

        {/* 2. GRUPO OPERATIVO: Contador, Producción, Gestión */}
        <NavButton active={paginaActual === 'contador'} onClick={() => setPaginaActual('contador')} icon="🔢" label="Contador" />
        <NavButton active={paginaActual === 'produccion'} onClick={() => setPaginaActual('produccion')} icon="⚙️" label="Producción" />
        <NavButton active={paginaActual === 'gestion_soportes'} onClick={() => setPaginaActual('gestion_soportes')} icon="🔧" label="Reparación" />

        {/* 3. GRUPO SISTEMA: Usuarios */}
        {role === 'admin' && (
           <>
             <div className="w-10 h-[1px] bg-slate-800 my-1"></div>
             <NavButton active={paginaActual === 'usuarios'} onClick={() => setPaginaActual('usuarios')} icon="👥" label="Usuarios" />
           </>
        )}

        {/* 4. CERRAR SESIÓN */}
        <div className="mt-auto pb-4">
             <button onClick={logout} className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors" title="Cerrar Sesión">
                ✕
             </button>
        </div>
      </nav>

      {/* ÁREA DE CONTENIDO */}
      {/* Ajusté el margen izquierdo (ml-24) porque la barra ahora es un poco más ancha para que entre el texto */}
      <main className="flex-1 ml-24 transition-all duration-300">
        {paginaActual === 'remitos' && role === 'admin' && <ControlDeRemitos />}
        {paginaActual === 'control_soportes' && role === 'admin' && <ControlSoportes />}
        {paginaActual === 'historial' && role === 'admin' && <HistorialDespachos />}
        {paginaActual === 'estadisticas' && role === 'admin' && <Estadisticas />}
        
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