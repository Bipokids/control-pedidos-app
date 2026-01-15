import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); // Estado para feedback visual

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, pass);
      // No seteamos loading(false) aquí porque el componente se desmontará al redirigir
    } catch (err) {
      setError('Credenciales incorrectas o error de conexión');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6 relative overflow-hidden">
      
      {/* Fondo decorativo sutil */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-fuchsia-600/20 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="bg-white/95 backdrop-blur-xl p-10 rounded-[2.5rem] shadow-2xl w-full max-w-sm border border-slate-100 relative z-10 animate-in fade-in zoom-in duration-300">
        
        <div className="text-center mb-10">
          
          <h1 className="text-4xl font-black text-slate-800 italic uppercase tracking-tighter mb-1">
            BIPO<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-fuchsia-600">KIDS</span>
          </h1>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.3em]">
            Sistema de Gestión Integral
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-xl mb-6 text-center text-xs font-bold animate-pulse">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="relative group">
                <span className="absolute left-4 top-3.5 text-lg grayscale group-focus-within:grayscale-0 transition-all">✉️</span>
                <input 
                  type="email" 
                  required
                  placeholder="USUARIO / EMAIL" 
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-xs outline-none focus:border-indigo-500 text-slate-700 transition-all placeholder:text-slate-300"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
            </div>
            
            <div className="relative group">
                <span className="absolute left-4 top-3.5 text-lg grayscale group-focus-within:grayscale-0 transition-all">🔒</span>
                <input 
                  type="password" 
                  required
                  placeholder="CONTRASEÑA" 
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-xs outline-none focus:border-indigo-500 text-slate-700 transition-all placeholder:text-slate-300"
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                />
            </div>

            <button 
              disabled={loading}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200 active:scale-95 disabled:bg-slate-400 flex justify-center items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Ingresando...
                </>
              ) : (
                "Iniciar Sesión"
              )}
            </button>
        </form>

        <div className="mt-8 text-center">
            <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">
                v2.0.0 • Secure Access
            </p>
        </div>
      </div>
    </div>
  );
};

export default Login;