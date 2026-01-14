import React, { useEffect, useState } from 'react';
import { db_realtime, firebaseConfig } from '../firebase/config';
import { ref, onValue, set, remove } from "firebase/database";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";

interface UserData {
    uid: string;
    email: string;
    role: 'admin' | 'produccion';
}

const Usuarios: React.FC = () => {
    const [users, setUsers] = useState<UserData[]>([]);
    
    // Formulario
    const [email, setEmail] = useState("");
    const [pass, setPass] = useState("");
    const [role, setRole] = useState<'admin' | 'produccion'>("produccion");
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

        // Inicializamos una app secundaria temporal para no cerrar sesión al admin
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

            // Limpiar form
            setEmail("");
            setPass("");
            alert("✅ Usuario creado con éxito");

        } catch (err: any) {
            console.error(err);
            setError(err.message || "Error al crear usuario");
        } finally {
            // Importante: Eliminar la app secundaria para liberar memoria
            await deleteApp(secondaryApp);
            setLoading(false);
        }
    };

    // 3. Eliminar Usuario (Solo de la DB y acceso visual)
    const eliminarUsuario = async (uid: string, email: string) => {
        if (!window.confirm(`¿Eliminar acceso a ${email}? \nNota: Esto quita el rol, pero el usuario sigue existiendo en Auth.`)) return;
        
        try {
            await remove(ref(db_realtime, `users/${uid}`));
        } catch (e) {
            alert("Error al eliminar");
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 font-sans min-h-screen bg-slate-50">
            
            {/* ENCABEZADO UNIFICADO */}
            <header className="mb-12 flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">
                        Gestión de <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-rose-600">Usuarios</span>
                    </h1>
                    <p className="text-slate-500 font-medium text-sm">Administración de roles y permisos de acceso.</p>
                </div>

                <div className="hidden md:block text-right">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Fecha Actual</p>
                    <p className="text-sm font-bold text-slate-700">{new Date().toLocaleDateString()}</p>
                </div>
            </header>

            {/* FORMULARIO DE CREACIÓN */}
            <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100 mb-10">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Crear Nuevo Usuario</h3>
                
                {error && <div className="bg-red-100 text-red-700 p-3 rounded-xl mb-4 text-xs font-bold">{error}</div>}

                <form onSubmit={handleCrear} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    
                    <div className="md:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Email</label>
                        <input 
                            type="email" required
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-pink-500"
                            value={email} onChange={e => setEmail(e.target.value)}
                        />
                    </div>

                    <div className="md:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Contraseña</label>
                        <input 
                            type="text" required minLength={6}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-pink-500"
                            placeholder="Mín. 6 caracteres"
                            value={pass} onChange={e => setPass(e.target.value)}
                        />
                    </div>

                    <div className="md:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Rol</label>
                        <select 
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-pink-500"
                            value={role} onChange={e => setRole(e.target.value as any)}
                        >
                            <option value="produccion">🏭 Producción</option>
                            <option value="admin">🛡️ Admin</option>
                        </select>
                    </div>

                    <div className="md:col-span-1">
                        <button 
                            disabled={loading}
                            className="w-full p-3 bg-pink-600 text-white rounded-xl font-black uppercase tracking-wider hover:bg-pink-700 transition-colors shadow-lg shadow-pink-200 disabled:bg-slate-300"
                        >
                            {loading ? "Creando..." : "+ Crear"}
                        </button>
                    </div>
                </form>
            </div>

            {/* LISTA DE USUARIOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {users.map(u => (
                    <div key={u.uid} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center group hover:shadow-md transition-all">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                                    u.role === 'admin' 
                                    ? 'bg-purple-100 text-purple-700' 
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                    {u.role}
                                </span>
                                <span className="text-[9px] font-mono text-slate-300">UID: {u.uid.slice(0,5)}...</span>
                            </div>
                            <p className="font-bold text-slate-700">{u.email}</p>
                        </div>
                        
                        <button 
                            onClick={() => eliminarUsuario(u.uid, u.email)}
                            className="w-10 h-10 rounded-xl bg-red-50 text-red-300 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors font-bold text-lg"
                            title="Eliminar Acceso"
                        >
                            🗑️
                        </button>
                    </div>
                ))}
            </div>

        </div>
    );
};

export default Usuarios;