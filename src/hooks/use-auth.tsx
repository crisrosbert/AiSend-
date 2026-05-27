"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  role: string | null;
  slug: string | null;
  business_name: string | null;
  org_id: string | null;
}

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url, role, slug, business_name, org_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("[AuthProvider] fetchProfile error:", error.message);
        return;
      }

      if (data) setProfile(data);
    } catch (err) {
      console.error("[AuthProvider] fetchProfile threw:", err);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    const safetyTimer = setTimeout(() => {
      if (mounted) {
        console.warn("[AuthProvider] getSession() timed out after 3s");
        setLoading(false);
      }
    }, 3000);

    const init = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) console.error("[AuthProvider] getSession error:", error.message);

        if (!mounted) return;
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          fetchProfile(currentUser.id);
        }
      } catch (err) {
        console.error("[AuthProvider] init threw:", err);
      } finally {
        if (mounted) setLoading(false);
        clearTimeout(safetyTimer);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        fetchProfile(currentUser.id);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    window.location.href = "/login";
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    await fetchProfile(user.id);
  }, [user?.id, fetchProfile]);

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      user: null,
      profile: null,
      loading: false,
      signOut: async () => { window.location.href = "/login"; },
      refreshProfile: async () => {},
    };
  }
  return ctx;
}