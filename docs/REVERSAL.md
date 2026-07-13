# Reversão de transações — decisão de design

## Requisito do teste técnico

> A operação de transferência ou depósito deve ser passível de reversão em qualquer caso de
> inconsistência **ou por solicitação do usuário**.

## Como foi implementado

A ABank atende esse requisito em **dois níveis**:

### 1. Reversão por inconsistência (automática)

Toda operação financeira roda dentro de uma **única transação de banco** (`dataSource.transaction()`).
Se qualquer passo falhar (saldo, lock, constraint), o Postgres faz **rollback automático** — nenhum
saldo ou lançamento parcial permanece.

Após o commit bem-sucedido, inconsistências operacionais são corrigidas via **reversão explícita**
(`POST /api/wallet/transactions/:id/reverse`), que:

- Cria uma `Transaction` do tipo `REVERSAL` com ledger compensatório (`LedgerEntry`)
- Marca a transação original como `REVERSED`
- Impede dupla reversão (regra de domínio + índice único em `reversalOfId`)
- **Não exige saldo suficiente** no destinatário — saldo negativo é registrado como dívida real

### 2. Reversão por solicitação do usuário (fluxo operacional)

Em produção bancária, o usuário **não reverte dinheiro sozinho** — ele abre uma disputa e um operador
executa o estorno após análise. A ABank modela exatamente isso:

```text
Usuário identifica problema
        ↓
Contata suporte / admin (canal externo ao MVP)
        ↓
Admin acessa o backoffice → /estornos
        ↓
Revisa transação elegível (DEPOSIT ou TRANSFER concluída)
        ↓
Aprova estorno → API executa reverse()
        ↓
Ambas as carteiras e o ledger são atualizados atomicamente
```

**Onde ver na solução:**

| Camada | Artefato |
|--------|----------|
| API | `POST /api/wallet/transactions/:id/reverse` — protegido por CASL (`manage all`) |
| Backoffice | Página `/estornos` com tabela, confirmação e execução |
| App (admin) | Botão de reversão no histórico para usuários com role `admin` |
| Testes | E2E cobre 403 para não-admin, race 200/409, deposit, transfer com saldo negativo |

## Por que não há self-service?

Um endpoint `POST /transactions/:id/dispute` pelo usuário comum seria o próximo passo natural:

1. Usuário registra solicitação (status `PENDING`)
2. Fila aparece no backoffice `/estornos`
3. Admin aprova ou rejeita

Para o escopo do teste técnico, o fluxo **usuário solicita → admin executa** foi condensado no
backoffice, evitando over-engineering de fila/tickets sem valor demonstrável na avaliação.

## Argumento para a entrevista

> "Interpretamos 'por solicitação do usuário' como o fluxo operacional real de um banco digital:
> o cliente reporta o problema, e o operador autorizado reverte via backoffice. A API garante
> atomicidade, auditoria via ledger e proteção contra dupla reversão. Self-service de estorno
> seria um risco de fraude — por isso a operação exige role admin com CASL."

## Evolução em produção

- `POST /api/wallet/transactions/:id/dispute` — usuário abre solicitação
- Entidade `DisputeRequest` com status `PENDING | APPROVED | REJECTED`
- Notificação ao admin (e-mail/webhook)
- SLA e trilha de auditoria ligando disputa → reversão
