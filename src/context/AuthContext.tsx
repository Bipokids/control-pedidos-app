import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db_realtime } from '../firebase/config';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { ref, get } from 'firebase/database';

interface AuthContextType {
  user: User | null;
  role: 'admin' | 'produccion' | null;
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
  const [role, setRole] = useState<'admin' | 'produccion' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        // Intentar leer el rol
        try {
            const snapshot = await get(ref(db_realtime, `users/${currentUser.uid}/role`));
            if (snapshot.exists()) {
                setRole(snapshot.val());
            } else {
                setRole(null); // Usuario sin rol definido
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
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};