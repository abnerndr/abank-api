# ABank API

Backend REST da solução **ABank** — carteira digital com autenticação JWT, gestão de usuários, operações financeiras (depósito, transferência, estorno), solicitações de estorno e notificações.

Este repositório é a **fonte de verdade** do sistema. Os frontends [`abank-app`](../abank-app) e [`abank-backoffice`](../abank-backoffice) consomem esta API.

---

## Stack tecnológica

| Camada | Tecnologia |
|--------|------------|
| Framework | NestJS 11 |
| HTTP | Fastify 5 |
| ORM | TypeORM |
| Banco | PostgreSQL 14 |
| Auth | JWT, Passport, CASL (autorização) |
| Dinheiro | `decimal.js` + coluna `numeric(19,4)` |
| Docs | Swagger / Scalar em `/docs` |
| E-mail | SendGrid (opcional) |

---

## Pré-requisitos

- **Node.js** >= 20 (recomendado 20 LTS ou superior)
- **pnpm** (gerenciador usado neste projeto — `pnpm-lock.yaml`)
- **Docker** e **Docker Compose** (para PostgreSQL local)
- **WSL2** (Ubuntu): os projetos ficam em `/home/abner/www/abnerndr/`. Execute os comandos dentro do WSL, não no PowerShell do Windows, para evitar problemas de path e performance do filesystem.

---

## Configuração

### 1. Clonar e instalar dependências

```bash
cd /home/abner/www/abnerndr/abank-api
pnpm install
```

### 2. Variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env` com os valores mínimos para desenvolvimento local:

| Variável | Descrição | Valor sugerido (local) |
|----------|-----------|------------------------|
| `PORT` | Porta da API | `8000` |
| `NODE_ENV` | Ambiente | `development` |
| `DATABASE_URL` | Conexão Postgres | `postgresql://root:123456@localhost:5432/postgres` |
| `JWT_SECRET` | Segredo do access token | string aleatória (ex.: `dev-jwt-secret`) |
| `JWT_REFRESH_SECRET` | Segredo do refresh token | string aleatória |
| `ADMIN_EMAIL` | E-mail do admin (seed) | `admin@example.com` |
| `ADMIN_PASSWORD` | Senha do admin (seed) | `admin123` |
| `FRONTEND_URL` | URL do app cliente (CORS/e-mail) | `http://localhost:3000` |

Variáveis opcionais: `GOOGLE_*` (OAuth), `SENDGRID_*` (e-mail), `APP_URL`, `BACKOFFICE_URL`.

> **Importante:** use `PORT=8000` para alinhar com os frontends (`NEXT_PUBLIC_API_URL=http://localhost:8000`). O `docker-compose.yml` também expõe a API na porta **8000**.

### 3. Subir o PostgreSQL

```bash
docker compose up -d db
```

Credenciais do container (definidas no `docker-compose.yml`):

- **Usuário:** `root`
- **Senha:** `123456`
- **Banco:** `postgres`
- **Porta:** `5432`

### 4. Popular o banco (seed)

```bash
pnpm seed
```

Cria roles/permissões, usuário admin, usuários de teste (Alice/Bob) e saldos iniciais nas carteiras.

---

## Como rodar

### Desenvolvimento (watch mode)

```bash
pnpm start:dev
```

### Produção

```bash
pnpm build
pnpm start:prod
```

### Docker (Postgres + API containerizada)

```bash
docker compose up -d --build
```

### Testes

```bash
# Unitários
pnpm test

# E2E (requer Postgres rodando)
pnpm test:e2e

# Cobertura
pnpm test:cov
```

### Lint e formatação

```bash
pnpm lint
pnpm format
```

---

## Portas e URLs

| Serviço | URL padrão |
|---------|------------|
| API REST | http://localhost:8000 |
| Documentação interativa | http://localhost:8000/docs |
| PostgreSQL | localhost:5432 |

Prefixo global das rotas: `/api`.

---

## Credenciais de teste (seed)

| Papel | E-mail | Senha | Observação |
|-------|--------|-------|------------|
| **Admin** | `admin@example.com` | `admin123` | Definidos em `ADMIN_EMAIL` / `ADMIN_PASSWORD` no `.env` |
| **Usuária** | `alice@abank.dev` | `Test123!` | Saldo inicial: **R$ 1.000,00** |
| **Usuário** | `bob@abank.dev` | `Test123!` | Saldo inicial: **R$ 500,00** |

Use o admin no **backoffice**; Alice e Bob no **app cliente**.

---

## Funcionalidades principais

### Autenticação e usuários
- Registro, login, refresh token, logout
- Recuperação e alteração de senha
- Verificação de e-mail
- CRUD de usuários com roles (admin/user) e permissões CASL

### Carteira (wallet)
- Uma carteira BRL por usuário (criada sob demanda)
- **Depósito** e **transferência** entre usuários (por e-mail)
- **Estorno** de depósitos/transferências (somente admin)
- Ledger de dupla entrada para auditoria
- Idempotência via `idempotencyKey`
- Concorrência segura com locks pessimistas

### Solicitações de estorno
- Usuário abre solicitação sobre uma transação
- Admin aprova ou rejeita pelo backoffice

### Notificações
- Notificações in-app (ex.: transferência recebida)
- Contagem de não lidas, marcar como lida

---

## Relação com os outros projetos

Ordem recomendada para subir o ecossistema completo:

```
1. abank-api     → Postgres + seed + API (porta 8000)
2. abank-app     → App do cliente (porta 3000)
3. abank-backoffice → Painel admin (porta 5000)
```

| Projeto | Repositório | Consome |
|---------|-------------|---------|
| App cliente | [`../abank-app`](../abank-app) | Auth, wallet, notificações, estornos |
| Backoffice | [`../abank-backoffice`](../abank-backoffice) | Auth (admin), usuários, wallet admin, estornos |

Guia de demonstração passo a passo: [`docs/DEMO.md`](docs/DEMO.md).

---

## Estrutura de pastas (visão geral)

```
abank-api/
├── src/
│   ├── main.ts                 # Bootstrap NestJS + Fastify
│   ├── app.module.ts           # Módulos raiz
│   ├── config/
│   │   └── database/           # TypeORM, seeds
│   ├── modules/
│   │   ├── auth/               # JWT, guards, CASL
│   │   ├── users/              # Gestão de usuários
│   │   ├── roles/              # Roles e permissões
│   │   ├── wallet/             # Depósito, transferência, estorno
│   │   └── notifications/      # Notificações in-app
│   ├── shared/                 # Entidades, enums, utils
│   └── externals/mail/         # SendGrid (opcional)
├── test/                       # Testes E2E
├── docs/                       # DEMO, REVERSAL, specs
├── docker-compose.yml
└── .env.example
```

---

## Comandos úteis

```bash
# Subir só o banco
docker compose up -d db

# Ver logs do Postgres
docker compose logs -f db

# Recriar seed (idempotente — pula registros existentes)
pnpm seed

# API em modo debug
pnpm start:debug

# Parar containers
docker compose down
```

### Exemplo rápido (curl)

```bash
# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@abank.dev","password":"Test123!"}'

# Saldo (substitua $TOKEN)
curl http://localhost:8000/api/wallet/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## Licença

MIT
