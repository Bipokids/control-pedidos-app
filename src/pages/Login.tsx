import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, pass);
      // No seteamos loading(false) aquí porque el componente se desmontará al redirigir
    } catch (err) {
      setError('Credenciales inválidas');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050b14] p-6 relative overflow-hidden font-sans selection:bg-cyan-500 selection:text-black">
      
      {/* FONDO DECORATIVO (Grid + Nebulosas) */}
      <div className="fixed inset-0 z-0 opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #1e293b 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse delay-1000"></div>

      {/* CARD PRINCIPAL */}
      <div className="bg-[#0f172a]/60 backdrop-blur-xl p-10 rounded-[2.5rem] shadow-[0_0_50px_rgba(6,182,212,0.15)] w-full max-w-sm border border-slate-800 relative z-10 animate-in fade-in zoom-in duration-500 group hover:border-cyan-500/30 transition-colors">
        
        {/* Decorative Top Line */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 rounded-t-[2.5rem]"></div>

        <div className="text-center mb-10">
          <h1 className="text-5xl font-black text-white italic tracking-tighter mb-2 drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
            BIPO<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-500">KIDS</span>
          </h1>
          <p className="text-cyan-600 font-mono font-bold text-[10px] uppercase tracking-[0.4em] glow-text">
            System Access v2.0
          </p>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500/50 text-red-400 p-4 rounded-xl mb-8 text-center text-xs font-mono font-bold animate-shake shadow-[0_0_20px_rgba(220,38,38,0.2)]">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative group/input">
                <span className="absolute left-4 top-4 text-lg text-slate-600 group-focus-within/input:text-cyan-400 transition-colors">✉️</span>
                <input 
                  type="email" 
                  required
                  placeholder="USER ID / EMAIL" 
                  className="w-full pl-12 pr-4 py-4 bg-black/40 border border-slate-700 rounded-xl font-mono text-sm font-bold outline-none focus:border-cyan-500 focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] text-cyan-50 placeholder-slate-600 transition-all uppercase tracking-wider"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
            </div>
            
            <div className="relative group/input">
                <span className="absolute left-4 top-4 text-lg text-slate-600 group-focus-within/input:text-violet-400 transition-colors">🔒</span>
                <input 
                  type="password" 
                  required
                  placeholder="PASSWORD" 
                  className="w-full pl-12 pr-4 py-4 bg-black/40 border border-slate-700 rounded-xl font-mono text-sm font-bold outline-none focus:border-violet-500 focus:shadow-[0_0_15px_rgba(139,92,246,0.3)] text-violet-50 placeholder-slate-600 transition-all tracking-wider"
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                />
            </div>

            <button 
              disabled={loading}
              className="w-full py-4 bg-cyan-600 text-black rounded-xl font-black font-mono uppercase tracking-[0.2em] hover:bg-cyan-400 hover:shadow-[0_0_30px_rgba(34,211,238,0.6)] transition-all active:scale-95 disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none flex justify-center items-center gap-3 mt-4 relative overflow-hidden group/btn"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300"></div>
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-slate-600 border-t-cyan-900 rounded-full animate-spin"></span>
                  AUTHENTICATING...
                </>
              ) : (
                <>
                  INGRESAR <span className="text-lg">➔</span>
                </>
              )}
            </button>
        </form>

        <div className="mt-10 text-center">
            <p className="text-[9px] text-slate-500 font-bold font-mono uppercase tracking-widest">
                Secured by Firebase • Nebula UI
            </p>
        </div>
      </div>
    </div>
  );
};

export default Login;