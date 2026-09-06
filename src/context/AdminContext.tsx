import React, { createContext, useContext, useEffect, useState } from "react";
import { fetchProfile, Profile } from "../lib/profileApi";
import { useAuth } from "./AuthContext";

export type ViewingUser = { id: string; name: string };

type AdminContextValue = {
  isAdmin: boolean;
  loadingRole: boolean;
  profile: Profile | null; // perfil do usuário logado (não o que está sendo visualizado)
  viewingUser: ViewingUser | null;
  effectiveUserId: string | null; // usuário cujos dados as telas devem ler/escrever
  startViewingUser: (user: ViewingUser) => void;
  stopViewingUser: () => void;
};

const AdminContext = createContext<AdminContextValue | undefined>(undefined);

// Resolve se o usuário logado é super admin (profiles.role) e mantém o estado
// de "visualizando como" outro usuário — os demais providers (treinos, dieta,
// água, peso) leem effectiveUserId em vez do session.user.id direto, então
// trocar de usuário aqui propaga pro app inteiro sem tocar em cada tela.
export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);
  const [viewingUser, setViewingUser] = useState<ViewingUser | null>(null);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setLoadingRole(false);
      return;
    }
    let cancelled = false;
    setLoadingRole(true);
    fetchProfile(session.user.id)
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((err) => console.warn("Falha ao carregar papel do usuário:", err.message))
      .finally(() => {
        if (!cancelled) setLoadingRole(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  // Sair da sessão (ou trocar de usuário) sempre encerra o modo "visualizando como"
  useEffect(() => {
    setViewingUser(null);
  }, [session?.user.id]);

  const isAdmin = profile?.role === "admin";
  const effectiveUserId = viewingUser?.id ?? session?.user.id ?? null;

  function startViewingUser(user: ViewingUser) {
    if (!isAdmin) return;
    setViewingUser(user);
  }

  function stopViewingUser() {
    setViewingUser(null);
  }

  return (
    <AdminContext.Provider
      value={{
        isAdmin,
        loadingRole,
        profile,
        viewingUser,
        effectiveUserId,
        startViewingUser,
        stopViewingUser,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin deve ser usado dentro de um AdminProvider");
  return ctx;
}
