// src/contexts/AuthContext.tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { api } from '../lib/api';

export interface Profile {
  id: number;
  email: string;
  full_name: string;
  role: 'admin' | 'team_leader' | 'operator';
}

interface AuthUser {
  id: number;
  email: string;
}

interface AuthContextType {
  user: AuthUser | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Tarayıcı tarafında login bilgisini saklamak için key
const STORAGE_KEY = 'machine_dashboard_profile';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Sayfa yenilendiğinde daha önce login olan kullanıcıyı localStorage'dan yükle
  useEffect(() => {
    const init = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed: Profile = JSON.parse(stored);
          setProfile(parsed);
          setUser({ id: parsed.id, email: parsed.email });
        }
      } catch (err) {
        console.error('Error restoring auth from storage:', err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  // --- Giriş --- //
  const signIn = async (
    email: string,
    password: string
  ): Promise<{ error: Error | null }> => {
    try {
      // Backend: POST /auth/login  (body: { email, password })
      const loggedInProfile = await api.post<Profile>('/auth/login', {
        email,
        password,
      });

      setProfile(loggedInProfile);
      setUser({
        id: loggedInProfile.id,
        email: loggedInProfile.email,
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify(loggedInProfile));

      return { error: null };
    } catch (err: any) {
      console.error('signIn error:', err);
      const message =
        err instanceof Error
          ? err.message
          : 'Giriş yapılırken bir hata oluştu';
      return { error: new Error(message) };
    }
  };

  // --- Kayıt --- //
  const signUp = async (
    email: string,
    password: string,
    fullName: string
  ): Promise<{ error: Error | null }> => {
    try {
      // Backend: POST /profiles  (schemas.ProfileCreate)
      // Yeni kullanıcıları default olarak "operator" role ile oluşturuyoruz
      const newProfile = await api.post<Profile>('/profiles', {
        email,
        full_name: fullName,
        role: 'operator',
        password,
      });

      // İstersen otomatik login yapabiliriz:
      setProfile(newProfile);
      setUser({
        id: newProfile.id,
        email: newProfile.email,
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify(newProfile));

      return { error: null };
    } catch (err: any) {
      console.error('signUp error:', err);
      const message =
        err instanceof Error
          ? err.message
          : 'Kayıt olurken bir hata oluştu';
      return { error: new Error(message) };
    }
  };

  // --- Çıkış --- //
  const signOut = async () => {
    // Backend tarafında session olmadığı için sadece frontu temizliyoruz
    setUser(null);
    setProfile(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
