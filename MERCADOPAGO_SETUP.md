# SulMotor — Mercado Pago Setup

## 1. Criar tabela `pagamentos` no Supabase

Acesse o **SQL Editor** do seu projeto Supabase e execute o conteúdo do arquivo:
```
supabase/migrations/20260308_create_pagamentos.sql
```

## 2. Deploy das Edge Functions

```bash
# Instale o Supabase CLI se necessário
npm install -g supabase

# Faça login
supabase login

# Link ao projeto (pegue o ref em Settings > General)
supabase link --project-ref imkzkvlktrixaxougqie

# Deploy das funções
supabase functions deploy create-mp-preference
supabase functions deploy mp-webhook
```

## 3. Configurar segredos (Secrets)

```bash
# Token do Mercado Pago (Credenciais > Produção ou Sandbox)
supabase secrets set MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxxx

# URL do front-end para os back_urls de redirecionamento
supabase secrets set APP_URL=https://sulmotors.com.br
```

> **Sandbox (testes):** Use um token que comece com `TEST-` para testes.
> Nesse caso o checkout abre na URL `sandbox.mercadopago.com.br`.

## 4. Cadastrar o Webhook no Mercado Pago

1. Acesse [mercadopago.com.br/developers](https://www.mercadopago.com.br/developers)
2. Vá em **Suas integrações → Notificações → Webhook**
3. Adicione a URL:
   ```
   https://imkzkvlktrixaxougqie.supabase.co/functions/v1/mp-webhook
   ```
4. Selecione o evento: **Pagamentos (`payment`)**

## 5. Fluxo completo

```
Usuário clica "Impulsionar por R$ xx"
    → Edge function create-mp-preference cria preferência no MP
    → Salva pagamento com status 'pendente' na tabela pagamentos
    → Retorna preference_id + init_point (URL do checkout MP)

Modal exibe resumo + botão "Ir para o Mercado Pago"
    → Abre o Checkout Pro do MP em nova aba
    → Usuário paga via PIX / cartão

Mercado Pago envia POST para mp-webhook
    → Busca detalhes do pagamento na API MP
    → Atualiza status em pagamentos
    → Se approved → ativa boost no anúncio (impulsionado=true, destaque=true, prioridade=5)

MP redireciona para /impulsionar/sucesso?pagamento_id=xxx
    → Página exibe status (approved / pending / rejected)
    → Botão "Verificar status novamente" para PIX que demora alguns segundos
```

## 6. Obter credenciais do Mercado Pago

1. Acesse [mercadopago.com.br/developers/panel/app](https://www.mercadopago.com.br/developers/panel/app)
2. Crie uma aplicação (tipo: Online payments, modelo: Marketplace/e-commerce)
3. Em **Credenciais de produção**, copie o `Access Token`
4. Para testes, use as **Credenciais de teste** (começa com `TEST-`)
