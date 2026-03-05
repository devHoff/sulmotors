/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    50: '#f0feff',
                    100: '#ccfbff',
                    200: '#99f5ff',
                    300: '#4aebff',
                    400: '#00d4ff',
                    500: '#00b8e6',
                    600: '#0094c4',
                    700: '#00789e',
                    800: '#006280',
                    900: '#004d65',
                    950: '#00263a',
                },
                zinc: {
                    850: '#1a1a1a',
                    950: '#0a0a0a',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                display: ['Inter', 'system-ui', 'sans-serif'],
            },
            backgroundImage: {
                'grid-pattern': "linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)",
                'radial-glow': "radial-gradient(ellipse at center, rgba(0,212,255,0.15) 0%, transparent 70%)",
            },
            backgroundSize: {
                'grid': '40px 40px',
            },
            animation: {
                'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'float': 'float 6s ease-in-out infinite',
                'shimmer': 'shimmer 2s linear infinite',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
            },
            boxShadow: {
                'glow': '0 0 20px rgba(0, 212, 255, 0.3)',
                'glow-lg': '0 0 40px rgba(0, 212, 255, 0.4)',
                'inner-glow': 'inset 0 1px 0 rgba(255,255,255,0.1)',
            },
        },
    },
    plugins: [],
}
