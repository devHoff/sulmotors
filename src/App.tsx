import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import Layout from './components/Layout';
import Home from './pages/Home';
import Estoque from './pages/Estoque';
import AnunciarCarro from './pages/AnunciarCarro';
import EditarAnuncio from './pages/EditarAnuncio';
import MeusAnuncios from './pages/MeusAnuncios';
import MeusFavoritos from './pages/MeusFavoritos';
import MeuPerfil from './pages/MeuPerfil';
import Impulsionar from './pages/Impulsionar';
import ImpulsionarSucesso from './pages/ImpulsionarSucesso';
import DetalheCarro from './pages/DetalheCarro';
import SobreNos from './pages/SobreNos';
import Login from './pages/Login';
import Termos from './pages/Termos';
import Privacidade from './pages/Privacidade';
import SeusDireitos from './pages/SeusDireitos';
import Admin from './pages/Admin';
import Cookies from './pages/Cookies';
import AuthCallback from './pages/AuthCallback';
import NotFound from './pages/NotFound';
import DashboardPayments from './pages/DashboardPayments';
import CarrosCategoria from './pages/CarrosCategoria';

/**
 * OAuthHashInterceptor
 *
 * Supabase OAuth redirects back to the "Site URL" configured in the Dashboard.
 * If that URL is still set to http://localhost:3000 (or any root URL), the
 * access_token lands in window.location.hash on the home page instead of
 * reaching /auth/callback.
 *
 * This component runs on every page mount, detects the token in the hash,
 * and immediately redirects to /auth/callback (preserving the full hash) so
 * AuthCallback.tsx can process the session correctly.
 *
 * This makes Google login resilient to Site URL
 * misconfiguration in the Supabase Dashboard.
 */
function OAuthHashInterceptor() {
    const navigate = useNavigate();

    useEffect(() => {
        const hash = window.location.hash;
        // If we have auth tokens in the hash AND we are NOT already on the
        // callback page, redirect there immediately preserving the hash.
        if (
            (hash.includes('access_token=') || hash.includes('error=')) &&
            !window.location.pathname.startsWith('/auth/callback')
        ) {
            navigate('/auth/callback' + hash, { replace: true });
        }
    // Run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return null;
}

export default function App() {
    return (
        <>
            <ScrollToTop />
            {/* Intercept OAuth tokens that land on the wrong page */}
            <OAuthHashInterceptor />
            <Routes>
                {/* ── Admin: full-screen layout (no navbar/footer) ── */}
                <Route path="/admin" element={<Admin />} />

                {/*
                 * ── Auth callback: handles OAuth redirects and password-reset
                 *    links from Supabase emails. Must be outside Layout so the
                 *    navbar/footer are not shown while processing the token.
                 */}
                <Route path="/auth/callback" element={<AuthCallback />} />

                {/* ── All other pages: standard Layout ── */}
                <Route element={<Layout />}>
                    <Route path="/"                    element={<Home />} />
                    <Route path="/estoque"             element={<Estoque />} />
                    <Route path="/anunciar"            element={<AnunciarCarro />} />
                    <Route path="/editar/:id"          element={<EditarAnuncio />} />
                    <Route path="/meus-anuncios"       element={<MeusAnuncios />} />
                    <Route path="/favoritos"           element={<MeusFavoritos />} />
                    <Route path="/meu-perfil"          element={<MeuPerfil />} />
                    <Route path="/impulsionar/sucesso" element={<ImpulsionarSucesso />} />
                    <Route path="/impulsionar/:id"     element={<Impulsionar />} />
                    <Route path="/dashboard/payments"  element={<DashboardPayments />} />
                    {/* Vehicle detail — accepts both slug (/carro/ford-argo-2021-porto-alegre)
                        and legacy UUID (/carro/<uuid>); UUID is redirected → slug by the component */}
                    <Route path="/carro/:id"           element={<DetalheCarro />} />
                    <Route path="/sobre-nos"           element={<SobreNos />} />

                    {/* ── Programmatic SEO routes ── */}
                    {/* All used cars */}
                    <Route path="/carros-usados"                       element={<CarrosCategoria />} />
                    {/* Used cars by city */}
                    <Route path="/carros-usados/:cidade"               element={<CarrosCategoria />} />
                    {/* Cars by brand */}
                    <Route path="/carros/:marca"                       element={<CarrosCategoria />} />
                    {/* Cars by brand + model */}
                    <Route path="/carros/:marca/:modelo"               element={<CarrosCategoria />} />
                    {/* Price range landing pages */}
                    <Route path="/carros-ate-20-mil"                   element={<CarrosCategoria />} />
                    <Route path="/carros-ate-30-mil"                   element={<CarrosCategoria />} />
                    <Route path="/carros-ate-50-mil"                   element={<CarrosCategoria />} />
                    <Route path="/carros-ate-80-mil"                   element={<CarrosCategoria />} />
                    <Route path="/carros-ate-100-mil"                  element={<CarrosCategoria />} />
                    <Route path="/login"               element={<Login />} />
                    <Route path="/termos"              element={<Termos />} />
                    <Route path="/privacidade"         element={<Privacidade />} />
                    <Route path="/seus-direitos"       element={<SeusDireitos />} />
                    <Route path="/cookies"             element={<Cookies />} />

                    {/* Removed pages → redirect home */}
                    <Route path="/avaliar"     element={<Navigate to="/" replace />} />
                    <Route path="/alertas"     element={<Navigate to="/" replace />} />
                    <Route path="/toast-demo"  element={<Navigate to="/" replace />} />
                    <Route path="/performance" element={<Navigate to="/" replace />} />

                    {/* Explicit 404 route */}
                    <Route path="/404" element={<NotFound />} />

                    {/* Catch-all — any unmatched path renders the 404 page */}
                    <Route path="*" element={<NotFound />} />
                </Route>
            </Routes>
        </>
    );
}
