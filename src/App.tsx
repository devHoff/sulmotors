import { Routes, Route } from 'react-router-dom';
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
import Avaliar from './pages/Avaliar';
import Alertas from './pages/Alertas';
import Admin from './pages/Admin';
import Cookies from './pages/Cookies';
import ToastDemo from './pages/ToastDemo';
import Performance from './pages/Performance';

export default function App() {
    return (
        <>
            <ScrollToTop />
            <Routes>
                {/* ── Admin: full-screen layout (no navbar/footer) ── */}
                <Route path="/admin" element={<Admin />} />

                {/* ── All other pages: standard Layout ── */}
                <Route element={<Layout />}>
                    <Route path="/"                    element={<Home />} />
                    <Route path="/estoque"             element={<Estoque />} />
                    <Route path="/anunciar"            element={<AnunciarCarro />} />
                    <Route path="/editar/:id"          element={<EditarAnuncio />} />
                    <Route path="/meus-anuncios"       element={<MeusAnuncios />} />
                    <Route path="/favoritos"           element={<MeusFavoritos />} />
                    <Route path="/meu-perfil"          element={<MeuPerfil />} />
                    <Route path="/impulsionar/:id"     element={<Impulsionar />} />
                    <Route path="/impulsionar/sucesso" element={<ImpulsionarSucesso />} />
                    <Route path="/carro/:id"           element={<DetalheCarro />} />
                    <Route path="/sobre-nos"           element={<SobreNos />} />
                    <Route path="/login"               element={<Login />} />
                    <Route path="/termos"              element={<Termos />} />
                    <Route path="/privacidade"         element={<Privacidade />} />
                    <Route path="/seus-direitos"       element={<SeusDireitos />} />
                    <Route path="/avaliar"             element={<Avaliar />} />
                    <Route path="/alertas"             element={<Alertas />} />
                    <Route path="/cookies"             element={<Cookies />} />
                    <Route path="/toast-demo"          element={<ToastDemo />} />
                    <Route path="/performance"         element={<Performance />} />
                </Route>
            </Routes>
        </>
    );
}
