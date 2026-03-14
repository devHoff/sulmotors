import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

/**
 * Resolve the OAuth / password-reset redirect URL dynamically.
 *
 * In development  → http://localhost:5173/auth/callback
 * In production   → https://sulmotor.com/auth/callback
 *
 * Supabase requires this URL to be listed in
 *   Dashboard → Authentication → URL Configuration → Redirect URLs
 */
function getRedirectUrl(): string {
    // Allow an explicit override via env (useful for staging environments)
    const override = import.meta.env.VITE_AUTH_REDIRECT_URL as string | undefined;
    if (override) return override;

    // In production the origin will be the actual domain
    return `${window.location.origin}/auth/callback`;
}

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signInWithEmail: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, data?: { [key: string]: any }) => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check active sessions and sets the user
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Listen for changes on auth state (sign in, sign out, etc.)
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    /**
     * Google OAuth — requires Google provider enabled in Supabase Dashboard.
     * Supabase redirects back to /auth/callback after the user authenticates.
     */
    const signInWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: getRedirectUrl(),
                queryParams: {
                    // Force account-picker so users can switch Google accounts
                    prompt: 'select_account',
                },
            },
        });
        if (error) throw error;
    };

    /**
     * Password reset email.
     * Supabase sends an email with a link that redirects to /auth/callback
     * where the user can set a new password.
     *
     * ⚠️  Make sure to add the redirect URL to Supabase Dashboard:
     *      Authentication → URL Configuration → Redirect URLs
     *      Add both:
     *        - https://sulmotor.com/auth/callback
     *        - http://localhost:5173/auth/callback  (for local dev)
     */
    const resetPassword = async (email: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: getRedirectUrl(),
        });
        if (error) throw error;
    };

    const signInWithEmail = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
    };

    const signUp = async (email: string, password: string, data?: { [key: string]: any }) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data,
                // New users are redirected here after clicking the confirmation email
                emailRedirectTo: getRedirectUrl(),
            },
        });
        if (error) throw error;
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                session,
                loading,
                signInWithGoogle,
                signInWithEmail,
                signUp,
                resetPassword,
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
