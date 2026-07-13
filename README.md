<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## ABank — Teste técnico

Solução completa de carteira digital em três repositórios:

| Repositório | Papel |
|-------------|-------|
| **abank-api** (este) | API NestJS + Postgres — auth, wallet, ledger |
| **abank-app** | App cliente Next.js + Server Actions |
| **abank-backoffice** | Painel admin — usuários, estornos, transações |

**Guias de apresentação:**

- [`docs/DEMO.md`](docs/DEMO.md) — roteiro de demonstração passo a passo
- [`docs/REVERSAL.md`](docs/REVERSAL.md) — como a reversão atende "por solicitação do usuário"

**Stack e justificativa:** NestJS (modularidade, DI, guards), Fastify (performance), TypeORM
(transações ACID), Postgres, `decimal.js` (dinheiro sem float), CASL (autorização), double-entry
ledger (auditoria). Frontends em Next.js com Server Actions para JWT em cookies httpOnly.

```bash
docker compose up -d    # Postgres (+ API com serviço api)
pnpm seed               # admin + contas alice/bob
pnpm start:dev          # API
```

## Wallet

Financial wallet domain: deposit, transfer between users, and admin-only reversal, built on top
of the existing auth/users infrastructure. Full design rationale in
`docs/superpowers/specs/2026-07-11-wallet-design.md`.

### Architecture

- **One wallet per user (`BRL`), created lazily** on first access rather than at registration, so
  the module stays decoupled from `AuthService.register`. The insert uses `orIgnore()`, making two
  concurrent first-accesses safe (one wins, the other is a no-op, both re-select the same row).
- **Money is never a JS `number`.** It is a `Decimal` (`decimal.js`) in code, a `numeric(19,4)`
  column in Postgres (via `decimalTransformer`), and a string on the wire (e.g. `"150.00"`).
  Request amounts are validated by `IsPositiveDecimalString` (a positive decimal string with up to
  4 fractional digits and up to 15 integer digits, matching the column scale/precision).
- **Double-entry ledger.** Every deposit, transfer and reversal writes one `Transaction` (the
  business record) plus one immutable `LedgerEntry` per affected wallet (the audit trail).
  `Wallet.balance` is only ever mutated inside these flows.
- **Concurrency.** Each operation runs inside a single `dataSource.transaction()` with
  `pessimistic_write` (`SELECT … FOR UPDATE`) row locks on every wallet it touches, so concurrent
  transfers on the same balance can't overdraw it. When two wallets are locked (transfer, reversal)
  they are always locked in a deterministic order — sorted by the **owning user's id** — so two
  operations touching the same pair in opposite directions can never deadlock against each other.
- **Idempotency.** `deposit`/`transfer` require an `idempotencyKey`, unique per requesting
  user **and operation type** (`DEPOSIT` vs `TRANSFER` — same key string can be reused across
  different operation types). Re-sending the same key replays the already-processed transaction
  instead of reprocessing. Under a race, the losing insert is caught by inspecting the Postgres
  error (`code === '23505'` + the offending column in `error.detail`, not `error.message`) and the
  original transaction is returned.
- **Reversal is admin-only** (`AbilitiesGuard` + CASL `manage all`, the same mechanism the roles
  module uses) and **never fails for insufficient balance**: reversing a transfer whose recipient
  already spent the funds is expected to push their wallet negative — a later deposit simply adds on
  top of that negative balance. A partial unique index on `reversalOfId` is the DB-level backstop
  against double-reversal: two concurrent reversals of the same transaction yield one `200` and one
  `409`. User-initiated reversal is modeled as an **operational flow**: the customer reports the
  issue, an admin executes the reversal in the backoffice (`/estornos`). See `docs/REVERSAL.md`.
- **`:id` routes use `ParseUUIDPipe`**, returning a clean `400` for a malformed id instead of a raw
  500 from a Postgres cast error (this app has no global exception filter).
- **Transaction visibility.** `GET /api/wallet/transactions/:id` is allowed for an admin or a
  *participant* — the user who requested it, or the owner of the source/destination wallet. The
  requester keeps read access **permanently**, even after losing a role: an admin who performed a
  reversal can still view that reversal after being demoted (audit-trail semantics — the role gates
  performing new admin actions, not seeing the ones already taken). See `wallet-rules.ts`.

### Endpoints

All routes sit behind the global JWT guard (`Authorization: Bearer <token>`).

| Method | Path                                    | Description                                     |
|--------|-----------------------------------------|-------------------------------------------------|
| GET    | `/api/wallet/me`                        | Own wallet balance                              |
| GET    | `/api/wallet/transactions`              | Own transaction history (paginated)             |
| GET    | `/api/wallet/transactions/:id`          | Transaction detail (participant or admin)       |
| POST   | `/api/wallet/deposit`                   | Deposit into own wallet                         |
| POST   | `/api/wallet/transfer`                  | Transfer to another user's wallet, by email     |
| POST   | `/api/wallet/transactions/:id/reverse`  | Reverse a completed deposit/transfer (admin)    |

Interactive API docs are served at `/docs`.

### Examples

The server listens on `PORT` (default `3000`). Adjust the host/port below to your `.env`.

```bash
# Deposit (idempotencyKey required — replays instead of double-charging)
curl -X POST http://localhost:3000/api/wallet/deposit \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"amount": "150.00", "idempotencyKey": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"}'

# Transfer to another user by email (idempotencyKey required)
curl -X POST http://localhost:3000/api/wallet/transfer \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"toEmail": "recipient@example.com", "amount": "40.00", "idempotencyKey": "b2c3d4e5-f6a7-8901-bcde-f12345678901"}'

# List own transactions (paginated)
curl "http://localhost:3000/api/wallet/transactions?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"

# Reverse a transaction (admin token required)
curl -X POST http://localhost:3000/api/wallet/transactions/<transaction-id>/reverse \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Testing

- `pnpm test` — unit tests for the pure domain rules (`src/modules/wallet/wallet-rules.spec.ts`:
  balance sufficiency, self-transfer, reversal eligibility, reversal wallet-id computation,
  participant check) and money primitives (`decimal.transformer.spec.ts`,
  `is-positive-decimal-string.validator.spec.ts`).
- `pnpm test:e2e` — integration tests (`test/wallet.e2e-spec.ts`, `test/app.e2e-spec.ts`) against a
  real Postgres (`docker compose up -d` first, with `DATABASE_URL` matching `docker-compose.yml`).
  They boot the full `AppModule` and cover the deposit → transfer → reverse lifecycle plus the
  tricky paths: concurrent transfers, opposite-direction deadlock avoidance, idempotent-retry
  races, double-reversal races, and the authorization rules (including reversal-viewer permanence
  after role revocation).

### Docker

```bash
# Postgres only (desenvolvimento local com pnpm start:dev)
docker compose up -d db

# Postgres + API containerizada
docker compose up -d --build
```

The `api` service uses `NODE_ENV=development` with `synchronize` enabled against the local Docker
Postgres — suitable for demos. For production, run migrations and set `NODE_ENV=production`.

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
