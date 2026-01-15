import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db_realtime } from '../firebase/config';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { ref, get } from 'firebase/database';

// 1. DEFINIMOS EL TIPO 'Role' PARA INCLUIR 'vendedor'
export type Role = 'admin' | 'produccion' | 'vendedor' | null;

interface AuthContextType {
  user: User | null;
  role: Role; // Usamos el tipo actualizado
  loading: boolean;
  login: (e: string, p: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// 👇 ESTE ES EL EXPORT QUE BUSCA APP.TSX
export const useAuth = () => useContext(AuthContext);

// 👇 ESTE ES EL OTRO EXPORT QUE BUSCA APP.TSX
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null); // Estado con el tipo actualizado
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true); // Bloqueamos UI mientras cargamos rol
      if (currentUser) {
        // Intentar leer el rol
        try {
            // Intentamos leer directamente el nodo 'role'
            let snapshot = await get(ref(db_realtime, `users/${currentUser.uid}/role`));
            
            if (snapshot.exists()) {
                setRole(snapshot.val() as Role);
            } else {
                // Fallback: Si no existe users/uid/role, buscamos en users/uid (objeto completo)
                // Esto es útil por si la estructura de guardado varía ligeramente
                snapshot = await get(ref(db_realtime, `users/${currentUser.uid}`));
                if (snapshot.exists() && snapshot.val().role) {
                    setRole(snapshot.val().role as Role);
                } else {
                    setRole(null); // Usuario sin rol definido
                }
            }
        } catch (error) {
            console.error("Error leyendo rol:", error);
            setRole(null);
        }
        setUser(currentUser);
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const logout = () => {
    signOut(auth);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};