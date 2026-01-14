import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, pass);
    } catch (err) {
      setError('Credenciales incorrectas o error de conexión');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-slate-800 italic uppercase">BIPOKIDS</h1>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-2">Sistema de Gestión lOGÍSTICO</p>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-3 rounded-xl mb-4 text-center text-sm font-bold">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
            <input 
              type="email" 
              placeholder="USUARIO" 
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <input 
              type="password" 
              placeholder="CONTRASEÑA" 
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500"
              value={pass}
              onChange={e => setPass(e.target.value)}
            />
            <button className="w-full p-4 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
              Ingresar
            </button>
        </form>
      </div>
    </div>
  );
};

export default Login;