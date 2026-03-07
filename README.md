# SulMotors 🚗

> **O marketplace automotivo mais moderno do Sul do Brasil.**  
> Compre e venda veículos com segurança, tecnologia e confiança.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-backend-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)

---

## 📸 Screenshots

| Light Mode | Dark Mode |
|---|---|
| Clean white UI with cyan brand accents | Full dark theme toggled by a single click |

---

## ✨ Features

### 🏠 Home Page
- **Animated hero carousel** — 3 rotating full-screen background photos with 5-second auto-advance and dot navigation
- **Featured vehicles grid** — pulls `destaque` and `impulsionado` listings from Supabase, sorted by priority
- **Partner stores section** — shows AlexMegaMotors + a dashed placeholder card that opens a contact modal for new partners
- **"Add your store" modal** — WhatsApp and email CTA buttons so store owners can get in touch; fully translated in all 3 languages
- **Category grid** — quick links to SUVs, Sedans, Sports, Pickups with parallax hover
- **"Why choose us" cards** — animated feature highlights
- **Full-bleed CTA banner** — always dark with photo background, always visually striking regardless of theme
- **Fully internationalised** — every text string on the page responds to the active language

### 🔍 Estoque (Inventory)
- **Real-time search** — filter by brand/model as you type
- **Sidebar filters** — brand checkboxes, price range slider, year range slider
- **Active filter chips** — removable tags showing applied filters
- **Framer Motion grid** — cards animate in/out with `AnimatePresence` when filters change
- **Responsive layout** — sidebar collapses to a toggle on mobile

### 🚘 Car Detail (DetalheCarro)
- **Desktop 3-panel carousel** — blurred colour-matched background, centred sharp main image, dimmed prev/next peek panels
- **Mobile full-bleed** — simple swipeable full-screen image (touch swipe ≥ 40px triggers navigation)
- **Framer Motion slide transition** — directional slide + fade for every image change
- **Thumbnail strip** — scrollable, active item highlighted in brand cyan
- **Spec grid** — 7 spec cards (year, km, fuel, gearbox, colour, city, trade acceptance)
- **Seller contact card** — sticky on desktop; WhatsApp deep-link + phone call buttons
- **Like / share** — per-user like saved to Supabase `curtidas` table

### 🔐 Authentication
- **Supabase Auth** — email + password sign-in and sign-up
- **Protected routes** — listing creation/editing requires login
- **User avatar** — uploaded to Supabase Storage; cropped with a round 1:1 crop before upload

### 📢 Anunciar / Editar (Ad Management)
- **Multi-step form** — Vehicle data → Technical details → Description → Photos
- **Image upload** — up to 6 photos, stored in Supabase Storage bucket `car-images`
- **Smart photo modal** — opens showing the full original image; user can either upload it as-is ("Usar foto") or enter an optional free-form crop mode ("Recortar") before uploading
- **Free-form crop** — no fixed aspect ratio; drag any corner to select exactly what to keep; zoom slider; "Voltar" returns to original preview without cropping
- **Toggle switch** — animated trade-acceptance toggle

### ⚡ Impulsionar (Boost)
- **Boost plans** — 6 pricing tiers (1 week to 1 year) with per-day cost and savings badge
- **Supabase update** — sets `impulsionado: true` and `impulsionado_ate` date on the listing

### 👤 Profile & Favourites
- **Meu Perfil** — name/phone editing, avatar upload with live round-crop preview
- **Meus Favoritos** — real-time list of liked vehicles pulled from `curtidas`
- **Meus Anúncios** — owner dashboard with Edit / Delete / Boost actions per card

### 🌗 Light / Dark Mode
- **Light mode is the default** — clean white/slate colour palette out of the box
- **One-click dark mode** — Moon/Sun toggle in both desktop Navbar and mobile menu
- **Theme-aware logo** — `logo-light.png` in light mode, `logo-dark.png` in dark mode (Navbar + Footer)
- **Persistent preference** — theme saved to `localStorage`, remembered across sessions
- **CSS class strategy** — Tailwind `darkMode: 'class'` on `<html>` for zero-flash switching
- **Always-dark sections** — Hero, CTA, and Login left panel stay dark regardless of theme

### 🌐 Internationalisation (i18n)
- **3 languages** — Português (pt-BR 🇧🇷), English (en 🇬🇧), Español (es 🇪🇸)
- **Flag dropdown** — animated language selector in the Navbar (desktop dropdown + mobile compact button)
- **Full coverage** — Navbar, Home (hero, stats, featured, stores, why-us, categories, CTA), Estoque, DetalheCarro, Login, and the AddStore modal are all translated
- **Persistent** — language preference saved to `localStorage`
- **`LanguageContext`** — single source of truth; add new strings to one object per language

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React 19 + TypeScript |
| **Build tool** | Vite 6 |
| **Styling** | Tailwind CSS 3 (dark-mode class strategy) |
| **Animation** | Framer Motion 11 |
| **Icons** | Lucide React |
| **Routing** | React Router DOM 7 |
| **Backend / DB** | Supabase (Postgres + Auth + Storage) |
| **Image crop** | react-easy-crop |
| **Notifications** | Sonner |
| **State** | React Context (Auth + Theme + Language) |

---

## 🗂️ Project Structure

```
sulmotors/
├── public/
│   ├── logo-light.png        # Brand logo for light mode
│   └── logo-dark.png         # Brand logo for dark mode
├── src/
│   ├── components/
│   │   ├── AddStoreModal.tsx  # "Add your store" contact popup (i18n)
│   │   ├── CarCard.tsx        # Reusable car listing card
│   │   ├── CarFilters.tsx     # Sidebar filter panel
│   │   ├── CropModal.tsx      # Smart photo modal (preview-first, optional free-form crop)
│   │   ├── Footer.tsx         # Site footer with theme-aware logo
│   │   ├── Layout.tsx         # Page wrapper (Navbar + Footer)
│   │   ├── Navbar.tsx         # Sticky nav + theme toggle + language selector
│   │   └── ScrollToTop.tsx    # Scroll-to-top on route change
│   ├── contexts/
│   │   ├── AuthContext.tsx    # Supabase auth state + helpers
│   │   ├── LanguageContext.tsx# i18n translations (pt-BR / en / es) + persistence
│   │   └── ThemeContext.tsx   # Light/dark theme state + toggle
│   ├── data/
│   │   └── mockCars.ts        # Car type, brand/fuel/transmission lists
│   ├── lib/
│   │   └── supabase.ts        # Supabase client initialisation
│   ├── pages/
│   │   ├── AnunciarCarro.tsx  # Create new ad
│   │   ├── DetalheCarro.tsx   # Car detail with carousel
│   │   ├── EditarAnuncio.tsx  # Edit existing ad
│   │   ├── Estoque.tsx        # Inventory / search page
│   │   ├── Home.tsx           # Landing page (fully translated)
│   │   ├── Impulsionar.tsx    # Boost a listing
│   │   ├── Login.tsx          # Auth page (login / register)
│   │   ├── MeuPerfil.tsx      # User profile editor
│   │   ├── MeusAnuncios.tsx   # User's own listings
│   │   ├── MeusFavoritos.tsx  # User's liked cars
│   │   └── SobreNos.tsx       # About page
│   ├── utils/
│   │   └── imageUtils.ts      # Canvas crop helper (getCroppedImg)
│   ├── App.tsx                # Routes definition
│   ├── index.css              # Global styles + Tailwind directives
│   └── main.tsx               # React root + providers
├── index.html
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## ⚙️ Environment Variables

Create a `.env` file in the project root:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

> All variables must be prefixed with `VITE_` to be exposed to the browser bundle.

---

## 🗄️ Supabase Schema

### `anuncios` table
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | auto-generated |
| `user_id` | uuid FK | references `auth.users` |
| `marca` | text | car brand |
| `modelo` | text | model name |
| `ano` | integer | year |
| `preco` | numeric | price in BRL |
| `quilometragem` | integer | mileage |
| `telefone` | text | seller contact |
| `descricao` | text | optional description |
| `combustivel` | text | fuel type |
| `cambio` | text | gearbox type |
| `cor` | text | colour |
| `cidade` | text | city |
| `aceita_troca` | boolean | accepts trade-in |
| `imagens` | text[] | array of public storage URLs |
| `destaque` | boolean | featured flag |
| `impulsionado` | boolean | boosted flag |
| `impulsionado_ate` | timestamptz | boost expiry |
| `prioridade` | integer | sort priority |
| `loja` | text | store name (optional) |
| `created_at` | timestamptz | auto |

### `curtidas` table
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `anuncio_id` | uuid FK | references `anuncios.id` |
| `user_id` | uuid FK | references `auth.users.id` |

### `profiles` table
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | same as `auth.users.id` |
| `full_name` | text | |
| `phone` | text | |
| `avatar_url` | text | public URL from `avatars` bucket |
| `updated_at` | timestamptz | |

### Storage Buckets
| Bucket | Used for |
|---|---|
| `car-images` | Car listing photos (full resolution, optional crop) |
| `avatars` | User profile pictures (round 1:1 crop before upload) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A Supabase project (free tier works)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/devHoff/sulmotors.git
cd sulmotors

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Fill in your Supabase URL and anon key

# 4. Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Build for production

```bash
npm run build        # Outputs to /dist
npm run preview      # Preview the production build locally
```

---

## 🎨 Design System

### Colour Palette

| Token | Hex | Usage |
|---|---|---|
| `brand-400` | `#00d4ff` | Primary CTA, active states, icons |
| `brand-500` | `#00b8e6` | Primary text accents (light mode) |
| `brand-600` | `#0094c4` | Hover states |
| `zinc-950` | `#0a0a0a` | Dark mode page background |
| `slate-50` | `#f8fafc` | Light mode page background |

### Typography
- **Font**: Inter (Google Fonts) — loaded via CSS import
- **Headings**: `font-black` (900 weight), tight tracking
- **Body**: `font-medium` / `font-normal`, `leading-relaxed`

### Logo
- **Light mode**: `public/logo-light.png` (dark logotype on transparent background)
- **Dark mode**: `public/logo-dark.png` (light logotype on transparent background)
- Both the Navbar and Footer swap logos automatically via `isDark` from `ThemeContext`

### Theme Architecture
- Tailwind `darkMode: 'class'` — the `dark` class is toggled on `<html>`
- `ThemeContext` manages state, persists to `localStorage`, defaults to `'light'`
- Every component uses paired classes: `bg-white dark:bg-zinc-900`, `text-slate-900 dark:text-white`, etc.
- Sections with photo backgrounds (Hero, CTA, Login left panel) are **always dark**

---

## 🌐 Internationalisation Guide

Translations live in `src/contexts/LanguageContext.tsx`. To add a new string:

1. Add the key to the `Translations` interface
2. Add the value to each of the three locale objects (`ptBR`, `en`, `es`)
3. Use `const { t } = useLanguage()` in your component and reference `t.your_key`

To add a new language:
1. Add the locale code to the `Language` type
2. Create a new translations object
3. Add an entry to `allTranslations`
4. Add a flag SVG and entry to `flagMap` in `Navbar.tsx`

---

## 📸 Photo Upload Flow

### Car photos (AnunciarCarro / EditarAnuncio)
1. User selects a file → modal opens showing the **full original** image
2. **"Usar foto"** (primary button) → uploads at full resolution, no changes
3. **"Recortar"** (secondary) → enters free-form crop mode
   - Drag corners to select area · scroll or use slider to zoom
   - **"Confirmar recorte"** → uploads the cropped selection as JPEG
   - **"Voltar"** → returns to the original preview
4. **"Cancelar"** → dismisses the modal, nothing uploaded

### Profile avatar (MeuPerfil)
1. User selects a file → modal opens with a **round 1:1 crop** view
2. Drag to position · zoom to fit
3. **"Confirmar"** → crops the circle and uploads to `avatars` bucket

---

## 📱 Responsive Breakpoints

| Breakpoint | Width | Layout changes |
|---|---|---|
| Mobile | < 768px | Single column, swipeable carousel, stacked filters, compact language button |
| Tablet `md` | 768px+ | 2-col grids, sidebar filter visible |
| Desktop `lg` | 1024px+ | 3-panel carousel, full language dropdown, sticky sidebar |

---

## 🔑 Key Pages & Routes

| Route | Component | Auth required |
|---|---|---|
| `/` | `Home` | No |
| `/estoque` | `Estoque` | No |
| `/carro/:id` | `DetalheCarro` | No (like requires auth) |
| `/sobre-nos` | `SobreNos` | No |
| `/login` | `Login` | No |
| `/anunciar` | `AnunciarCarro` | ✅ Yes |
| `/editar/:id` | `EditarAnuncio` | ✅ Yes (owner only) |
| `/impulsionar/:id` | `Impulsionar` | ✅ Yes (owner only) |
| `/meus-anuncios` | `MeusAnuncios` | ✅ Yes |
| `/favoritos` | `MeusFavoritos` | ✅ Yes |
| `/meu-perfil` | `MeuPerfil` | ✅ Yes |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push to the branch: `git push origin feat/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  Made with ❤️ by <a href="https://github.com/devHoff">devHoff</a>
</div>
