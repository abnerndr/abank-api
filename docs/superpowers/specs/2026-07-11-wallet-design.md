# Wallet (Carteira Financeira) — Design

Data: 2026-07-11

## Objetivo

Adicionar ao abank-api um domínio de carteira financeira: usuários depositam e transferem
saldo entre si, com validação de saldo, e qualquer depósito/transferência pode ser revertido
por um admin em caso de inconsistência.

Cadastro e autenticação **já existem** no projeto (register/login JWT, refresh, magic-link,
roles via CASL, `JwtAuthGuard` global com `@Public()` para opt-out) e não são alterados por
este design. O trabalho novo é inteiramente o módulo `wallet`.

## Decisões (respostas do brainstorming)

- Dinheiro: coluna `numeric(19,4)` no Postgres, aritmética em `decimal.js` no código (nunca
  `number` bruto), transporte via API como string (`"150.00"`).
- Reversão: ledger imutável + transação compensatória (nunca edita/apaga lançamento original).
- Concorrência: lock pessimista (`SELECT ... FOR UPDATE`) dentro de transação de banco.
- Quem reverte: apenas admin (via CASL `AbilitiesGuard`, reaproveitando o guard existente).
- Idempotência: header/campo `idempotencyKey` opcional em deposit/transfer.

## Arquitetura

Novo módulo `src/modules/wallet/`, seguindo a mesma estrutura dos módulos existentes
(`auth`, `users`, `roles`):

```
src/modules/wallet/
  wallet.module.ts
  wallet.controller.ts
  wallet.service.ts
  dto/
    deposit.dto.ts
    transfer.dto.ts
    wallet-response.dto.ts
    transaction-response.dto.ts
  exceptions/
    insufficient-balance.exception.ts
    wallet-not-found.exception.ts
    transaction-already-reversed.exception.ts
    self-transfer.exception.ts
    invalid-reversal-target.exception.ts
```

Entidades novas em `src/shared/entities/` (mesmo local das entidades atuais), adicionadas ao
array `entities` em `src/shared/entities/index.ts`.

Sem filtro de exceção global — mantém o padrão atual do projeto de lançar `HttpException`
(ou subclasses) diretamente do service.

Sem migrations formais — o projeto usa `synchronize: true` em desenvolvimento
(`src/config/database/database.config.ts`); as novas entidades seguem o mesmo mecanismo.

## Modelagem de dados

### Wallet (1:1 com User)

| coluna     | tipo                | notas                              |
|------------|---------------------|-------------------------------------|
| id         | uuid pk              | `uuid` v7, mesmo padrão de `User`  |
| userId     | uuid, unique fk      | 1 wallet por usuário                |
| balance    | numeric(19,4)        | default 0, **pode ser negativo**   |
| currency   | varchar              | default `'BRL'`                     |
| createdAt  | timestamp            |                                      |
| updatedAt  | timestamp            |                                      |

Sem criação automática no registro do usuário (não altera `AuthService.register`).
Criação **lazy**: `WalletService.getOrCreateWallet(userId)` faz upsert
(`ON CONFLICT (userId) DO NOTHING` + reselect), chamado no início de deposit/transfer/getMe.
Isso garante exatamente uma wallet por usuário mesmo sob concorrência, sem acoplar o módulo
wallet ao fluxo de cadastro.

### Transaction (cabeçalho de operação, append-only)

| coluna            | tipo                                   | notas                                    |
|-------------------|------------------------------------------|-------------------------------------------|
| id                | uuid pk                                  |                                             |
| type              | enum `DEPOSIT` \| `TRANSFER` \| `REVERSAL` |                                           |
| status            | enum `COMPLETED` \| `REVERSED`           | nunca `PENDING` — tudo roda em 1 tx DB     |
| amount            | numeric(19,4)                            | sempre positivo                            |
| fromWalletId      | uuid null, fk                             | null em `DEPOSIT`                          |
| toWalletId        | uuid null, fk                             | sempre setado (depósito e transferência credita alguém) |
| reversalOfId      | uuid null, self-fk                        | setado apenas quando `type = REVERSAL`     |
| requestedByUserId | uuid                                      | quem disparou (admin, no caso de reversão) |
| idempotencyKey    | varchar null                              | ver índice único abaixo                    |
| createdAt         | timestamp                                 |                                             |

Índice único: `(requestedByUserId, idempotencyKey)` quando `idempotencyKey is not null` —
retry com a mesma chave retorna a transação já processada em vez de reprocessar.

Nunca reverter uma transação `REVERSAL` (bloqueia dupla-reversão) nem uma já `REVERSED`.

### LedgerEntry (lançamento contábil imutável — double entry)

| coluna        | tipo                     | notas                                   |
|---------------|--------------------------|-------------------------------------------|
| id            | uuid pk                  |                                             |
| transactionId | uuid fk                  |                                             |
| walletId      | uuid fk                  |                                             |
| direction     | enum `DEBIT` \| `CREDIT` |                                             |
| amount        | numeric(19,4)            | sempre positivo                            |
| balanceAfter  | numeric(19,4)             | snapshot do saldo pós-lançamento, auditoria|
| createdAt     | timestamp                 |                                             |

`Wallet.balance` é a fonte operacional, mutada dentro da transação de banco com lock.
`LedgerEntry` é a trilha de auditoria imutável — em qualquer momento, somar os lançamentos de
uma wallet deve bater com `Wallet.balance` (propriedade útil pra um teste de integridade / uma
verificação de observabilidade, não é recalculada em toda leitura por custo de performance).

Alternativas descartadas: (a) só `Transaction` com saldo cacheado, sem ledger por perna —
mais simples mas perde granularidade de auditoria por wallet; (b) event-sourcing puro sem
coluna de saldo cacheada — mais rigoroso mas exige somar o ledger inteiro (ou materializar uma
projeção) a cada leitura de saldo, over-engineering para o escopo do desafio.

## Fluxos

### Deposit

1. Se `idempotencyKey` informado, busca `Transaction` existente com
   `(requestedByUserId=userId, idempotencyKey)`; se achar, retorna ela (sem reprocessar).
2. `getOrCreateWallet(userId)`.
3. Inicia transação DB, `SELECT ... FOR UPDATE` na wallet.
4. `newBalance = balance + amount` (decimal.js). Sem piso — soma mesmo se `balance < 0`.
5. Salva wallet, insere `Transaction{type: DEPOSIT, status: COMPLETED, toWalletId}` e
   `LedgerEntry{direction: CREDIT, balanceAfter: newBalance}`.
6. Commit.

### Transfer

1. Idempotency check (mesmo mecanismo do deposit).
2. Resolve wallet de origem (`getOrCreateWallet(userId)`) e de destino a partir do e-mail do
   destinatário (`UsersService.findByEmail` + `getOrCreateWallet`). Destinatário inexistente →
   404. Origem == destino → `SelfTransferException`.
3. Inicia transação DB, `SELECT ... FOR UPDATE` nas duas wallets **em ordem determinística por
   id** (menor id primeiro) — evita deadlock entre transferências concorrentes em sentidos
   opostos.
4. Se `origem.balance < amount` → `InsufficientBalanceException`.
5. Debita origem, credita destino.
6. Insere `Transaction{type: TRANSFER, status: COMPLETED, fromWalletId, toWalletId}` e 2
   `LedgerEntry` (`DEBIT` origem, `CREDIT` destino), cada um com seu `balanceAfter`.
7. Commit.

### Reverse (admin only)

1. Guard: `AbilitiesGuard` + `@CheckAbilities({action: MANAGE, subject: Resource.TRANSACTION})`
   — reaproveita o `CaslAbilityFactory` existente. Role `admin` já tem `MANAGE all` no seed
   atual; roles sem essa permissão recebem 403 automaticamente.
2. Carrega `Transaction` original por id. Não existe → 404. `type = REVERSAL` ou
   `status = REVERSED` → `TransactionAlreadyReversedException`.
3. Inicia transação DB, `SELECT ... FOR UPDATE` na(s) wallet(s) envolvida(s) (mesma ordem
   determinística).
4. Aplica movimento inverso **sem checar saldo suficiente**:
   - reversão de `DEPOSIT`: debita `toWallet` em `amount`.
   - reversão de `TRANSFER`: credita `fromWallet` em `amount`, debita `toWallet` em `amount`.

   Isso é deliberado: é o caso do requisito "saldo negativo por algum motivo" — se B já gastou
   o dinheiro recebido de A antes da reversão, a wallet de B fica negativa (dívida real
   registrada), e um depósito futuro nela soma normalmente a partir do negativo, sem zerar.
5. Insere `Transaction{type: REVERSAL, reversalOfId: original.id, requestedByUserId: adminId}`
   com from/to invertidos em relação à original — reversão de `TRANSFER`:
   `fromWalletId = original.toWalletId`, `toWalletId = original.fromWalletId`; reversão de
   `DEPOSIT`: `fromWalletId = original.toWalletId`, `toWalletId = null` (dinheiro sai do
   sistema) — e os `LedgerEntry` correspondentes.
6. Marca `original.status = REVERSED`.
7. Commit.

Toda operação roda dentro de uma única transação de banco — falha no meio faz rollback
automático (não é necessário acionar reversão explícita para inconsistência transiente; a
reversão explícita serve para desfazer algo que já concluiu com sucesso).

## Endpoints

```
GET  /api/wallet/me                          — saldo e dados da própria wallet
GET  /api/wallet/transactions                — histórico paginado (próprias transações)
GET  /api/wallet/transactions/:id            — detalhe (participante ou admin)
POST /api/wallet/deposit                     — { amount, idempotencyKey? }
POST /api/wallet/transfer                    — { toEmail, amount, idempotencyKey? }
POST /api/wallet/transactions/:id/reverse    — admin only
```

Todos sob o `JwtAuthGuard` global já existente (nenhum é `@Public()`).

`amount` trafega como string no request/response (evita erro de ponto flutuante na
serialização JSON); validado por um `class-validator` custom (regex decimal, > 0) e convertido
para `Decimal` (decimal.js) na entrada do service. Colunas `numeric` usam um TypeORM column
transformer que converte `string ⇄ Decimal` automaticamente.

## Erros

Subclasses de `HttpException` do Nest, mesmo estilo do `AuthService` atual (lançadas
diretamente do service, sem filtro global):

- `InsufficientBalanceException` → 400
- `WalletNotFoundException` → 404
- `TransactionAlreadyReversedException` → 409
- `SelfTransferException` → 400
- `InvalidReversalTargetException` → 400 (tentativa de reverter algo que não é `DEPOSIT`/`TRANSFER` `COMPLETED`)

## Testes

- **Unit** (`wallet.service.spec.ts`): regras puras contra repositório mockado — saldo
  insuficiente, self-transfer, dupla-reversão, replay de idempotency key, reversão de deposit
  vs. transfer.
- **Integration** (`test/wallet.e2e-spec.ts`, contra Postgres real do `docker-compose.yml`
  já existente): ciclo completo deposit → transfer → reverse via HTTP; duas transferências
  concorrentes disputando o mesmo saldo (valida o lock pessimista); reversão que deixa saldo
  negativo seguida de novo depósito.

## Observabilidade (diferencial, não bloqueante)

`Logger` do Nest em cada operação do `WalletService` (transactionId, userId, tipo, valor —
sem dado sensível). Sem infraestrutura nova (sem tracing/metrics stack) — fora do escopo de
tempo do desafio; mencionado como próximo passo natural dado que o ledger já produz os dados
necessários para métricas de volume/reversão.
