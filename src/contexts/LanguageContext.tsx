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

    // Home categories
    home_cat_sedans: string;
    home_cat_suvs: string;
    home_cat_sports: string;
    home_cat_pickups: string;
    home_cat_see_more: string;

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

    // Impulsionar
    imp_badge: string;
    imp_title: string;
    imp_subtitle: string;
    imp_subtitle_accent: string;
    imp_subtitle_rest: string;
    imp_benefit_views_title: string;
    imp_benefit_views_desc: string;
    imp_benefit_contacts_title: string;
    imp_benefit_contacts_desc: string;
    imp_benefit_instant_title: string;
    imp_benefit_instant_desc: string;
    imp_period_title: string;
    imp_period_sub: string;
    imp_per_day: string;
    imp_savings: string;
    imp_btn_boosting: string;
    imp_btn_boost: string;
    imp_disclaimer: string;
    imp_back: string;
    imp_economy: string;

    // MeusAnuncios
    mads_count: string;
    mads_title: string;
    mads_subtitle: string;
    mads_new: string;
    mads_empty_title: string;
    mads_empty_sub: string;
    mads_empty_btn: string;
    mads_confirm_delete: string;

    // MeusFavoritos
    mfav_count: string;
    mfav_title: string;
    mfav_login_title: string;
    mfav_login_btn: string;
    mfav_empty_title: string;
    mfav_empty_sub: string;
    mfav_empty_btn: string;

    // SobreNos
    sobre_badge: string;
    sobre_title1: string;
    sobre_title2: string;
    sobre_subtitle: string;
    sobre_years: string;
    sobre_deals: string;
    sobre_satisfaction: string;
    sobre_vehicles: string;
    sobre_who_badge: string;
    sobre_who_title: string;
    sobre_who_accent: string;
    sobre_who_p1: string;
    sobre_who_p2: string;
    sobre_mission_title: string;
    sobre_mission_desc: string;
    sobre_vision_title: string;
    sobre_vision_desc: string;
    sobre_values_title: string;
    sobre_values_sub: string;
    sobre_val1_title: string;
    sobre_val1_desc: string;
    sobre_val2_title: string;
    sobre_val2_desc: string;
    sobre_val3_title: string;
    sobre_val3_desc: string;
    sobre_contact_badge: string;
    sobre_contact_title: string;
    sobre_contact_sub: string;
    sobre_contact_btn: string;

    // AnunciarCarro / EditarAnuncio (shared form labels)
    form_brand: string;
    form_model: string;
    form_year: string;
    form_price: string;
    form_km: string;
    form_phone: string;
    form_fuel: string;
    form_gearbox: string;
    form_color: string;
    form_city: string;
    form_description: string;
    form_trade: string;
    form_select_brand: string;
    form_select_year: string;
    form_select: string;
    form_photos: string;
    form_photos_sub: string;
    form_add_photo: string;
    form_vehicle_data: string;
    form_details: string;
    form_publish: string;
    form_publishing: string;
    form_disclaimer: string;
    form_save: string;
    form_saving: string;
    form_anunciar_title: string;
    form_anunciar_sub: string;
    form_editar_title: string;
    form_editar_sub: string;

    // Footer
    footer_desc: string;
    footer_section_inventory: string;
    footer_all_cars: string;
    footer_used: string;
    footer_new: string;
    footer_suvs: string;
    footer_section_company: string;
    footer_about: string;
    footer_advertise: string;
    footer_enter: string;
    footer_section_contact: string;
    footer_city: string;
    footer_phone: string;
    footer_whatsapp_label: string;
    footer_copyright: string;
    footer_terms: string;
    footer_privacy: string;
    footer_rights: string;

    // MeuPerfil
    perfil_title: string;
    perfil_sub: string;
    perfil_name: string;
    perfil_phone: string;
    perfil_email_label: string;
    perfil_email_readonly: string;
    perfil_save: string;
    perfil_saving: string;
    perfil_back: string;
    perfil_change_photo: string;
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

    home_badge: 'Marketplace inteligente de carros',
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

    home_cat_sedans: 'Sedans',
    home_cat_suvs: 'SUVs',
    home_cat_sports: 'Esportivos',
    home_cat_pickups: 'Picapes',
    home_cat_see_more: 'Ver mais',

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

    imp_badge: 'Impulsionar Anúncio',
    imp_title: 'Destaque seu carro',
    imp_subtitle: 'Anúncios impulsionados aparecem',
    imp_subtitle_accent: 'primeiro',
    imp_subtitle_rest: 'para todos os compradores',
    imp_benefit_views_title: '10x mais views',
    imp_benefit_views_desc: 'Apareça primeiro',
    imp_benefit_contacts_title: 'Mais contatos',
    imp_benefit_contacts_desc: 'Venda mais rápido',
    imp_benefit_instant_title: 'Imediato',
    imp_benefit_instant_desc: 'Ativo na hora',
    imp_period_title: 'Escolha o período',
    imp_period_sub: 'Toque em um período para selecionar',
    imp_per_day: '/dia',
    imp_savings: 'Economia de {pct}% por dia',
    imp_btn_boosting: 'Impulsionando...',
    imp_btn_boost: 'Impulsionar por',
    imp_disclaimer: 'Destaque ativado imediatamente após a confirmação.',
    imp_back: 'Voltar para Meus Anúncios',
    imp_economy: 'Economia de {pct}% por dia',

    mads_count: 'anúncios',
    mads_title: 'Meus Anúncios',
    mads_subtitle: 'Gerencie seus anúncios de veículos',
    mads_new: 'Novo Anúncio',
    mads_empty_title: 'Nenhum anúncio ainda',
    mads_empty_sub: 'Comece anunciando seu primeiro carro gratuitamente!',
    mads_empty_btn: 'Anunciar Carro',
    mads_confirm_delete: 'Tem certeza que deseja excluir este anúncio?',

    mfav_count: 'favoritos',
    mfav_title: 'Meus Favoritos',
    mfav_login_title: 'Faça login para ver seus favoritos',
    mfav_login_btn: 'Entrar',
    mfav_empty_title: 'Nenhum favorito ainda',
    mfav_empty_sub: 'Explore nosso estoque e clique no coração para salvar os veículos que você gostar.',
    mfav_empty_btn: 'Ver Estoque',

    sobre_badge: 'Sobre nós',
    sobre_title1: 'Reinventando o',
    sobre_title2: 'mercado automotivo',
    sobre_subtitle: 'Conectamos compradores e vendedores com tecnologia de ponta, segurança e a melhor experiência do Brasil.',
    sobre_years: 'Anos no mercado',
    sobre_deals: 'Negócios realizados',
    sobre_satisfaction: 'Satisfação do cliente',
    sobre_vehicles: 'Veículos ativos',
    sobre_who_badge: 'Quem somos',
    sobre_who_title: 'Uma empresa que',
    sobre_who_accent: 'transforma',
    sobre_who_p1: 'A SulMotors nasceu com a missão de transformar o mercado de veículos seminovos no Brasil. Somos um marketplace digital que conecta compradores e vendedores, oferecendo uma experiência moderna, segura e transparente.',
    sobre_who_p2: 'Utilizamos tecnologia de ponta, incluindo inteligência artificial para aprimoramento de fotos e ferramentas de precificação inteligente, tornando o processo de compra e venda mais eficiente e acessível para todos.',
    sobre_mission_title: 'Missão',
    sobre_mission_desc: 'Facilitar a compra e venda de veículos no Brasil, democratizando o acesso a boas ofertas e proporcionando uma experiência segura e transparente para todos os envolvidos.',
    sobre_vision_title: 'Visão',
    sobre_vision_desc: 'Ser referência nacional em marketplace automotivo, reconhecida pela inovação tecnológica, excelência no atendimento e compromisso com a transparência nas negociações.',
    sobre_values_title: 'Nossos valores',
    sobre_values_sub: 'O que guia cada decisão que tomamos',
    sobre_val1_title: 'Confiança',
    sobre_val1_desc: 'Construímos relacionamentos duradouros baseados em transparência e integridade total.',
    sobre_val2_title: 'Inovação',
    sobre_val2_desc: 'Investimos continuamente em tecnologia para oferecer a melhor experiência do mercado.',
    sobre_val3_title: 'Transparência',
    sobre_val3_desc: 'Todas as informações são apresentadas de forma clara e honesta aos nossos usuários.',
    sobre_contact_badge: 'Fale conosco',
    sobre_contact_title: 'Entre em contato',
    sobre_contact_sub: 'Estamos prontos para ajudar você em qualquer etapa',
    sobre_contact_btn: 'Começar agora',

    form_brand: 'Marca *',
    form_model: 'Modelo *',
    form_year: 'Ano *',
    form_price: 'Preço (R$) *',
    form_km: 'Quilometragem',
    form_phone: 'Telefone *',
    form_fuel: 'Combustível',
    form_gearbox: 'Câmbio',
    form_color: 'Cor',
    form_city: 'Cidade',
    form_description: 'Descrição',
    form_trade: 'Aceita troca',
    form_select_brand: 'Selecione a marca',
    form_select_year: 'Selecione o ano',
    form_select: 'Selecione',
    form_photos: 'Fotos do veículo',
    form_photos_sub: 'Adicione até 6 fotos',
    form_add_photo: 'Adicionar',
    form_vehicle_data: 'Dados do veículo',
    form_details: 'Detalhes adicionais',
    form_publish: 'Publicar Anúncio Gratuitamente',
    form_publishing: 'Publicando...',
    form_disclaimer: 'Ao publicar, você concorda com nossos Termos de Uso.',
    form_save: 'Salvar Alterações',
    form_saving: 'Salvando...',
    form_anunciar_title: 'Anunciar Meu Carro',
    form_anunciar_sub: 'Preencha os dados do seu veículo',
    form_editar_title: 'Editar Anúncio',
    form_editar_sub: 'Atualize as informações do seu veículo',

    footer_desc: 'O marketplace automotivo mais moderno do Brasil. Compre e venda veículos com segurança, tecnologia e confiança.',
    footer_section_inventory: 'Estoque',
    footer_all_cars: 'Todos os Carros',
    footer_used: 'Seminovos',
    footer_new: '0 KM',
    footer_suvs: 'SUVs',
    footer_section_company: 'Empresa',
    footer_about: 'Sobre Nós',
    footer_advertise: 'Anunciar',
    footer_enter: 'Entrar',
    footer_section_contact: 'Contato',
    footer_city: 'Porto Alegre, RS',
    footer_phone: '(51) 99999-9999',
    footer_whatsapp_label: 'WhatsApp',
    footer_copyright: '© 2026 SulMotors. Todos os direitos reservados.',
    footer_terms: 'Termos de Uso',
    footer_privacy: 'Política de Privacidade',
    footer_rights: 'Seus Direitos de Privacidade',

    perfil_title: 'Meu Perfil',
    perfil_sub: 'Gerencie suas informações pessoais',
    perfil_name: 'Nome completo',
    perfil_phone: 'Telefone',
    perfil_email_label: 'Email',
    perfil_email_readonly: 'O email não pode ser alterado',
    perfil_save: 'Salvar alterações',
    perfil_saving: 'Salvando...',
    perfil_back: 'Voltar',
    perfil_change_photo: 'Alterar foto',
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

    home_badge: 'Marketplace inteligente de carros',
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

    home_cat_sedans: 'Sedans',
    home_cat_suvs: 'SUVs',
    home_cat_sports: 'Sports',
    home_cat_pickups: 'Pickups',
    home_cat_see_more: 'See more',

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

    imp_badge: 'Boost Listing',
    imp_title: 'Highlight your car',
    imp_subtitle: 'Boosted listings appear',
    imp_subtitle_accent: 'first',
    imp_subtitle_rest: 'for all buyers',
    imp_benefit_views_title: '10x more views',
    imp_benefit_views_desc: 'Appear at the top',
    imp_benefit_contacts_title: 'More contacts',
    imp_benefit_contacts_desc: 'Sell faster',
    imp_benefit_instant_title: 'Instant',
    imp_benefit_instant_desc: 'Active immediately',
    imp_period_title: 'Choose a period',
    imp_period_sub: 'Tap a period to select',
    imp_per_day: '/day',
    imp_savings: 'Save {pct}% per day',
    imp_btn_boosting: 'Boosting...',
    imp_btn_boost: 'Boost for',
    imp_disclaimer: 'Boost activated immediately after confirmation.',
    imp_back: 'Back to My Listings',
    imp_economy: 'Save {pct}% per day',

    mads_count: 'listings',
    mads_title: 'My Listings',
    mads_subtitle: 'Manage your vehicle listings',
    mads_new: 'New Listing',
    mads_empty_title: 'No listings yet',
    mads_empty_sub: 'Start by listing your first car for free!',
    mads_empty_btn: 'List a Car',
    mads_confirm_delete: 'Are you sure you want to delete this listing?',

    mfav_count: 'favorites',
    mfav_title: 'My Favorites',
    mfav_login_title: 'Sign in to see your favorites',
    mfav_login_btn: 'Sign In',
    mfav_empty_title: 'No favorites yet',
    mfav_empty_sub: 'Browse our inventory and tap the heart to save vehicles you like.',
    mfav_empty_btn: 'Browse Inventory',

    sobre_badge: 'About us',
    sobre_title1: 'Reinventing the',
    sobre_title2: 'automotive market',
    sobre_subtitle: 'We connect buyers and sellers with cutting-edge technology, security and the best experience in Brazil.',
    sobre_years: 'Years in market',
    sobre_deals: 'Deals completed',
    sobre_satisfaction: 'Customer satisfaction',
    sobre_vehicles: 'Active vehicles',
    sobre_who_badge: 'Who we are',
    sobre_who_title: 'A company that',
    sobre_who_accent: 'transforms',
    sobre_who_p1: 'SulMotors was born with the mission to transform the used vehicle market in Brazil. We are a digital marketplace connecting buyers and sellers with a modern, secure and transparent experience.',
    sobre_who_p2: 'We use cutting-edge technology, including AI for photo enhancement and smart pricing tools, making the buying and selling process more efficient and accessible for everyone.',
    sobre_mission_title: 'Mission',
    sobre_mission_desc: 'To facilitate the buying and selling of vehicles in Brazil, democratizing access to great deals and providing a safe, transparent experience for everyone involved.',
    sobre_vision_title: 'Vision',
    sobre_vision_desc: 'To be the national reference in automotive marketplaces, recognized for technological innovation, service excellence, and commitment to transparency.',
    sobre_values_title: 'Our values',
    sobre_values_sub: 'What guides every decision we make',
    sobre_val1_title: 'Trust',
    sobre_val1_desc: 'We build lasting relationships based on total transparency and integrity.',
    sobre_val2_title: 'Innovation',
    sobre_val2_desc: 'We continuously invest in technology to offer the best market experience.',
    sobre_val3_title: 'Transparency',
    sobre_val3_desc: 'All information is presented clearly and honestly to our users.',
    sobre_contact_badge: 'Contact us',
    sobre_contact_title: 'Get in touch',
    sobre_contact_sub: 'We are ready to help you at every step',
    sobre_contact_btn: 'Get started',

    form_brand: 'Brand *',
    form_model: 'Model *',
    form_year: 'Year *',
    form_price: 'Price (R$) *',
    form_km: 'Mileage',
    form_phone: 'Phone *',
    form_fuel: 'Fuel',
    form_gearbox: 'Gearbox',
    form_color: 'Color',
    form_city: 'City',
    form_description: 'Description',
    form_trade: 'Accepts trade-in',
    form_select_brand: 'Select brand',
    form_select_year: 'Select year',
    form_select: 'Select',
    form_photos: 'Vehicle photos',
    form_photos_sub: 'Add up to 6 photos',
    form_add_photo: 'Add',
    form_vehicle_data: 'Vehicle data',
    form_details: 'Additional details',
    form_publish: 'Publish Listing for Free',
    form_publishing: 'Publishing...',
    form_disclaimer: 'By publishing, you agree to our Terms of Use.',
    form_save: 'Save Changes',
    form_saving: 'Saving...',
    form_anunciar_title: 'List My Car',
    form_anunciar_sub: 'Fill in your vehicle details',
    form_editar_title: 'Edit Listing',
    form_editar_sub: 'Update your vehicle information',

    perfil_title: 'My Profile',
    perfil_sub: 'Manage your personal information',
    perfil_name: 'Full name',
    perfil_phone: 'Phone',
    perfil_email_label: 'Email',
    perfil_email_readonly: 'Email cannot be changed',
    perfil_save: 'Save changes',
    perfil_saving: 'Saving...',
    perfil_back: 'Back',
    perfil_change_photo: 'Change photo',

    footer_desc: 'The most modern automotive marketplace in Brazil. Buy and sell vehicles safely, with technology and trust.',
    footer_section_inventory: 'Inventory',
    footer_all_cars: 'All Cars',
    footer_used: 'Used Cars',
    footer_new: '0 KM',
    footer_suvs: 'SUVs',
    footer_section_company: 'Company',
    footer_about: 'About Us',
    footer_advertise: 'Sell Your Car',
    footer_enter: 'Sign In',
    footer_section_contact: 'Contact',
    footer_city: 'Porto Alegre, RS',
    footer_phone: '(51) 99999-9999',
    footer_whatsapp_label: 'WhatsApp',
    footer_copyright: '© 2026 SulMotors. All rights reserved.',
    footer_terms: 'Terms of Use',
    footer_privacy: 'Privacy Policy',
    footer_rights: 'Your Privacy Rights',
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

    home_badge: 'Marketplace inteligente de carros',
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

    home_cat_sedans: 'Sedanes',
    home_cat_suvs: 'SUVs',
    home_cat_sports: 'Deportivos',
    home_cat_pickups: 'Pickups',
    home_cat_see_more: 'Ver más',

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

    imp_badge: 'Impulsar Anuncio',
    imp_title: 'Destaca tu auto',
    imp_subtitle: 'Los anuncios impulsados aparecen',
    imp_subtitle_accent: 'primero',
    imp_subtitle_rest: 'para todos los compradores',
    imp_benefit_views_title: '10x más vistas',
    imp_benefit_views_desc: 'Aparece primero',
    imp_benefit_contacts_title: 'Más contactos',
    imp_benefit_contacts_desc: 'Vende más rápido',
    imp_benefit_instant_title: 'Inmediato',
    imp_benefit_instant_desc: 'Activo al instante',
    imp_period_title: 'Elige el período',
    imp_period_sub: 'Toca un período para seleccionar',
    imp_per_day: '/día',
    imp_savings: 'Ahorra {pct}% por día',
    imp_btn_boosting: 'Impulsando...',
    imp_btn_boost: 'Impulsar por',
    imp_disclaimer: 'Destacado activado inmediatamente tras la confirmación.',
    imp_back: 'Volver a Mis Anuncios',
    imp_economy: 'Ahorra {pct}% por día',

    mads_count: 'anuncios',
    mads_title: 'Mis Anuncios',
    mads_subtitle: 'Administra tus anuncios de vehículos',
    mads_new: 'Nuevo Anuncio',
    mads_empty_title: 'Aún no hay anuncios',
    mads_empty_sub: '¡Comienza publicando tu primer auto gratis!',
    mads_empty_btn: 'Publicar Auto',
    mads_confirm_delete: '¿Estás seguro de que deseas eliminar este anuncio?',

    mfav_count: 'favoritos',
    mfav_title: 'Mis Favoritos',
    mfav_login_title: 'Inicia sesión para ver tus favoritos',
    mfav_login_btn: 'Ingresar',
    mfav_empty_title: 'Aún no hay favoritos',
    mfav_empty_sub: 'Explora nuestro inventario y toca el corazón para guardar los vehículos que te gusten.',
    mfav_empty_btn: 'Ver Inventario',

    sobre_badge: 'Sobre nosotros',
    sobre_title1: 'Reinventando el',
    sobre_title2: 'mercado automotriz',
    sobre_subtitle: 'Conectamos compradores y vendedores con tecnología de punta, seguridad y la mejor experiencia de Brasil.',
    sobre_years: 'Años en el mercado',
    sobre_deals: 'Negocios realizados',
    sobre_satisfaction: 'Satisfacción del cliente',
    sobre_vehicles: 'Vehículos activos',
    sobre_who_badge: 'Quiénes somos',
    sobre_who_title: 'Una empresa que',
    sobre_who_accent: 'transforma',
    sobre_who_p1: 'SulMotors nació con la misión de transformar el mercado de vehículos usados en Brasil. Somos un marketplace digital que conecta compradores y vendedores con una experiencia moderna, segura y transparente.',
    sobre_who_p2: 'Utilizamos tecnología de punta, incluyendo inteligencia artificial para mejorar fotos y herramientas de precios inteligentes, haciendo el proceso de compra y venta más eficiente y accesible para todos.',
    sobre_mission_title: 'Misión',
    sobre_mission_desc: 'Facilitar la compra y venta de vehículos en Brasil, democratizando el acceso a buenas ofertas y brindando una experiencia segura y transparente para todos.',
    sobre_vision_title: 'Visión',
    sobre_vision_desc: 'Ser referente nacional en marketplace automotriz, reconocida por la innovación tecnológica, excelencia en el servicio y compromiso con la transparencia.',
    sobre_values_title: 'Nuestros valores',
    sobre_values_sub: 'Lo que guía cada decisión que tomamos',
    sobre_val1_title: 'Confianza',
    sobre_val1_desc: 'Construimos relaciones duraderas basadas en transparencia e integridad total.',
    sobre_val2_title: 'Innovación',
    sobre_val2_desc: 'Invertimos continuamente en tecnología para ofrecer la mejor experiencia del mercado.',
    sobre_val3_title: 'Transparencia',
    sobre_val3_desc: 'Toda la información se presenta de forma clara y honesta a nuestros usuarios.',
    sobre_contact_badge: 'Contáctanos',
    sobre_contact_title: 'Ponte en contacto',
    sobre_contact_sub: 'Estamos listos para ayudarte en cada etapa',
    sobre_contact_btn: 'Empezar ahora',

    form_brand: 'Marca *',
    form_model: 'Modelo *',
    form_year: 'Año *',
    form_price: 'Precio (R$) *',
    form_km: 'Kilometraje',
    form_phone: 'Teléfono *',
    form_fuel: 'Combustible',
    form_gearbox: 'Transmisión',
    form_color: 'Color',
    form_city: 'Ciudad',
    form_description: 'Descripción',
    form_trade: 'Acepta cambio',
    form_select_brand: 'Selecciona la marca',
    form_select_year: 'Selecciona el año',
    form_select: 'Selecciona',
    form_photos: 'Fotos del vehículo',
    form_photos_sub: 'Agrega hasta 6 fotos',
    form_add_photo: 'Agregar',
    form_vehicle_data: 'Datos del vehículo',
    form_details: 'Detalles adicionales',
    form_publish: 'Publicar Anuncio Gratis',
    form_publishing: 'Publicando...',
    form_disclaimer: 'Al publicar, aceptas nuestros Términos de Uso.',
    form_save: 'Guardar cambios',
    form_saving: 'Guardando...',
    form_anunciar_title: 'Publicar Mi Auto',
    form_anunciar_sub: 'Completa los datos de tu vehículo',
    form_editar_title: 'Editar Anuncio',
    form_editar_sub: 'Actualiza la información de tu vehículo',

    perfil_title: 'Mi Perfil',
    perfil_sub: 'Administra tu información personal',
    perfil_name: 'Nombre completo',
    perfil_phone: 'Teléfono',
    perfil_email_label: 'Email',
    perfil_email_readonly: 'El email no puede cambiarse',
    perfil_save: 'Guardar cambios',
    perfil_saving: 'Guardando...',
    perfil_back: 'Volver',
    perfil_change_photo: 'Cambiar foto',

    footer_desc: 'El marketplace automotriz más moderno de Brasil. Compra y vende vehículos con seguridad, tecnología y confianza.',
    footer_section_inventory: 'Inventario',
    footer_all_cars: 'Todos los Autos',
    footer_used: 'Seminuevos',
    footer_new: '0 KM',
    footer_suvs: 'SUVs',
    footer_section_company: 'Empresa',
    footer_about: 'Sobre Nosotros',
    footer_advertise: 'Vender Auto',
    footer_enter: 'Ingresar',
    footer_section_contact: 'Contacto',
    footer_city: 'Porto Alegre, RS',
    footer_phone: '(51) 99999-9999',
    footer_whatsapp_label: 'WhatsApp',
    footer_copyright: '© 2026 SulMotors. Todos los derechos reservados.',
    footer_terms: 'Términos de Uso',
    footer_privacy: 'Política de Privacidad',
    footer_rights: 'Tus Derechos de Privacidad',
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
