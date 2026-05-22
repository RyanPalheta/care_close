# Web Push Notifications — Setup

Como ativar as notificações push do Care Close em produção.

---

## ✅ O que foi implementado

- **Tabela `push_subscriptions`** no Supabase (armazena endpoint + chaves de cada dispositivo)
- **Endpoint `POST /api/push/subscribe`** que salva a subscription do usuário
- **Cron worker `/api/cron/send-med-notifications`** que roda a cada 5 min, busca medicamentos próximos e dispara push via VAPID
- **`lib/push-notifications.ts`** reescrito pra usar o fluxo VAPID real
- **Vercel Cron** configurado em `vercel.json`

---

## 🚀 Passo a passo para produção

### 1. Rodar a migração SQL

No Supabase Dashboard → SQL Editor, cole o conteúdo de:

```
supabase/migrations/20260522_push_subscriptions.sql
```

Clique em **Run**. Vai criar a tabela `push_subscriptions` e adicionar a coluna `notification_sent_at` em `medication_schedules`.

---

### 2. Configurar variáveis de ambiente na Vercel

`Vercel Dashboard → seu projeto → Settings → Environment Variables`

Adicione (estão todas no `.env.local`):

| Nome | Valor |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `BL6N7mEgp5Y_PJPgPygd8_XqiduqINHUFMF-VoUC-ErjubgATOxT0cSGRAVKxXMCRaZvWC5bTzaf4PmBFJB7JZk` |
| `VAPID_PRIVATE_KEY` | `aD1gPemPwJ8qBX48HfBbCzJvPusWeYpfcDthDGIJuO0` |
| `VAPID_SUBJECT` | `mailto:contato@appcareclose.com` |
| `CRON_SECRET` | `a081d9ccde65e32f5d7dce97d6f44146474b1eccaf073cc0ab290a1ff9f2c13b` |

> ⚠️ Não compartilhe a `VAPID_PRIVATE_KEY` em público.

Marque os 3 ambientes: **Production**, **Preview**, **Development**.

---

### 3. Verificar o Vercel Cron

Após o próximo deploy, abra:

`Vercel Dashboard → seu projeto → Cron Jobs`

Você verá:
```
/api/cron/send-med-notifications    */5 * * * *    (a cada 5 min)
```

> 💡 **Vercel Hobby** limita cron a 1×/dia. Se você está no Hobby, use a alternativa abaixo (gratuita e ilimitada).

---

### 4. Alternativa: cron-job.org (gratuito, ilimitado)

Caso o plano da Vercel não permita 5 min:

1. Acesse [cron-job.org](https://cron-job.org) → crie conta grátis
2. **Create cronjob**:
   - URL: `https://care-close.vercel.app/api/cron/send-med-notifications`
   - Schedule: a cada 5 minutos
   - HTTP Headers: `x-cron-secret: a081d9ccde65e32f5d7dce97d6f44146474b1eccaf073cc0ab290a1ff9f2c13b`
3. Salve.

---

## 🧪 Como testar

1. Abra o app (Chrome no Android, ou Chrome desktop)
2. Vá em **Notificações** → clique em **Ativar**
3. Aceite a permissão do navegador
4. Clique em **Testar** → deve aparecer uma notificação imediata
5. Cadastre um medicamento com horário ~10 min no futuro
6. Defina a antecedência pra 5 min
7. **Feche o app/lockscreen** e aguarde
8. ~5 min antes do horário → notificação chega 🔔

---

## 📱 iOS — o que esperar

iOS Safari só suporta Web Push se o **PWA estiver instalado na tela inicial** (iOS 16.4+).

Fluxo do usuário iPhone:
1. Abre `care-close.vercel.app` no Safari
2. Compartilhar → "Adicionar à Tela de Início"
3. Abre o app **pela tela inicial** (não pelo Safari)
4. Aí pode ativar notificações normalmente

O `InstallPrompt.tsx` já mostra esse guia automaticamente em iOS.

---

## 🐛 Troubleshooting

**Não recebo notificações em background**
- Verifique se o cron está rodando: `Vercel → Logs → Functions → send-med-notifications`
- Confirme que a subscription foi salva: `Supabase → push_subscriptions` (deve ter linha sua)
- Cheque permissão: `chrome://settings/content/notifications`

**Erro 401 no cron**
- A variável `CRON_SECRET` na Vercel está diferente da que está sendo enviada

**Push retorna 410 Gone**
- Subscription expirou. O cron já apaga essas automaticamente.

**iPhone não recebe**
- O usuário abriu o app no Safari em vez de pela tela inicial?
- iOS < 16.4 não suporta Web Push de jeito nenhum.
