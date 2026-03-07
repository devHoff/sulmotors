import { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'pt-BR' | 'en' | 'es';

export interface Translations {
    // Navbar
    nav_home: string;
    nav_inventory: string;
    nav_about: string;
    nav_advertise: string;
    nav_enter: string;
    nav_account: string;
    nav_profile: string;
    nav_favorites: string;
    nav_my_ads: string;
    nav_sign_out: string;

    // Home
    home_badge: string;
    home_hero_title1: string;
    home_hero_title2: string;
    home_hero_title3: string;
    home_hero_sub: string;
    home_search_placeholder: string;
    home_search_btn: string;
    home_stats_vehicles: string;
    home_stats_clients: string;
    home_stats_stores: string;
    home_stats_market: string;
    home_featured_label: string;
    home_featured_title: string;
    home_featured_accent: string;
    home_see_all: string;
    home_see_all_vehicles: string;
    home_no_featured: string;
    home_partners_label: string;
    home_partners_title: string;
    home_why_label: string;
    home_why_title: string;
    home_why_accent: string;
    home_why_sub: string;
    home_security_title: string;
    home_security_desc: string;
    home_price_title: string;
    home_price_desc: string;
    home_support_title: string;
    home_support_desc: string;
    home_categories_title: string;
    home_categories_sub: string;
    home_cta_badge: string;
    home_cta_title: string;
    home_cta_accent: string;
    home_cta_sub: string;
    home_cta_btn: string;
    home_cta_explore: string;
    home_add_store: string;

    // Estoque
    estoque_vehicles_found: string;
    estoque_title: string;
    estoque_subtitle: string;
    estoque_search_placeholder: string;
    estoque_filters: string;
    estoque_filter_brand: string;
    estoque_all_brands: string;
    estoque_max_price: string;
    estoque_min_year: string;
    estoque_clear: string;
    estoque_loading: string;
    estoque_not_found: string;
    estoque_not_found_sub: string;
    estoque_clear_filters: string;

    // DetalheCarro
    detail_back: string;
    detail_price: string;
    detail_specs: string;
    detail_year: string;
    detail_km: string;
    detail_fuel: string;
    detail_gearbox: string;
    detail_color: string;
    detail_city: string;
    detail_trade: string;
    detail_trade_yes: string;
    detail_trade_no: string;
    detail_seller: string;
    detail_available: string;
    detail_vehicle_value: string;
    detail_accepts_trade: string;
    detail_whatsapp: string;
    detail_safety: string;
    detail_see_more: string;
    detail_description: string;
    detail_not_found: string;
    detail_back_inventory: string;

    // Login
    login_welcome: string;
    login_create: string;
    login_login_sub: string;
    login_signup_sub: string;
    login_enter: string;
    login_register: string;
    login_full_name: string;
    login_phone: string;
    login_email: string;
    login_password: string;
    login_login_btn: string;
    login_signup_btn: string;
    login_no_account: string;
    login_free_signup: string;
    login_has_account: string;
    login_do_login: string;

    // Stores
    stores_add_title: string;
    stores_add_body: string;
    stores_whatsapp: string;
    stores_email: string;
    stores_close: string;
    stores_see_all: string;
}

const ptBR: Translations = {
    nav_home: 'Início',
    nav_inventory: 'Estoque',
    nav_about: 'Sobre Nós',
    nav_advertise: 'Anunciar Carro',
    nav_enter: 'Entrar',
    nav_account: 'Conta',
    nav_profile: 'Meu Perfil',
    nav_favorites: 'Meus Favoritos',
    nav_my_ads: 'Meus Anúncios',
    nav_sign_out: 'Sair',

    home_badge: 'Marketplace #1 do Sul',
    home_hero_title1: 'Encontre o',
    home_hero_title2: 'carro perfeito',
    home_hero_title3: 'para você.',
    home_hero_sub: 'Milhares de veículos seminovos e 0km com os melhores preços. Compra segura e garantida.',
    home_search_placeholder: 'Marca, modelo ou palavra-chave...',
    home_search_btn: 'Buscar',
    home_stats_vehicles: 'Veículos disponíveis',
    home_stats_clients: 'Clientes satisfeitos',
    home_stats_stores: 'Lojas parceiras',
    home_stats_market: 'No mercado',
    home_featured_label: 'Selecionados para você',
    home_featured_title: 'Veículos em ',
    home_featured_accent: 'destaque',
    home_see_all: 'Ver todos',
    home_see_all_vehicles: 'Ver todos os veículos',
    home_no_featured: 'Nenhum veículo em destaque no momento.',
    home_partners_label: 'Parceiros verificados',
    home_partners_title: 'Lojas em destaque',
    home_why_label: 'Diferenciais',
    home_why_title: 'Por que escolher a ',
    home_why_accent: 'SulMotors?',
    home_why_sub: 'Tecnologia, segurança e a melhor experiência em compra e venda de veículos.',
    home_security_title: 'Segurança Garantida',
    home_security_desc: 'Todos os anúncios são verificados. Compre com total tranquilidade.',
    home_price_title: 'Melhores Preços',
    home_price_desc: 'Preços competitivos e transparentes, sem surpresas na hora da compra.',
    home_support_title: 'Suporte Dedicado',
    home_support_desc: 'Nossa equipe está disponível para te auxiliar em cada etapa.',
    home_categories_title: 'Explore por categoria',
    home_categories_sub: 'Encontre o veículo ideal para o seu estilo de vida',
    home_cta_badge: 'Grátis para anunciar',
    home_cta_title: 'Quer vender seu',
    home_cta_accent: 'carro mais rápido?',
    home_cta_sub: 'Anuncie gratuitamente e alcance milhares de compradores interessados na sua região.',
    home_cta_btn: 'Anunciar Agora — Grátis',
    home_cta_explore: 'Explorar estoque',
    home_add_store: 'Adicione sua loja aqui',

    estoque_vehicles_found: 'veículos encontrados',
    estoque_title: 'Estoque completo',
    estoque_subtitle: 'Encontre o carro ideal para você',
    estoque_search_placeholder: 'Buscar marca ou modelo...',
    estoque_filters: 'Filtros',
    estoque_filter_brand: 'Marca',
    estoque_all_brands: 'Todas',
    estoque_max_price: 'Preço máximo',
    estoque_min_year: 'Ano mínimo',
    estoque_clear: 'Limpar',
    estoque_loading: 'Carregando veículos...',
    estoque_not_found: 'Nenhum veículo encontrado',
    estoque_not_found_sub: 'Tente ajustar seus filtros de busca.',
    estoque_clear_filters: 'Limpar filtros',

    detail_back: 'Estoque',
    detail_price: 'Preço',
    detail_specs: 'Especificações',
    detail_year: 'Ano',
    detail_km: 'Quilometragem',
    detail_fuel: 'Combustível',
    detail_gearbox: 'Câmbio',
    detail_color: 'Cor',
    detail_city: 'Cidade',
    detail_trade: 'Aceita troca',
    detail_trade_yes: 'Sim',
    detail_trade_no: 'Não',
    detail_seller: 'Vendedor',
    detail_available: 'Disponível',
    detail_vehicle_value: 'Valor do veículo',
    detail_accepts_trade: 'Aceita troca',
    detail_whatsapp: 'Chamar no WhatsApp',
    detail_safety: '🔒 Negocie com segurança. Nunca faça pagamentos antecipados.',
    detail_see_more: 'Ver mais carros',
    detail_description: 'Descrição do vendedor',
    detail_not_found: 'Veículo não encontrado.',
    detail_back_inventory: 'Voltar ao estoque',

    login_welcome: 'Bem-vindo de volta',
    login_create: 'Crie sua conta',
    login_login_sub: 'Entre para gerenciar seus anúncios e favoritos',
    login_signup_sub: 'Comece a anunciar seus veículos gratuitamente',
    login_enter: 'Entrar',
    login_register: 'Cadastrar',
    login_full_name: 'Nome completo *',
    login_phone: 'Telefone',
    login_email: 'Email *',
    login_password: 'Senha *',
    login_login_btn: 'Entrar na conta',
    login_signup_btn: 'Criar conta grátis',
    login_no_account: 'Não tem uma conta?',
    login_free_signup: 'Cadastre-se grátis',
    login_has_account: 'Já tem uma conta?',
    login_do_login: 'Fazer login',

    stores_add_title: 'Anuncie sua loja',
    stores_add_body: 'Quer ter sua loja em destaque para milhares de compradores? Entre em contato com nossa equipe e saiba como fazer parte da SulMotors.',
    stores_whatsapp: 'Falar no WhatsApp',
    stores_email: 'Enviar e-mail',
    stores_close: 'Fechar',
    stores_see_all: 'Ver todas',
};

const en: Translations = {
    nav_home: 'Home',
    nav_inventory: 'Inventory',
    nav_about: 'About Us',
    nav_advertise: 'List Your Car',
    nav_enter: 'Sign In',
    nav_account: 'Account',
    nav_profile: 'My Profile',
    nav_favorites: 'My Favorites',
    nav_my_ads: 'My Listings',
    nav_sign_out: 'Sign Out',

    home_badge: 'South Brazil\'s #1 Marketplace',
    home_hero_title1: 'Find your',
    home_hero_title2: 'perfect car',
    home_hero_title3: 'today.',
    home_hero_sub: 'Thousands of used and brand-new vehicles at the best prices. Safe and guaranteed purchase.',
    home_search_placeholder: 'Brand, model or keyword...',
    home_search_btn: 'Search',
    home_stats_vehicles: 'Available vehicles',
    home_stats_clients: 'Satisfied clients',
    home_stats_stores: 'Partner stores',
    home_stats_market: 'In the market',
    home_featured_label: 'Selected for you',
    home_featured_title: 'Featured ',
    home_featured_accent: 'vehicles',
    home_see_all: 'See all',
    home_see_all_vehicles: 'See all vehicles',
    home_no_featured: 'No featured vehicles at the moment.',
    home_partners_label: 'Verified partners',
    home_partners_title: 'Featured stores',
    home_why_label: 'Why us',
    home_why_title: 'Why choose ',
    home_why_accent: 'SulMotors?',
    home_why_sub: 'Technology, security and the best experience in buying and selling vehicles.',
    home_security_title: 'Guaranteed Security',
    home_security_desc: 'All listings are verified. Buy with total peace of mind.',
    home_price_title: 'Best Prices',
    home_price_desc: 'Competitive and transparent prices, no surprises at checkout.',
    home_support_title: 'Dedicated Support',
    home_support_desc: 'Our team is available to assist you at every step.',
    home_categories_title: 'Browse by category',
    home_categories_sub: 'Find the perfect vehicle for your lifestyle',
    home_cta_badge: 'Free to list',
    home_cta_title: 'Want to sell your',
    home_cta_accent: 'car faster?',
    home_cta_sub: 'List for free and reach thousands of interested buyers in your region.',
    home_cta_btn: 'List Now — Free',
    home_cta_explore: 'Browse inventory',
    home_add_store: 'Add your store here',

    estoque_vehicles_found: 'vehicles found',
    estoque_title: 'Full inventory',
    estoque_subtitle: 'Find the ideal car for you',
    estoque_search_placeholder: 'Search brand or model...',
    estoque_filters: 'Filters',
    estoque_filter_brand: 'Brand',
    estoque_all_brands: 'All',
    estoque_max_price: 'Max price',
    estoque_min_year: 'Min year',
    estoque_clear: 'Clear',
    estoque_loading: 'Loading vehicles...',
    estoque_not_found: 'No vehicles found',
    estoque_not_found_sub: 'Try adjusting your search filters.',
    estoque_clear_filters: 'Clear filters',

    detail_back: 'Inventory',
    detail_price: 'Price',
    detail_specs: 'Specifications',
    detail_year: 'Year',
    detail_km: 'Mileage',
    detail_fuel: 'Fuel',
    detail_gearbox: 'Gearbox',
    detail_color: 'Color',
    detail_city: 'City',
    detail_trade: 'Accepts trade',
    detail_trade_yes: 'Yes',
    detail_trade_no: 'No',
    detail_seller: 'Seller',
    detail_available: 'Available',
    detail_vehicle_value: 'Vehicle value',
    detail_accepts_trade: 'Accepts trade-in',
    detail_whatsapp: 'Chat on WhatsApp',
    detail_safety: '🔒 Negotiate safely. Never make advance payments.',
    detail_see_more: 'See more cars',
    detail_description: 'Seller description',
    detail_not_found: 'Vehicle not found.',
    detail_back_inventory: 'Back to inventory',

    login_welcome: 'Welcome back',
    login_create: 'Create your account',
    login_login_sub: 'Sign in to manage your listings and favorites',
    login_signup_sub: 'Start listing your vehicles for free',
    login_enter: 'Sign In',
    login_register: 'Register',
    login_full_name: 'Full name *',
    login_phone: 'Phone',
    login_email: 'Email *',
    login_password: 'Password *',
    login_login_btn: 'Sign in',
    login_signup_btn: 'Create free account',
    login_no_account: 'Don\'t have an account?',
    login_free_signup: 'Sign up for free',
    login_has_account: 'Already have an account?',
    login_do_login: 'Log in',

    stores_add_title: 'List your store',
    stores_add_body: 'Want your store featured to thousands of buyers? Contact our team and find out how to join SulMotors.',
    stores_whatsapp: 'Chat on WhatsApp',
    stores_email: 'Send email',
    stores_close: 'Close',
    stores_see_all: 'See all',
};

const es: Translations = {
    nav_home: 'Inicio',
    nav_inventory: 'Inventario',
    nav_about: 'Sobre Nosotros',
    nav_advertise: 'Publicar Auto',
    nav_enter: 'Ingresar',
    nav_account: 'Cuenta',
    nav_profile: 'Mi Perfil',
    nav_favorites: 'Mis Favoritos',
    nav_my_ads: 'Mis Anuncios',
    nav_sign_out: 'Salir',

    home_badge: 'Marketplace #1 del Sur',
    home_hero_title1: 'Encuentra el',
    home_hero_title2: 'auto perfecto',
    home_hero_title3: 'para ti.',
    home_hero_sub: 'Miles de vehículos usados y 0km a los mejores precios. Compra segura y garantizada.',
    home_search_placeholder: 'Marca, modelo o palabra clave...',
    home_search_btn: 'Buscar',
    home_stats_vehicles: 'Vehículos disponibles',
    home_stats_clients: 'Clientes satisfechos',
    home_stats_stores: 'Tiendas asociadas',
    home_stats_market: 'En el mercado',
    home_featured_label: 'Seleccionados para ti',
    home_featured_title: 'Vehículos ',
    home_featured_accent: 'destacados',
    home_see_all: 'Ver todos',
    home_see_all_vehicles: 'Ver todos los vehículos',
    home_no_featured: 'No hay vehículos destacados en este momento.',
    home_partners_label: 'Socios verificados',
    home_partners_title: 'Tiendas destacadas',
    home_why_label: 'Diferencial',
    home_why_title: '¿Por qué elegir ',
    home_why_accent: 'SulMotors?',
    home_why_sub: 'Tecnología, seguridad y la mejor experiencia en compra y venta de vehículos.',
    home_security_title: 'Seguridad Garantizada',
    home_security_desc: 'Todos los anuncios son verificados. Compra con total tranquilidad.',
    home_price_title: 'Mejores Precios',
    home_price_desc: 'Precios competitivos y transparentes, sin sorpresas en la compra.',
    home_support_title: 'Soporte Dedicado',
    home_support_desc: 'Nuestro equipo está disponible para ayudarte en cada paso.',
    home_categories_title: 'Explorar por categoría',
    home_categories_sub: 'Encuentra el vehículo ideal para tu estilo de vida',
    home_cta_badge: 'Gratis para publicar',
    home_cta_title: '¿Quieres vender tu',
    home_cta_accent: 'auto más rápido?',
    home_cta_sub: 'Publica gratis y llega a miles de compradores interesados en tu región.',
    home_cta_btn: 'Publicar Ahora — Gratis',
    home_cta_explore: 'Explorar inventario',
    home_add_store: 'Agrega tu tienda aquí',

    estoque_vehicles_found: 'vehículos encontrados',
    estoque_title: 'Inventario completo',
    estoque_subtitle: 'Encuentra el auto ideal para ti',
    estoque_search_placeholder: 'Buscar marca o modelo...',
    estoque_filters: 'Filtros',
    estoque_filter_brand: 'Marca',
    estoque_all_brands: 'Todas',
    estoque_max_price: 'Precio máximo',
    estoque_min_year: 'Año mínimo',
    estoque_clear: 'Limpiar',
    estoque_loading: 'Cargando vehículos...',
    estoque_not_found: 'No se encontraron vehículos',
    estoque_not_found_sub: 'Intenta ajustar tus filtros de búsqueda.',
    estoque_clear_filters: 'Limpiar filtros',

    detail_back: 'Inventario',
    detail_price: 'Precio',
    detail_specs: 'Especificaciones',
    detail_year: 'Año',
    detail_km: 'Kilometraje',
    detail_fuel: 'Combustible',
    detail_gearbox: 'Transmisión',
    detail_color: 'Color',
    detail_city: 'Ciudad',
    detail_trade: 'Acepta cambio',
    detail_trade_yes: 'Sí',
    detail_trade_no: 'No',
    detail_seller: 'Vendedor',
    detail_available: 'Disponible',
    detail_vehicle_value: 'Valor del vehículo',
    detail_accepts_trade: 'Acepta cambio',
    detail_whatsapp: 'Chatear en WhatsApp',
    detail_safety: '🔒 Negocia con seguridad. Nunca hagas pagos anticipados.',
    detail_see_more: 'Ver más autos',
    detail_description: 'Descripción del vendedor',
    detail_not_found: 'Vehículo no encontrado.',
    detail_back_inventory: 'Volver al inventario',

    login_welcome: 'Bienvenido de nuevo',
    login_create: 'Crea tu cuenta',
    login_login_sub: 'Inicia sesión para gestionar tus anuncios y favoritos',
    login_signup_sub: 'Comienza a publicar tus vehículos gratuitamente',
    login_enter: 'Ingresar',
    login_register: 'Registrarse',
    login_full_name: 'Nombre completo *',
    login_phone: 'Teléfono',
    login_email: 'Email *',
    login_password: 'Contraseña *',
    login_login_btn: 'Iniciar sesión',
    login_signup_btn: 'Crear cuenta gratis',
    login_no_account: '¿No tienes cuenta?',
    login_free_signup: 'Regístrate gratis',
    login_has_account: '¿Ya tienes cuenta?',
    login_do_login: 'Iniciar sesión',

    stores_add_title: 'Publica tu tienda',
    stores_add_body: '¿Quieres tener tu tienda destacada para miles de compradores? Contacta a nuestro equipo y descubre cómo unirte a SulMotors.',
    stores_whatsapp: 'Chatear en WhatsApp',
    stores_email: 'Enviar email',
    stores_close: 'Cerrar',
    stores_see_all: 'Ver todas',
};

const allTranslations: Record<Language, Translations> = { 'pt-BR': ptBR, en, es };

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: Translations;
}

const LanguageContext = createContext<LanguageContextType>({
    language: 'pt-BR',
    setLanguage: () => {},
    t: ptBR,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState<Language>(() => {
        const saved = localStorage.getItem('sulmotors-lang');
        return (saved === 'pt-BR' || saved === 'en' || saved === 'es') ? saved : 'pt-BR';
    });

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('sulmotors-lang', lang);
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t: allTranslations[language] }}>
            {children}
        </LanguageContext.Provider>
    );
}

export const useLanguage = () => useContext(LanguageContext);
