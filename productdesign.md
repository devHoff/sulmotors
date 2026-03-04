# SulMotors Product Design

## 1. Overview
SulMotors is a modern, interactive car resale marketplace designed to streamline the buying and selling process. It offers a fully functional responsive experience with authentication, car listing management, AI photo enhancement, and a featured promotion system.

## 2. Technology Stack
- **Frontend**: React
- **Routing**: `react-router-dom`
- **Backend/Services**: **Supabase** (Authentication, PostgreSQL Database, Storage)
- **UI Components**: `shadcn/ui`
- **Icons**: Lucide React
- **Animations**: `framer-motion`
- **Notifications**: `sonner` (Toast)
- **Styling**: Tailwind CSS

## 3. Global Layout & Pages

### 3.1. Home (`pages/Home.jsx`)
- **Hero Section**: Headline "Encontre Seu Próximo Carro" and prominent search interface.
- **Tabbed Section**:
    - **Tab 1: "QUERO COMPRAR"**: Search field for brand/model, filters toggle, and horizontal filter bar (Brand, Year range, Price range). Redirects to `/Estoque` with query params.
    - **Tab 2: "QUERO VENDER"**: Quick link to `/AnunciarCarro`.
- **Highlights Bar**: Trust indicators (Seminovos Inspecionados, Melhores Ofertas, Financiamento Fácil).
- **Featured Cars Section**: Displays cars where `destaque == true` OR `impulsionado == true`. Sorted by `prioridade` (descending) and creation date.
- **Benefits & CTA**: Motivational content and final link to list a car.

### 3.2. Estoque (`pages/Estoque.jsx`)
- Displays available cars (excluding boosted ones featured on Home).
- Includes `CarFilters` component (Search, Brand, Year, Price).
- Sorting by priority and date.

### 3.3. Meus Anúncios (`pages/MeusAnuncios.jsx`)
- User-specific dashboard to manage their listings.

### 3.4. Anunciar Carro (`pages/AnunciarCarro.jsx`)
- **Authentication**: Required via Supabase Auth.
- **Form Fields**: Marca, Modelo, Ano, Preço, Quilometragem, Telefone, Descrição, Combustível, Câmbio, Cor, Cidade, Aceita troca (switch).
- **Photo Upload**: Up to 6 images stored in **Supabase Storage** (bucket: `car-images`).
- **AI Integration**: `AIPhotoModal` for background enhancement and 360° generation (`modelo_3d = true`).

### 3.5. Editar Anúncio (`pages/EditarAnuncio.jsx`)
- Pre-filled form for updating existing listings.

### 3.6. Detalhe Carro (`pages/DetalheCarro.jsx`)
- Full vehicle information, image gallery (including 360° view), and seller contact.

### 3.7. Impulsionar (`pages/Impulsionar.jsx`)
- Promotion flow to boost listings. Sets `destaque = true`, `impulsionado = true`, and sets an expiration date/priority boost.

### 3.8. Sobre Nós (`pages/SobreNos.jsx`)
- Institutional content: Mission, Vision, Contact.

## 4. Data Model & Logic

### 4.1. Authentication
Implementation via **Supabase Auth**:
- User sign-up/login with Email/Password or Social Providers.
- Session management via `supabase.auth.getSession()`.
- Protected routes for listing management and profile.

### 4.2. Database & CRUD
- **Table**: `cars` (PostgreSQL)
- Schema includes fields for: brand, model, year, price, mileage, images (array of URLs), and promotion flags (`destaque`, `impulsionado`).
- CRUD performed using `@supabase/supabase-js` client.

## 5. Design & UI Requirements
- **Responsive**: Mobile-first approach.
- **Premium Aesthetics**: Clean UI using `shadcn/ui`, smooth animations with `framer-motion`.
- **Production Ready**: Modular component architecture and clear page separation.


