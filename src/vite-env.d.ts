/// <reference types="vite/client" />

// ── Mercado Pago SDK global types ─────────────────────────────────────────────
interface MercadoPagoConstructor {
    new (publicKey: string, options?: Record<string, unknown>): MercadoPagoInstance;
}

interface MercadoPagoInstance {
    createCardToken(params: {
        cardNumber:           string;
        cardholderName:       string;
        cardExpirationMonth:  string;
        cardExpirationYear:   string;
        securityCode:         string;
        identificationType:   string;
        identificationNumber: string;
    }): Promise<{ id?: string; cause?: Array<{ description?: string; code?: string }> } | null>;
}

interface Window {
    MercadoPago: MercadoPagoConstructor | undefined;
}
