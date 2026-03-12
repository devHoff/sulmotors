import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// ── Admin whitelist ───────────────────────────────────────────────────────────
export const ADMIN_EMAIL = 'bandasleonardo@gmail.com';
export const isAdminEmail = (email: string | undefined | null): boolean =>
    !!email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

// ── Context shape ─────────────────────────────────────────────────────────────
interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    isAdmin: boolean;
    signInWithGoogle: () => Promise<void>;
    signInWithEmail: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, data?: { [key: string]: any }) => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser]       = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
        if (error) throw error;
    };

    const signInWithEmail = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
    };

    const signUp = async (email: string, password: string, data?: { [key: string]: any }) => {
        const { error } = await supabase.auth.signUp({ email, password, options: { data } });
        if (error) throw error;
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    };

    const isAdmin = isAdminEmail(user?.email);

    return (
        <AuthContext.Provider value={{ user, session, loading, isAdmin, signInWithGoogle, signInWithEmail, signUp, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
    return context;
}
