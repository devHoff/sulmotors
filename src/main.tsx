import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { LanguageProvider } from './contexts/LanguageContext'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ThemeProvider>
            <LanguageProvider>
                <AuthProvider>
                    <BrowserRouter>
                        <App />
                        <Toaster
                            position="top-right"
                            richColors
                            closeButton
                            duration={4000}
                            toastOptions={{
                                style: {
                                    borderRadius: '14px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    padding: '14px 16px',
                                    gap: '10px',
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    backdropFilter: 'blur(12px)',
                                },
                            }}
                        />
                    </BrowserRouter>
                </AuthProvider>
            </LanguageProvider>
        </ThemeProvider>
    </StrictMode>,
)
