export interface Car {
    id: string;
    marca: string;
    modelo: string;
    ano: number;
    preco: number;
    quilometragem: number;
    telefone: string;
    descricao: string;
    combustivel: string;
    cambio: string;
    cor: string;
    cidade: string;
    aceitaTroca: boolean;
    imagens: string[];
    destaque: boolean;
    impulsionado: boolean;
    impulsionado_ate?: string;
    prioridade: number;
    modelo_3d: boolean;
    created_at: string;
    user_id: string;
    loja?: string;
    slug?: string;   // SEO-friendly URL slug (stored in DB after migration 004)
}

export const mockCars: Car[] = [
    {
        id: '1',
        marca: 'Honda',
        modelo: 'Civic EXL',
        ano: 2024,
        preco: 145900,
        quilometragem: 0,
        telefone: '(11) 99999-1111',
        descricao: 'Honda Civic EXL 2024 0km. Completo com teto solar, bancos em couro, multimídia com Apple CarPlay e Android Auto.',
        combustivel: 'Flex',
        cambio: 'Automático',
        cor: 'Preto',
        cidade: 'São Paulo, SP',
        aceitaTroca: false,
        imagens: [
            'https://images.unsplash.com/photo-1619767886558-efb0e97e5db3?w=800&q=80',
            'https://images.unsplash.com/photo-1606611013004-e0843ad3e38e?w=800&q=80',
        ],
        destaque: true,
        impulsionado: true,
        impulsionado_ate: '2026-03-15',
        prioridade: 10,
        modelo_3d: false,
        created_at: '2026-02-10T10:00:00Z',
        user_id: 'user1',
    },
    {
        id: '2',
        marca: 'Toyota',
        modelo: 'Corolla Cross XRE',
        ano: 2023,
        preco: 167500,
        quilometragem: 12000,
        telefone: '(21) 98888-2222',
        descricao: 'Toyota Corolla Cross XRE 2023 com apenas 12 mil km rodados. Revisões em dia na concessionária.',
        combustivel: 'Híbrido',
        cambio: 'Automático',
        cor: 'Branco Pérola',
        cidade: 'Rio de Janeiro, RJ',
        aceitaTroca: true,
        imagens: [
            'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&q=80',
            'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80',
        ],
        destaque: true,
        impulsionado: false,
        prioridade: 8,
        modelo_3d: false,
        created_at: '2026-02-08T14:30:00Z',
        user_id: 'user2',
    },
    {
        id: '3',
        marca: 'BMW',
        modelo: 'Série 3 320i',
        ano: 2023,
        preco: 289900,
        quilometragem: 8500,
        telefone: '(61) 97777-3333',
        descricao: 'BMW 320i Sport GP 2023. Interior caramelo, teto solar panorâmico, piloto automático adaptativo.',
        combustivel: 'Gasolina',
        cambio: 'Automático',
        cor: 'Azul',
        cidade: 'Brasília, DF',
        aceitaTroca: false,
        imagens: [
            'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=80',
            'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80',
        ],
        destaque: true,
        impulsionado: true,
        impulsionado_ate: '2026-04-01',
        prioridade: 9,
        modelo_3d: false,
        created_at: '2026-02-05T09:00:00Z',
        user_id: 'user3',
    },
    {
        id: '4',
        marca: 'Jeep',
        modelo: 'Compass Limited',
        ano: 2024,
        preco: 185900,
        quilometragem: 0,
        telefone: '(41) 96666-4444',
        descricao: 'Jeep Compass Limited 2024 0km. Diesel 4x4, pack premium com teto panorâmico e som Harman Kardon.',
        combustivel: 'Diesel',
        cambio: 'Automático',
        cor: 'Cinza',
        cidade: 'Curitiba, PR',
        aceitaTroca: true,
        imagens: [
            'https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5?w=800&q=80',
            'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&q=80',
        ],
        destaque: false,
        impulsionado: false,
        prioridade: 5,
        modelo_3d: false,
        created_at: '2026-02-12T16:00:00Z',
        user_id: 'user1',
    },
    {
        id: '5',
        marca: 'Volkswagen',
        modelo: 'Polo Track 1.0',
        ano: 2024,
        preco: 69990,
        quilometragem: 47132,
        telefone: '(51) 95555-5555',
        descricao: 'Volkswagen Polo Track 1.0 12V Flex. Ar-condicionado, comando de áudio e telefone no volante.',
        combustivel: 'Flex',
        cambio: 'Manual',
        cor: 'Prata',
        cidade: 'Porto Alegre, RS',
        aceitaTroca: true,
        imagens: [
            'https://images.unsplash.com/photo-1471479917193-f00955256257?w=800&q=80',
            'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&q=80',
        ],
        destaque: false,
        impulsionado: false,
        prioridade: 3,
        modelo_3d: false,
        created_at: '2026-02-14T11:00:00Z',
        user_id: 'user2',
    },
    {
        id: '6',
        marca: 'Hyundai',
        modelo: 'HB20 Comfort',
        ano: 2022,
        preco: 72000,
        quilometragem: 35000,
        telefone: '(11) 94444-6666',
        descricao: 'Hyundai HB20 Comfort Plus 1.0 2022. Câmera de ré, sensor de estacionamento, central multimídia.',
        combustivel: 'Flex',
        cambio: 'Manual',
        cor: 'Vermelho',
        cidade: 'São Paulo, SP',
        aceitaTroca: false,
        imagens: [
            'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&q=80',
            'https://images.unsplash.com/photo-1542362567-b07e54358753?w=800&q=80',
        ],
        destaque: false,
        impulsionado: false,
        prioridade: 2,
        modelo_3d: false,
        created_at: '2026-02-13T08:00:00Z',
        user_id: 'user3',
    },
    {
        id: '7',
        marca: 'Ford',
        modelo: 'Ranger XLT 3.2',
        ano: 2021,
        preco: 195000,
        quilometragem: 55000,
        telefone: '(62) 93333-7777',
        descricao: 'Ford Ranger XLT 3.2 Diesel 4x4 2021. Capota marítima, estribo lateral, multimídia SYNC 3.',
        combustivel: 'Diesel',
        cambio: 'Automático',
        cor: 'Branco',
        cidade: 'Goiânia, GO',
        aceitaTroca: true,
        imagens: [
            'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80',
            'https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=800&q=80',
        ],
        destaque: false,
        impulsionado: false,
        prioridade: 4,
        modelo_3d: false,
        created_at: '2026-02-11T12:30:00Z',
        user_id: 'user1',
    },
    {
        id: '8',
        marca: 'Mercedes-Benz',
        modelo: 'C200 Avantgarde',
        ano: 2023,
        preco: 320000,
        quilometragem: 15000,
        telefone: '(31) 92222-8888',
        descricao: 'Mercedes-Benz C200 Avantgarde 2023. Interior bege claro, MBUX, Head-Up Display, pacote AMG Line.',
        combustivel: 'Gasolina',
        cambio: 'Automático',
        cor: 'Preto',
        cidade: 'Belo Horizonte, MG',
        aceitaTroca: false,
        imagens: [
            'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800&q=80',
            'https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=800&q=80',
        ],
        destaque: false,
        impulsionado: false,
        prioridade: 6,
        modelo_3d: false,
        created_at: '2026-02-09T17:00:00Z',
        user_id: 'user2',
    },
];

export const brands = [
    // Brazilian
    'Agrale', 'Troller', 'Lobini', 'Puma', 'Miura',
    // German
    'Audi', 'BMW', 'Mercedes-Benz', 'Volkswagen', 'Porsche', 'Opel', 'Smart',
    // American
    'Chevrolet', 'Ford', 'Jeep', 'Dodge', 'Chrysler', 'RAM', 'Cadillac', 'Tesla', 'GMC',
    // Japanese
    'Toyota', 'Honda', 'Nissan', 'Mitsubishi', 'Suzuki', 'Subaru', 'Lexus', 'Infiniti', 'Acura',
    // Korean
    'Hyundai', 'Kia', 'SsangYong',
    // French
    'Renault', 'Peugeot', 'Citroën', 'DS',
    // Italian
    'Fiat', 'Ferrari', 'Lamborghini', 'Maserati', 'Alfa Romeo', 'Abarth',
    // Chinese
    'BYD', 'Caoa Chery', 'GWM', 'Great Wall', 'JAC Motors', 'Omoda', 'Jaecoo', 'Haval', 'Leapmotor', 'Geely', 'Changan',
    // Swedish
    'Volvo', 'Polestar', 'Saab',
    // British
    'Land Rover', 'Range Rover', 'Jaguar', 'Mini', 'Bentley', 'Rolls-Royce', 'Aston Martin', 'McLaren',
    // Spanish
    'SEAT', 'Cupra',
    // Romanian / Russian / others
    'Dacia', 'Lada', 'Daewoo',
].sort((a, b) => a.localeCompare(b, 'pt-BR'));

export const fuels = ['Flex', 'Gasolina', 'Diesel', 'Etanol', 'Híbrido', 'Elétrico'];
export const transmissions = ['Manual', 'Automático', 'CVT', 'Automatizado'];
