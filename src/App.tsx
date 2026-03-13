import { Routes, Route, Navigate } from 'react-router-dom';
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

export default function App() {
    return (
        <>
            <ScrollToTop />
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
                    <Route path="/carro/:id"           element={<DetalheCarro />} />
                    <Route path="/sobre-nos"           element={<SobreNos />} />
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
