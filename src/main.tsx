import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { LanguageProvider, useLanguage, _registerTFn } from './contexts/LanguageContext'
import { ToastProvider } from './contexts/ToastContext'
import { NotificationProvider } from './contexts/NotificationContext'
import ToastContainer from './components/ToastContainer'
import App from './App'
import './index.css'

/** Registers the live t() function into the singleton bridge so utils/toast.ts can use it */
function LanguageBridge() {
    const { t } = useLanguage();
    useEffect(() => { _registerTFn(t); }, [t]);
    return null;
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ThemeProvider>
            <LanguageProvider>
                <LanguageBridge />
                <AuthProvider>
                    <ToastProvider>
                        <NotificationProvider>
                            <BrowserRouter>
                                <App />
                                <ToastContainer />
                            </BrowserRouter>
                        </NotificationProvider>
                    </ToastProvider>
                </AuthProvider>
            </LanguageProvider>
        </ThemeProvider>
    </StrictMode>,
)
