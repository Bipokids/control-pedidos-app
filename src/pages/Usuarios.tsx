import React, { useEffect, useState } from 'react';
import { db_realtime, firebaseConfig } from '../firebase/config';
import { ref, onValue, set, remove } from "firebase/database";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";

// Actualizamos la interfaz para incluir 'vendedor'
interface UserData {
    uid: string;
    email: string;
    role: 'admin' | 'produccion' | 'vendedor';
}

const Usuarios: React.FC = () => {
    const [users, setUsers] = useState<UserData[]>([]);
    
    // Formulario
    const [email, setEmail] = useState("");
    const [pass, setPass] = useState("");
    
    // Estado del rol actualizado para incluir 'vendedor'
    const [role, setRole] = useState<'admin' | 'produccion' | 'vendedor'>("produccion");
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // 1. Cargar Usuarios Existentes
    useEffect(() => {
        const unsubscribe = onValue(ref(db_realtime, 'users'), (snapshot) => {
            const data = snapshot.val() || {};
            const lista = Object.entries(data).map(([uid, val]: [string, any]) => ({
                uid,
                email: val.email,
                role: val.role
            }));
            setUsers(lista);
        });
        return () => unsubscribe();
    }, []);

    // 2. Crear Usuario (Sin desloguear al admin)
    const handleCrear = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
        const secondaryAuth = getAuth(secondaryApp);

        try {
            // A) Crear en Authentication
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
            const newUid = userCredential.user.uid;

            // B) Guardar rol en Realtime Database
            await set(ref(db_realtime, `users/${newUid}`), {
                email: email,
                role: role
            });

            setEmail("");
            setPass("");
            alert("✅ Usuario creado con éxito");

        } catch (err: any) {
            console.error(err);
            setError(err.message || "Error al crear usuario");
        } finally {
            await deleteApp(secondaryApp);
            setLoading(false);
        }
    };

    // 3. Eliminar Usuario
    const eliminarUsuario = async (uid: string, email: string) => {
        if (!window.confirm(`¿Eliminar acceso a ${email}? \nNota: Esto quita el rol, pero el usuario sigue existiendo en Auth.`)) return;
        
        try {
            await remove(ref(db_realtime, `users/${uid}`));
        } catch (e) {
            alert("Error al eliminar");
        }
    };

    // Helper para color de badge según rol (Estilo Neon)
    const getRoleBadgeStyle = (rol: string) => {
        switch(rol) {
            case 'admin': return 'bg-fuchsia-900/40 text-fuchsia-400 border-fuchsia-500/50 shadow-[0_0_10px_#d946ef]';
            case 'vendedor': return 'bg-pink-900/40 text-pink-400 border-pink-500/50 shadow-[0_0_10px_#ec4899]';
            default: return 'bg-cyan-900/40 text-cyan-400 border-cyan-500/50';
        }
    };

    return (
        <div className="min-h-screen relative font-sans text-cyan-50 bg-[#050b14] selection:bg-pink-500 selection:text-black pb-20 pt-10 px-4">
            
            {/* GRID DE FONDO DECORATIVO */}
            <div className="fixed inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #1e293b 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

            <div className="max-w-4xl mx-auto relative z-10">
                
                {/* ENCABEZADO */}
                <header className="mb-12 flex flex-col md:flex-row justify-between items-end gap-6 border-b border-pink-900/50 pb-6">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tighter mb-2 uppercase drop-shadow-[0_0_10px_rgba(236,72,153,0.5)]">
                            GESTIÓN DE <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-rose-600">USUARIOS</span>
                        </h1>
                        <p className="text-pink-500 font-mono text-xs uppercase tracking-[0.3em]">Control de Acceso y Roles</p>
                    </div>

                    <div className="hidden md:block text-right">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">System Date</p>
                        <p className="text-sm font-bold text-pink-400 font-mono">{new Date().toLocaleDateString()}</p>
                    </div>
                </header>

                {/* FORMULARIO DE CREACIÓN */}
                <div className="bg-[#0f172a]/60 backdrop-blur-md p-8 rounded-[2rem] shadow-xl border border-slate-800 mb-12 relative overflow-hidden group">
                    
                    {/* Decorative Top */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 via-rose-500 to-red-500"></div>

                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-6 font-mono flex items-center gap-2">
                        <span className="text-pink-500">+</span> Register New User
                    </h3>
                    
                    {error && <div className="bg-red-900/20 text-red-400 border border-red-500/30 p-4 rounded-xl mb-6 text-xs font-mono font-bold">{error}</div>}

                    <form onSubmit={handleCrear} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                        
                        <div className="md:col-span-1">
                            <label className="text-[10px] font-bold text-pink-400 uppercase block mb-2 font-mono tracking-wider">Email</label>
                            <input 
                                type="email" required
                                className="w-full p-4 bg-black/40 border border-slate-700 rounded-xl text-sm font-bold font-mono text-white outline-none focus:border-pink-500 focus:shadow-[0_0_15px_rgba(236,72,153,0.2)] transition-all placeholder-slate-600"
                                placeholder="user@domain.com"
                                value={email} onChange={e => setEmail(e.target.value)}
                            />
                        </div>

                        <div className="md:col-span-1">
                            <label className="text-[10px] font-bold text-pink-400 uppercase block mb-2 font-mono tracking-wider">Password</label>
                            <input 
                                type="text" required minLength={6}
                                className="w-full p-4 bg-black/40 border border-slate-700 rounded-xl text-sm font-bold font-mono text-white outline-none focus:border-pink-500 focus:shadow-[0_0_15px_rgba(236,72,153,0.2)] transition-all placeholder-slate-600"
                                placeholder="Min. 6 chars"
                                value={pass} onChange={e => setPass(e.target.value)}
                            />
                        </div>

                        <div className="md:col-span-1">
                            <label className="text-[10px] font-bold text-pink-400 uppercase block mb-2 font-mono tracking-wider">Rol</label>
                            <select 
                                className="w-full p-4 bg-black/40 border border-slate-700 rounded-xl text-sm font-bold font-mono text-white outline-none focus:border-pink-500 cursor-pointer appearance-none transition-all"
                                value={role} onChange={e => setRole(e.target.value as any)}
                            >
                                <option value="produccion">🏭 Production</option>
                                <option value="admin">🛡️ Administrator</option>
                                <option value="vendedor">🛍️ Sales / ML</option>
                            </select>
                        </div>

                        <div className="md:col-span-1">
                            <button 
                                disabled={loading}
                                className="w-full p-4 bg-pink-600 text-white rounded-xl font-black font-mono uppercase tracking-widest hover:bg-pink-500 transition-all shadow-[0_0_20px_rgba(236,72,153,0.4)] disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none active:scale-95"
                            >
                                {loading ? "PROCESSING..." : "CREAR USUARIO"}
                            </button>
                        </div>
                    </form>
                </div>

                {/* LISTA DE USUARIOS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {users.map(u => (
                        <div key={u.uid} className="bg-[#0f172a]/60 backdrop-blur-md p-6 rounded-2xl border border-slate-800 shadow-lg flex justify-between items-center group hover:border-pink-500/30 transition-all hover:-translate-y-1">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className={`text-[9px] font-black px-2 py-1 rounded border uppercase font-mono tracking-wide ${getRoleBadgeStyle(u.role)}`}>
                                        {u.role}
                                    </span>
                                    <span className="text-[9px] font-mono text-slate-500">UID: {u.uid.slice(0,5)}...</span>
                                </div>
                                <p className="font-bold text-slate-200 text-sm font-mono">{u.email}</p>
                            </div>
                            
                            <button 
                                onClick={() => eliminarUsuario(u.uid, u.email)}
                                className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 text-slate-500 hover:border-red-500 hover:text-red-500 hover:shadow-[0_0_15px_red] flex items-center justify-center transition-all font-bold text-lg group/btn"
                                title="Revoke Access"
                            >
                                <span className="group-hover/btn:scale-110 transition-transform">🗑️</span>
                            </button>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
};

export default Usuarios;