# Roteiro de demonstração — ABank

Guia para apresentar a solução do teste técnico em ~15 minutos.

## Pré-requisitos

```bash
# Terminal 1 — API + banco
cd abank-api
docker compose up -d          # Postgres (+ API se usar profile completo)
pnpm install
pnpm seed                     # roles, admin, alice@abank.dev, bob@abank.dev
pnpm start:dev                # http://localhost:8000 — ajuste PORT no .env

# Terminal 2 — App cliente
cd abank-app
pnpm install && pnpm dev      # http://localhost:3000

# Terminal 3 — Backoffice
cd abank-backoffice
pnpm install && pnpm dev      # http://localhost:3001 (ou porta configurada)
```

**Contas de teste (seed):**

| E-mail | Senha | Saldo inicial |
|--------|-------|---------------|
| `alice@abank.dev` | `Test123!` | R$ 1.000,00 |
| `bob@abank.dev` | `Test123!` | R$ 500,00 |
| Admin (`.env`) | conforme `ADMIN_EMAIL` / `ADMIN_PASSWORD` | — |

Documentação interativa da API: `http://localhost:8000/docs`

---

## 1. Fluxo feliz (5 min)

**Objetivo:** cadastro, auth, depósito, transferência, histórico.

1. Abrir **abank-app** → login como `alice@abank.dev`
2. Mostrar saldo na visão geral (R$ 1.000,00)
3. **Depositar** R$ 50,00 → saldo atualiza
4. **Transferir** R$ 100,00 para `bob@abank.dev`
   - Destacar preview "Saldo após envio"
   - Botão bloqueado se saldo insuficiente
5. Abrir **Histórico** → transações de depósito e transferência
6. (Opcional) Login como Bob → ver `transfer_in` no histórico

**Pontos a mencionar:** Server Actions, cookies httpOnly, idempotency key gerada server-side.

---

## 2. Validação de saldo (2 min)

**Objetivo:** regra de negócio no servidor.

1. Login como Alice com saldo baixo (ou transferir quase tudo antes)
2. Tentar transferir valor **maior que o saldo**
3. UI mostra alerta vermelho + botão desabilitado
4. Se forçar via API/curl → `400 Saldo insuficiente`

```bash
curl -X POST http://localhost:8000/api/wallet/transfer \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"toEmail":"bob@abank.dev","amount":"99999.00"}'
```

**Argumento:** regra crítica no backend; UI é camada de prevenção, não a fonte da verdade.

---

## 3. Reversão por solicitação do usuário (4 min)

**Objetivo:** fluxo admin atendendo pedido do cliente.

1. Cenário narrado: *"Alice transferiu por engano → abre chamado → admin estorna"*
2. Login no **backoffice** com conta admin
3. Ir em **Estornos** → localizar transferência de Alice
4. Clicar **Aprovar** → confirmar
5. Voltar ao app como Alice/Bob → transação marcada como **Revertida**
6. Mostrar saldos restaurados

**Argumento:** ver [`docs/REVERSAL.md`](./REVERSAL.md) — padrão bancário disputa → operador.

---

## 4. Saldo negativo + depósito (3 min)

**Objetivo:** requisito "saldo negativo, depósito soma ao valor".

1. Alice transfere R$ 200 para Bob
2. Bob transfere R$ 200 para Alice (gasta o que recebeu)
3. Admin **reverte** a transferência original Alice→Bob no backoffice
4. Saldo de Bob fica **negativo** (dívida registrada)
5. Bob faz **depósito** de R$ 50 → saldo = negativo + 50 (não zera arbitrariamente)

**Evidência automatizada:** `pnpm test:e2e` — casos de saldo negativo e reversão pós-gasto.

---

## 5. Arquitetura e qualidade (1 min)

Destaques para fechar:

| Tópico | Onde mostrar |
|--------|--------------|
| Double-entry ledger | `LedgerEntry` + `Transaction` |
| Concorrência | locks `FOR UPDATE`, ordem anti-deadlock |
| Idempotência | `idempotencyKey` no deposit/transfer |
| Testes | 25 e2e em `test/wallet.e2e-spec.ts` |
| Segurança | JWT + CASL + bcrypt + Decimal |
| Docker | `docker compose up` (Postgres + API) |

---

## Gaps transparentes (se perguntarem)

- Reversão self-service (dispute endpoint) — evolução natural, ver `REVERSAL.md`
- Observabilidade — logs Fastify básicos; health/métricas em produção
- Testes nos frontends — schemas/actions seriam o próximo passo
- Verificação de e-mail — fluxo existe na API; demo usa contas já verificadas do seed
