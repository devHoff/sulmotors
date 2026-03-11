import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { LanguageProvider } from './contexts/LanguageContext'
import { ToastProvider } from './contexts/ToastContext'
import ToastContainer from './components/ToastContainer'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ThemeProvider>
            <LanguageProvider>
                <AuthProvider>
                    <ToastProvider>
                        <BrowserRouter>
                            <App />
                            <ToastContainer />
                        </BrowserRouter>
                    </ToastProvider>
                </AuthProvider>
            </LanguageProvider>
        </ThemeProvider>
    </StrictMode>,
)
