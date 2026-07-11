# Wallet (Carteira Financeira) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a wallet domain to abank-api — deposit, transfer between users, and admin-only reversal — on top of the existing auth/users infrastructure, which is not modified.

**Architecture:** New `WalletModule` with three entities (`Wallet`, `Transaction`, `LedgerEntry` — double-entry ledger), a thin `WalletService` orchestrating DB-transactional operations with pessimistic row locks, and a small pure "domain rules" module (`wallet-rules.ts`) holding the business invariants (balance sufficiency, self-transfer, reversal eligibility, reversal wallet-id computation) so they're unit-testable without a database.

**Tech Stack:** NestJS (Fastify), TypeORM + Postgres, `decimal.js` for money arithmetic, `class-validator` for request validation, CASL (`AbilitiesGuard`) for admin-only reversal, Jest + Supertest for tests.

**Spec:** `docs/superpowers/specs/2026-07-11-wallet-design.md` — read it if anything below is ambiguous.

---

## Prerequisites (read once, applies to every task)

- Branch `feature/wallet` already checked out from `master` at commit `0b16f5a`. Work happens here; do not touch `master`.
- Package manager is **pnpm** (`pnpm-lock.yaml`, `pnpm-workspace.yaml` present). Use `pnpm`, not `npm`/`yarn`.
- Unit tests: `pnpm test` (Jest, `rootDir: src`, matches `*.spec.ts`, colocated with source).
- Integration tests: `pnpm test:e2e` (Jest, `rootDir: .`, matches `*.e2e-spec.ts` under `test/`). These boot the **real** `AppModule`, which connects to Postgres via `DATABASE_URL`. Before running them: `docker-compose up -d` and make sure your `.env`'s `DATABASE_URL` matches the credentials in `docker-compose.yml` (`root`/`123456`/`postgres` on `localhost:5432`). `NODE_ENV=development` keeps `synchronize: true` (see `src/config/database/database.config.ts`), so new entities create their own tables automatically — no manual migration needed.
- **Import style:** use relative imports (`../../shared/entities/wallet.entity`), not the bare `src/...` alias some older files use. Several files were recently migrated away from the bare alias (see `git log -1 --stat` on `07d6be6`) because it isn't wired into Jest's module resolution — using it in new code would make the unit tests fail to resolve modules.
- Money is **never** a JS `number` in domain/service code. It's a `Decimal` (from `decimal.js`) internally, a `numeric(19,4)` column in Postgres, and a string on the wire (e.g. `"150.00"`).
- Commit after each task (steps say exactly when).

---

### Task 1: Money primitives — `decimal.js`, TypeORM transformer, validator

**Files:**
- Modify: `package.json` (add dependency)
- Create: `src/shared/utils/decimal.transformer.ts`
- Test: `src/shared/utils/decimal.transformer.spec.ts`
- Create: `src/shared/validators/is-positive-decimal-string.validator.ts`
- Test: `src/shared/validators/is-positive-decimal-string.validator.spec.ts`

- [ ] **Step 1: Install decimal.js**

Run: `pnpm add decimal.js`
Expected: `package.json` dependencies gain `"decimal.js": "^10.x.x"`, `pnpm-lock.yaml` updates. No `@types/decimal.js` needed — the package ships its own types.

- [ ] **Step 2: Write the failing test for the transformer**

```typescript
// src/shared/utils/decimal.transformer.spec.ts
import Decimal from 'decimal.js';
import { decimalTransformer } from './decimal.transformer';

describe('decimalTransformer', () => {
  it('converts a Decimal to a fixed 4-decimal string for storage', () => {
    expect(decimalTransformer.to(new Decimal('10.5'))).toBe('10.5000');
  });

  it('converts a stored numeric string back into a Decimal', () => {
    const result = decimalTransformer.from('10.5000');
    expect(result).toBeInstanceOf(Decimal);
    expect((result as Decimal).equals(new Decimal('10.5'))).toBe(true);
  });

  it('passes through null and undefined untouched', () => {
    expect(decimalTransformer.to(null)).toBeNull();
    expect(decimalTransformer.to(undefined)).toBeUndefined();
    expect(decimalTransformer.from(null)).toBeNull();
    expect(decimalTransformer.from(undefined)).toBeUndefined();
  });
});
```

- [ ] **Step 2b: Run it to confirm it fails**

Run: `pnpm test decimal.transformer`
Expected: FAIL — `Cannot find module './decimal.transformer'`

- [ ] **Step 3: Implement the transformer**

```typescript
// src/shared/utils/decimal.transformer.ts
import Decimal from 'decimal.js';
import { ValueTransformer } from 'typeorm';

export const decimalTransformer: ValueTransformer = {
  to(value?: Decimal | string | number | null): string | null | undefined {
    if (value === null || value === undefined) {
      return value;
    }
    return new Decimal(value).toFixed(4);
  },
  from(value?: string | null): Decimal | null | undefined {
    if (value === null || value === undefined) {
      return value;
    }
    return new Decimal(value);
  },
};
```

- [ ] **Step 4: Run the test again to confirm it passes**

Run: `pnpm test decimal.transformer`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the failing test for the amount validator**

```typescript
// src/shared/validators/is-positive-decimal-string.validator.spec.ts
import { IsPositiveDecimalStringConstraint } from './is-positive-decimal-string.validator';

describe('IsPositiveDecimalStringConstraint', () => {
  const constraint = new IsPositiveDecimalStringConstraint();

  it.each(['150.00', '0.01', '10', '10.5'])(
    'accepts valid positive decimal string %s',
    (value) => {
      expect(constraint.validate(value)).toBe(true);
    },
  );

  it.each([
    '0',
    '0.00',
    '-10.00',
    'abc',
    '10.12345',
    '',
    '10.',
    12 as unknown as string,
    null as unknown as string,
  ])('rejects invalid value %s', (value) => {
    expect(constraint.validate(value)).toBe(false);
  });
});
```

- [ ] **Step 5b: Run it to confirm it fails**

Run: `pnpm test is-positive-decimal-string`
Expected: FAIL — `Cannot find module './is-positive-decimal-string.validator'`

- [ ] **Step 6: Implement the validator**

```typescript
// src/shared/validators/is-positive-decimal-string.validator.ts
import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import Decimal from 'decimal.js';

@ValidatorConstraint({ name: 'isPositiveDecimalString', async: false })
export class IsPositiveDecimalStringConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || !/^\d+(\.\d{1,4})?$/.test(value)) {
      return false;
    }
    try {
      return new Decimal(value).greaterThan(0);
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return 'amount deve ser uma string decimal positiva com até 4 casas (ex: "150.00")';
  }
}

export function IsPositiveDecimalString(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsPositiveDecimalStringConstraint,
    });
  };
}
```

- [ ] **Step 7: Run the full suite to confirm it passes**

Run: `pnpm test`
Expected: PASS (all tests, including the two new files)

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml src/shared/utils/decimal.transformer.ts src/shared/utils/decimal.transformer.spec.ts src/shared/validators/is-positive-decimal-string.validator.ts src/shared/validators/is-positive-decimal-string.validator.spec.ts
git commit -m "Add decimal.js money transformer and positive-decimal-string validator"
```

---

### Task 2: Wallet domain entities

**Files:**
- Create: `src/shared/enums/wallet.enum.ts`
- Create: `src/shared/entities/wallet.entity.ts`
- Create: `src/shared/entities/transaction.entity.ts`
- Create: `src/shared/entities/ledger-entry.entity.ts`
- Modify: `src/shared/entities/index.ts`

No unit test in this task — these are TypeORM schema declarations with no behavior of their own; they're exercised by the integration tests starting in Task 5. Verify with a type-check instead (Step 6).

- [ ] **Step 1: Add the wallet enums**

```typescript
// src/shared/enums/wallet.enum.ts
export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  TRANSFER = 'TRANSFER',
  REVERSAL = 'REVERSAL',
}

export enum TransactionStatus {
  COMPLETED = 'COMPLETED',
  REVERSED = 'REVERSED',
}

export enum LedgerDirection {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}
```

- [ ] **Step 2: Add the `Wallet` entity**

```typescript
// src/shared/entities/wallet.entity.ts
import Decimal from 'decimal.js';
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v7 as uuid } from 'uuid';
import { decimalTransformer } from '../utils/decimal.transformer';

@Entity('wallets')
export class Wallet extends BaseEntity {
  @PrimaryColumn('uuid')
  id = uuid();

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @Column({
    type: 'numeric',
    precision: 19,
    scale: 4,
    default: 0,
    transformer: decimalTransformer,
  })
  balance: Decimal;

  @Column({ default: 'BRL' })
  currency: string;

  @CreateDateColumn({ name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
```

No relation back to `User` and no changes to `user.entity.ts` — a wallet is looked up by `userId` alone (see Task 5).

- [ ] **Step 3: Add the `Transaction` entity**

```typescript
// src/shared/entities/transaction.entity.ts
import Decimal from 'decimal.js';
import { BaseEntity, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { v7 as uuid } from 'uuid';
import { TransactionStatus, TransactionType } from '../enums/wallet.enum';
import { decimalTransformer } from '../utils/decimal.transformer';

@Entity('transactions')
@Index(['requestedByUserId', 'idempotencyKey'], {
  unique: true,
  where: '"idempotency_key" IS NOT NULL',
})
export class Transaction extends BaseEntity {
  @PrimaryColumn('uuid')
  id = uuid();

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.COMPLETED })
  status: TransactionStatus;

  @Column({ type: 'numeric', precision: 19, scale: 4, transformer: decimalTransformer })
  amount: Decimal;

  @Index()
  @Column({ name: 'from_wallet_id', type: 'uuid', nullable: true })
  fromWalletId: string | null;

  @Index()
  @Column({ name: 'to_wallet_id', type: 'uuid', nullable: true })
  toWalletId: string | null;

  @Column({ name: 'reversal_of_id', type: 'uuid', nullable: true })
  reversalOfId: string | null;

  @Index()
  @Column({ name: 'requested_by_user_id', type: 'uuid' })
  requestedByUserId: string;

  @Column({ name: 'idempotency_key', type: 'varchar', nullable: true })
  idempotencyKey: string | null;

  @CreateDateColumn({ name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
```

- [ ] **Step 4: Add the `LedgerEntry` entity**

```typescript
// src/shared/entities/ledger-entry.entity.ts
import Decimal from 'decimal.js';
import { BaseEntity, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { v7 as uuid } from 'uuid';
import { LedgerDirection } from '../enums/wallet.enum';
import { decimalTransformer } from '../utils/decimal.transformer';

@Entity('ledger_entries')
export class LedgerEntry extends BaseEntity {
  @PrimaryColumn('uuid')
  id = uuid();

  @Index()
  @Column({ name: 'transaction_id', type: 'uuid' })
  transactionId: string;

  @Index()
  @Column({ name: 'wallet_id', type: 'uuid' })
  walletId: string;

  @Column({ type: 'enum', enum: LedgerDirection })
  direction: LedgerDirection;

  @Column({ type: 'numeric', precision: 19, scale: 4, transformer: decimalTransformer })
  amount: Decimal;

  @Column({
    name: 'balance_after',
    type: 'numeric',
    precision: 19,
    scale: 4,
    transformer: decimalTransformer,
  })
  balanceAfter: Decimal;

  @CreateDateColumn({ name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
```

- [ ] **Step 5: Register the new entities**

```typescript
// src/shared/entities/index.ts
import type { EntityClassOrSchema } from '@nestjs/typeorm/dist/interfaces/entity-class-or-schema.type';
import { LedgerEntry } from './ledger-entry.entity';
import { Permission } from './permission.entity';
import { Role } from './role.entity';
import { Transaction } from './transaction.entity';
import { User } from './user.entity';
import { Wallet } from './wallet.entity';

export const entities: EntityClassOrSchema[] = [
  Permission,
  Role,
  User,
  Wallet,
  Transaction,
  LedgerEntry,
];
export { LedgerEntry, Permission, Role, Transaction, User, Wallet };
```

- [ ] **Step 6: Type-check**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: `TypeScript: No errors found` (or silent success)

- [ ] **Step 7: Commit**

```bash
git add src/shared/enums/wallet.enum.ts src/shared/entities/wallet.entity.ts src/shared/entities/transaction.entity.ts src/shared/entities/ledger-entry.entity.ts src/shared/entities/index.ts
git commit -m "Add Wallet, Transaction and LedgerEntry entities"
```

---

### Task 3: Wallet exceptions and pure domain rules

**Files:**
- Create: `src/modules/wallet/exceptions/insufficient-balance.exception.ts`
- Create: `src/modules/wallet/exceptions/wallet-not-found.exception.ts`
- Create: `src/modules/wallet/exceptions/transaction-already-reversed.exception.ts`
- Create: `src/modules/wallet/exceptions/self-transfer.exception.ts`
- Create: `src/modules/wallet/exceptions/invalid-reversal-target.exception.ts`
- Create: `src/modules/wallet/exceptions/recipient-not-found.exception.ts`
- Create: `src/modules/wallet/wallet-rules.ts`
- Test: `src/modules/wallet/wallet-rules.spec.ts`

This is the "functional core" of the feature: every business rule that doesn't need I/O lives here as a plain function, so it's fully unit-tested without a database. `WalletService` (Tasks 5-8) is the "imperative shell" that wires these to repositories and DB transactions.

- [ ] **Step 1: Add the exception classes**

```typescript
// src/modules/wallet/exceptions/insufficient-balance.exception.ts
import { BadRequestException } from '@nestjs/common';

export class InsufficientBalanceException extends BadRequestException {
  constructor() {
    super('Saldo insuficiente para realizar a operação');
  }
}
```

```typescript
// src/modules/wallet/exceptions/wallet-not-found.exception.ts
import { NotFoundException } from '@nestjs/common';

export class WalletNotFoundException extends NotFoundException {
  constructor() {
    super('Carteira não encontrada');
  }
}
```

```typescript
// src/modules/wallet/exceptions/transaction-already-reversed.exception.ts
import { ConflictException } from '@nestjs/common';

export class TransactionAlreadyReversedException extends ConflictException {
  constructor() {
    super('Transação já foi revertida');
  }
}
```

```typescript
// src/modules/wallet/exceptions/self-transfer.exception.ts
import { BadRequestException } from '@nestjs/common';

export class SelfTransferException extends BadRequestException {
  constructor() {
    super('Não é possível transferir para a própria carteira');
  }
}
```

```typescript
// src/modules/wallet/exceptions/invalid-reversal-target.exception.ts
import { BadRequestException } from '@nestjs/common';

export class InvalidReversalTargetException extends BadRequestException {
  constructor() {
    super('Somente depósitos ou transferências concluídos podem ser revertidos');
  }
}
```

```typescript
// src/modules/wallet/exceptions/recipient-not-found.exception.ts
import { NotFoundException } from '@nestjs/common';

export class RecipientNotFoundException extends NotFoundException {
  constructor() {
    super('Destinatário não encontrado');
  }
}
```

- [ ] **Step 2: Write the failing tests for the domain rules**

```typescript
// src/modules/wallet/wallet-rules.spec.ts
import Decimal from 'decimal.js';
import { TransactionStatus, TransactionType } from '../../shared/enums/wallet.enum';
import { InsufficientBalanceException } from './exceptions/insufficient-balance.exception';
import { InvalidReversalTargetException } from './exceptions/invalid-reversal-target.exception';
import { SelfTransferException } from './exceptions/self-transfer.exception';
import { TransactionAlreadyReversedException } from './exceptions/transaction-already-reversed.exception';
import {
  assertNotSelfTransfer,
  assertReversible,
  assertSufficientBalance,
  computeReversalWalletIds,
} from './wallet-rules';

describe('assertSufficientBalance', () => {
  it('allows when balance covers the amount exactly', () => {
    expect(() => assertSufficientBalance(new Decimal('100'), new Decimal('100'))).not.toThrow();
  });

  it('throws InsufficientBalanceException when balance is lower than amount', () => {
    expect(() => assertSufficientBalance(new Decimal('10'), new Decimal('10.01'))).toThrow(
      InsufficientBalanceException,
    );
  });

  it('allows when balance is negative but covers nothing (still fails)', () => {
    expect(() => assertSufficientBalance(new Decimal('-5'), new Decimal('1'))).toThrow(
      InsufficientBalanceException,
    );
  });
});

describe('assertNotSelfTransfer', () => {
  it('allows transfers between different users', () => {
    expect(() => assertNotSelfTransfer('user-a', 'user-b')).not.toThrow();
  });

  it('throws SelfTransferException for the same user', () => {
    expect(() => assertNotSelfTransfer('user-a', 'user-a')).toThrow(SelfTransferException);
  });
});

describe('assertReversible', () => {
  it('allows a completed deposit', () => {
    expect(() =>
      assertReversible({ type: TransactionType.DEPOSIT, status: TransactionStatus.COMPLETED }),
    ).not.toThrow();
  });

  it('allows a completed transfer', () => {
    expect(() =>
      assertReversible({ type: TransactionType.TRANSFER, status: TransactionStatus.COMPLETED }),
    ).not.toThrow();
  });

  it('throws TransactionAlreadyReversedException for an already-reversed transaction', () => {
    expect(() =>
      assertReversible({ type: TransactionType.TRANSFER, status: TransactionStatus.REVERSED }),
    ).toThrow(TransactionAlreadyReversedException);
  });

  it('throws InvalidReversalTargetException when trying to reverse a reversal', () => {
    expect(() =>
      assertReversible({ type: TransactionType.REVERSAL, status: TransactionStatus.COMPLETED }),
    ).toThrow(InvalidReversalTargetException);
  });
});

describe('computeReversalWalletIds', () => {
  it('sends money back out of the system when reversing a deposit', () => {
    expect(computeReversalWalletIds({ fromWalletId: null, toWalletId: 'wallet-b' })).toEqual({
      fromWalletId: 'wallet-b',
      toWalletId: null,
    });
  });

  it('swaps sender and receiver when reversing a transfer', () => {
    expect(
      computeReversalWalletIds({ fromWalletId: 'wallet-a', toWalletId: 'wallet-b' }),
    ).toEqual({
      fromWalletId: 'wallet-b',
      toWalletId: 'wallet-a',
    });
  });
});
```

- [ ] **Step 2b: Run it to confirm it fails**

Run: `pnpm test wallet-rules`
Expected: FAIL — `Cannot find module './wallet-rules'`

- [ ] **Step 3: Implement the domain rules**

```typescript
// src/modules/wallet/wallet-rules.ts
import Decimal from 'decimal.js';
import { TransactionStatus, TransactionType } from '../../shared/enums/wallet.enum';
import { InsufficientBalanceException } from './exceptions/insufficient-balance.exception';
import { InvalidReversalTargetException } from './exceptions/invalid-reversal-target.exception';
import { SelfTransferException } from './exceptions/self-transfer.exception';
import { TransactionAlreadyReversedException } from './exceptions/transaction-already-reversed.exception';

export function assertSufficientBalance(balance: Decimal, amount: Decimal): void {
  if (balance.lessThan(amount)) {
    throw new InsufficientBalanceException();
  }
}

export function assertNotSelfTransfer(sourceUserId: string, recipientUserId: string): void {
  if (sourceUserId === recipientUserId) {
    throw new SelfTransferException();
  }
}

export function assertReversible(transaction: {
  type: TransactionType;
  status: TransactionStatus;
}): void {
  if (transaction.status === TransactionStatus.REVERSED) {
    throw new TransactionAlreadyReversedException();
  }
  if (transaction.type === TransactionType.REVERSAL) {
    throw new InvalidReversalTargetException();
  }
}

export interface ReversalWalletIds {
  fromWalletId: string | null;
  toWalletId: string | null;
}

/**
 * A deposit has `fromWalletId: null` (money enters from outside the system) and a transfer
 * has both set. Swapping from/to on reversal is correct for both cases without branching on
 * type: reversing a deposit yields `{ fromWalletId: original.toWalletId, toWalletId: null }`
 * (money leaves the system back out), reversing a transfer swaps sender and receiver.
 */
export function computeReversalWalletIds(original: {
  fromWalletId: string | null;
  toWalletId: string | null;
}): ReversalWalletIds {
  return { fromWalletId: original.toWalletId, toWalletId: original.fromWalletId };
}
```

- [ ] **Step 4: Run the test again to confirm it passes**

Run: `pnpm test wallet-rules`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/wallet/exceptions src/modules/wallet/wallet-rules.ts src/modules/wallet/wallet-rules.spec.ts
git commit -m "Add wallet exceptions and pure domain rules"
```

---

### Task 4: Wallet DTOs

**Files:**
- Create: `src/modules/wallet/dto/deposit.dto.ts`
- Create: `src/modules/wallet/dto/transfer.dto.ts`
- Create: `src/modules/wallet/dto/transaction-query.dto.ts`
- Create: `src/modules/wallet/dto/wallet-response.dto.ts`
- Create: `src/modules/wallet/dto/transaction-response.dto.ts`

No dedicated tests — these are `class-validator`/`class-transformer` declarations exercised through the controller integration tests starting in Task 5.

- [ ] **Step 1: Request DTOs**

```typescript
// src/modules/wallet/dto/deposit.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { IsPositiveDecimalString } from '../../../shared/validators/is-positive-decimal-string.validator';

export class DepositDTO {
  @ApiProperty({ description: 'Valor a depositar', example: '150.00' })
  @IsPositiveDecimalString()
  amount: string;

  @ApiPropertyOptional({
    description:
      'Chave de idempotência — reenviar a mesma chave retorna a transação já processada em vez de reprocessar',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  idempotencyKey?: string;
}
```

```typescript
// src/modules/wallet/dto/transfer.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsPositiveDecimalString } from '../../../shared/validators/is-positive-decimal-string.validator';

export class TransferDTO {
  @ApiProperty({ description: 'Email do destinatário', example: 'destinatario@example.com' })
  @IsEmail({}, { message: 'Email do destinatário deve ter um formato válido' })
  toEmail: string;

  @ApiProperty({ description: 'Valor a transferir', example: '50.00' })
  @IsPositiveDecimalString()
  amount: string;

  @ApiPropertyOptional({
    description:
      'Chave de idempotência — reenviar a mesma chave retorna a transação já processada em vez de reprocessar',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  idempotencyKey?: string;
}
```

```typescript
// src/modules/wallet/dto/transaction-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class TransactionQueryDTO {
  @ApiPropertyOptional({ description: 'Página (1-indexed)', example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ description: 'Itens por página', example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
```

- [ ] **Step 2: Response DTOs**

```typescript
// src/modules/wallet/dto/wallet-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class WalletResponseDTO {
  @ApiProperty({ example: 'uuid-wallet-id' })
  id: string;

  @ApiProperty({ example: '150.0000' })
  balance: string;

  @ApiProperty({ example: 'BRL' })
  currency: string;

  @ApiProperty({ example: '2026-07-11T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-07-11T00:00:00.000Z' })
  updatedAt: Date;
}
```

```typescript
// src/modules/wallet/dto/transaction-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionStatus, TransactionType } from '../../../shared/enums/wallet.enum';

export class TransactionResponseDTO {
  @ApiProperty({ example: 'uuid-transaction-id' })
  id: string;

  @ApiProperty({ enum: TransactionType, example: TransactionType.TRANSFER })
  type: TransactionType;

  @ApiProperty({ enum: TransactionStatus, example: TransactionStatus.COMPLETED })
  status: TransactionStatus;

  @ApiProperty({ example: '50.0000' })
  amount: string;

  @ApiPropertyOptional({ example: 'uuid-wallet-id', nullable: true })
  fromWalletId: string | null;

  @ApiPropertyOptional({ example: 'uuid-wallet-id', nullable: true })
  toWalletId: string | null;

  @ApiPropertyOptional({ example: 'uuid-transaction-id', nullable: true })
  reversalOfId: string | null;

  @ApiProperty({ example: 'uuid-user-id' })
  requestedByUserId: string;

  @ApiPropertyOptional({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', nullable: true })
  idempotencyKey: string | null;

  @ApiProperty({ example: '2026-07-11T00:00:00.000Z' })
  createdAt: Date;
}

export class TransactionListResponseDTO {
  @ApiProperty({ type: [TransactionResponseDTO] })
  transactions: TransactionResponseDTO[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: `TypeScript: No errors found`

- [ ] **Step 4: Commit**

```bash
git add src/modules/wallet/dto
git commit -m "Add wallet request and response DTOs"
```

---

### Task 5: Wallet module skeleton — `GET /api/wallet/me`

**Files:**
- Create: `src/modules/wallet/wallet.service.ts`
- Create: `src/modules/wallet/wallet.controller.ts`
- Create: `src/modules/wallet/wallet.module.ts`
- Modify: `src/app.module.ts`
- Create: `test/utils/create-authenticated-user.ts`
- Create: `test/wallet.e2e-spec.ts`

This task wires the module end-to-end for the simplest possible slice (read-only balance, with lazy wallet creation) so every later task is additive.

- [ ] **Step 1: `WalletService` with lazy wallet creation**

```typescript
// src/modules/wallet/wallet.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from '../../shared/entities/wallet.entity';
import { WalletResponseDTO } from './dto/wallet-response.dto';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
  ) {}

  /**
   * Every user gets exactly one wallet, created on first access rather than at registration —
   * this keeps the wallet module fully decoupled from AuthService.register. `orIgnore()` makes
   * concurrent first-accesses (e.g. two parallel requests right after signup) safe: at most one
   * insert wins, the other is a no-op, and both paths re-select the same row afterwards.
   */
  async getOrCreateWallet(userId: string): Promise<Wallet> {
    const existing = await this.walletRepository.findOne({ where: { userId } });
    if (existing) {
      return existing;
    }

    await this.walletRepository
      .createQueryBuilder()
      .insert()
      .into(Wallet)
      .values({ userId })
      .orIgnore()
      .execute();

    return this.walletRepository.findOneByOrFail({ userId });
  }

  async getWalletBalance(userId: string): Promise<WalletResponseDTO> {
    const wallet = await this.getOrCreateWallet(userId);
    return this.toWalletResponse(wallet);
  }

  private toWalletResponse(wallet: Wallet): WalletResponseDTO {
    return {
      id: wallet.id,
      balance: wallet.balance.toFixed(4),
      currency: wallet.currency,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }
}
```

- [ ] **Step 2: `WalletController` with `GET /api/wallet/me`**

```typescript
// src/modules/wallet/wallet.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { WalletResponseDTO } from './dto/wallet-response.dto';
import { WalletService } from './wallet.service';

@ApiTags('Wallet')
@ApiBearerAuth()
@Controller('api/wallet')
export class WalletController {
  constructor(private walletService: WalletService) {}

  @Get('me')
  @ApiOperation({ summary: 'Obter saldo da carteira do usuário logado' })
  @ApiResponse({
    status: 200,
    description: 'Carteira retornada com sucesso',
    type: WalletResponseDTO,
  })
  async getMyWallet(@CurrentUser() user: CurrentUserData): Promise<WalletResponseDTO> {
    return this.walletService.getWalletBalance(user.id);
  }
}
```

Note: no `@Public()` here — the global `JwtAuthGuard` (registered as `APP_GUARD` in `AuthModule`) already protects every route by default, so this endpoint requires a valid bearer token with no extra decorator.

- [ ] **Step 3: `WalletModule`**

```typescript
// src/modules/wallet/wallet.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LedgerEntry } from '../../shared/entities/ledger-entry.entity';
import { Transaction } from '../../shared/entities/transaction.entity';
import { Wallet } from '../../shared/entities/wallet.entity';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, Transaction, LedgerEntry]),
    UsersModule,
    AuthModule,
  ],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
```

`Transaction` and `LedgerEntry` are registered now even though `WalletService` doesn't use their repositories yet — Task 6 injects them and this avoids re-touching the module's `forFeature` list every task. `UsersModule` and `AuthModule` aren't used yet either but are needed starting Task 7 (recipient lookup) and Task 8 (`AbilitiesGuard`); both already export what's needed and importing them now is harmless (no circular dependency is introduced — neither module imports `WalletModule`).

- [ ] **Step 4: Register `WalletModule` in `AppModule`**

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { DatabaseConfigModule } from './config/database/database.config';
import { MailModule } from './externals/mail/mail.module';
import { AuthModule } from './modules/auth/auth.module';
import { RolesModule } from './modules/roles/roles.module';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';

@Module({
  imports: [DatabaseConfigModule, AuthModule, MailModule, UsersModule, RolesModule, WalletModule],
})
export class AppModule {}
```

- [ ] **Step 5: Test helper to authenticate as a user without going through email verification**

`AuthService.login` requires `user.isVerified`, which normally requires clicking an emailed link — irrelevant to what we're testing here. This helper creates an already-verified user directly and mints a real access token via the existing `TokenService`, bypassing only the parts of auth that are out of scope for the wallet feature.

```typescript
// test/utils/create-authenticated-user.ts
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { TokenService } from '../../src/modules/auth/services/token.service';
import { Role } from '../../src/shared/entities/role.entity';
import { User } from '../../src/shared/entities/user.entity';

export interface AuthenticatedTestUser {
  userId: string;
  email: string;
  accessToken: string;
}

export async function createAuthenticatedUser(
  app: INestApplication,
  options: { roles?: string[] } = {},
): Promise<AuthenticatedTestUser> {
  const usersRepository = app.get<Repository<User>>(getRepositoryToken(User));
  const rolesRepository = app.get<Repository<Role>>(getRepositoryToken(Role));
  const tokenService = app.get(TokenService);

  const roleNames = options.roles ?? [];
  const roles: Role[] = [];
  for (const name of roleNames) {
    const existing = await rolesRepository.findOne({ where: { name } });
    roles.push(
      existing ?? (await rolesRepository.save(rolesRepository.create({ name, description: name }))),
    );
  }

  const email = `wallet-test-${randomUUID()}@example.com`;
  const user = await usersRepository.save(usersRepository.create({ email, isVerified: true, roles }));
  const tokenPair = await tokenService.generateTokenPair(user.id, user.email, roleNames, []);

  return { userId: user.id, email: user.email, accessToken: tokenPair.access_token };
}
```

- [ ] **Step 6: Write the integration test**

```typescript
// test/wallet.e2e-spec.ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { createAuthenticatedUser } from './utils/create-authenticated-user';

describe('Wallet (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/wallet/me', () => {
    it('creates a wallet with zero balance on first access', async () => {
      const { accessToken } = await createAuthenticatedUser(app);

      const response = await request(app.getHttpServer())
        .get('/api/wallet/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.balance).toBe('0.0000');
      expect(response.body.currency).toBe('BRL');
    });

    it('rejects unauthenticated requests', async () => {
      await request(app.getHttpServer()).get('/api/wallet/me').expect(401);
    });
  });
});
```

- [ ] **Step 7: Run it**

Run: `docker-compose up -d && pnpm test:e2e`
Expected: PASS (2 tests). If it fails to connect to Postgres, check `DATABASE_URL` in your `.env` against `docker-compose.yml`'s credentials.

- [ ] **Step 8: Run the full unit suite too, to make sure nothing else broke**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/modules/wallet/wallet.service.ts src/modules/wallet/wallet.controller.ts src/modules/wallet/wallet.module.ts src/app.module.ts test/utils/create-authenticated-user.ts test/wallet.e2e-spec.ts
git commit -m "Add wallet module skeleton with GET /api/wallet/me"
```

---

### Task 6: Deposit

**Files:**
- Modify: `src/modules/wallet/wallet.service.ts`
- Modify: `src/modules/wallet/wallet.controller.ts`
- Modify: `test/wallet.e2e-spec.ts`

- [ ] **Step 1: Add the failing integration tests**

Add this `describe` block inside `test/wallet.e2e-spec.ts`, after the `GET /api/wallet/me` block (still inside the outer `describe('Wallet (e2e)', ...)`):

```typescript
  describe('POST /api/wallet/deposit', () => {
    it('credits the wallet and returns the transaction', async () => {
      const { accessToken } = await createAuthenticatedUser(app);

      const response = await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amount: '150.00' })
        .expect(201);

      expect(response.body.type).toBe('DEPOSIT');
      expect(response.body.status).toBe('COMPLETED');
      expect(response.body.amount).toBe('150.0000');

      const wallet = await request(app.getHttpServer())
        .get('/api/wallet/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(wallet.body.balance).toBe('150.0000');
    });

    it('adds on top of a negative balance without clamping to zero', async () => {
      const { accessToken, userId } = await createAuthenticatedUser(app);
      const walletRepository = app.get(getRepositoryToken(Wallet));
      await walletRepository.update({ userId }, { balance: new Decimal('-40') as never });

      const response = await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amount: '25.00' })
        .expect(201);

      expect(response.body.amount).toBe('25.0000');

      const wallet = await request(app.getHttpServer())
        .get('/api/wallet/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(wallet.body.balance).toBe('-15.0000');
    });

    it('replays the same transaction when called twice with the same idempotency key', async () => {
      const { accessToken } = await createAuthenticatedUser(app);
      const idempotencyKey = 'deposit-retry-key';

      const first = await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amount: '10.00', idempotencyKey })
        .expect(201);

      const second = await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amount: '10.00', idempotencyKey })
        .expect(201);

      expect(second.body.id).toBe(first.body.id);

      const wallet = await request(app.getHttpServer())
        .get('/api/wallet/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(wallet.body.balance).toBe('10.0000');
    });

    it('rejects a non-positive amount', async () => {
      const { accessToken } = await createAuthenticatedUser(app);

      await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amount: '0.00' })
        .expect(400);
    });
  });
```

Add these imports at the top of `test/wallet.e2e-spec.ts`:

```typescript
import { getRepositoryToken } from '@nestjs/typeorm';
import Decimal from 'decimal.js';
import { Wallet } from '../src/shared/entities/wallet.entity';
```

- [ ] **Step 1b: Run it to confirm it fails**

Run: `pnpm test:e2e`
Expected: FAIL — `404` on `POST /api/wallet/deposit` (route doesn't exist yet)

- [ ] **Step 2: Add `deposit()` and its helpers to `WalletService`**

Replace the whole file with:

```typescript
// src/modules/wallet/wallet.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Decimal from 'decimal.js';
import { DataSource, Repository } from 'typeorm';
import { LedgerDirection, TransactionType } from '../../shared/enums/wallet.enum';
import { LedgerEntry } from '../../shared/entities/ledger-entry.entity';
import { Transaction } from '../../shared/entities/transaction.entity';
import { Wallet } from '../../shared/entities/wallet.entity';
import { DepositDTO } from './dto/deposit.dto';
import { TransactionResponseDTO } from './dto/transaction-response.dto';
import { WalletResponseDTO } from './dto/wallet-response.dto';
import { WalletNotFoundException } from './exceptions/wallet-not-found.exception';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(LedgerEntry)
    private ledgerEntryRepository: Repository<LedgerEntry>,
    private dataSource: DataSource,
  ) {}

  async getOrCreateWallet(userId: string): Promise<Wallet> {
    const existing = await this.walletRepository.findOne({ where: { userId } });
    if (existing) {
      return existing;
    }

    await this.walletRepository
      .createQueryBuilder()
      .insert()
      .into(Wallet)
      .values({ userId })
      .orIgnore()
      .execute();

    return this.walletRepository.findOneByOrFail({ userId });
  }

  async getWalletBalance(userId: string): Promise<WalletResponseDTO> {
    const wallet = await this.getOrCreateWallet(userId);
    return this.toWalletResponse(wallet);
  }

  async deposit(userId: string, dto: DepositDTO): Promise<TransactionResponseDTO> {
    const existing = await this.findIdempotentTransaction(userId, dto.idempotencyKey);
    if (existing) {
      return this.toTransactionResponse(existing);
    }

    await this.getOrCreateWallet(userId);
    const amount = new Decimal(dto.amount);

    return this.dataSource.transaction(async (manager) => {
      const walletRepository = manager.getRepository(Wallet);
      const wallet = await walletRepository.findOne({
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!wallet) {
        throw new WalletNotFoundException();
      }

      wallet.balance = wallet.balance.plus(amount);
      await walletRepository.save(wallet);

      const transaction = manager.getRepository(Transaction).create({
        type: TransactionType.DEPOSIT,
        amount,
        toWalletId: wallet.id,
        requestedByUserId: userId,
        idempotencyKey: dto.idempotencyKey ?? null,
      });
      await manager.getRepository(Transaction).save(transaction);

      const ledgerEntry = manager.getRepository(LedgerEntry).create({
        transactionId: transaction.id,
        walletId: wallet.id,
        direction: LedgerDirection.CREDIT,
        amount,
        balanceAfter: wallet.balance,
      });
      await manager.getRepository(LedgerEntry).save(ledgerEntry);

      return this.toTransactionResponse(transaction);
    });
  }

  private async findIdempotentTransaction(
    requestedByUserId: string,
    idempotencyKey?: string,
  ): Promise<Transaction | null> {
    if (!idempotencyKey) {
      return null;
    }
    return this.transactionRepository.findOne({ where: { requestedByUserId, idempotencyKey } });
  }

  private toWalletResponse(wallet: Wallet): WalletResponseDTO {
    return {
      id: wallet.id,
      balance: wallet.balance.toFixed(4),
      currency: wallet.currency,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }

  private toTransactionResponse(transaction: Transaction): TransactionResponseDTO {
    return {
      id: transaction.id,
      type: transaction.type,
      status: transaction.status,
      amount: transaction.amount.toFixed(4),
      fromWalletId: transaction.fromWalletId,
      toWalletId: transaction.toWalletId,
      reversalOfId: transaction.reversalOfId,
      requestedByUserId: transaction.requestedByUserId,
      idempotencyKey: transaction.idempotencyKey,
      createdAt: transaction.createdAt,
    };
  }
}
```

(`ledgerEntryRepository` isn't read directly yet outside the transactional `manager.getRepository(LedgerEntry)` calls — it's kept for Task 9's `getTransaction`/`listTransactions` symmetry with `transactionRepository`; if your linter flags it as unused, that's fine, TypeScript's `noUnusedLocals` isn't enabled in this project's `tsconfig.json`.)

- [ ] **Step 3: Add the `POST /api/wallet/deposit` endpoint**

Replace the whole file with:

```typescript
// src/modules/wallet/wallet.controller.ts
import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { DepositDTO } from './dto/deposit.dto';
import { TransactionResponseDTO } from './dto/transaction-response.dto';
import { WalletResponseDTO } from './dto/wallet-response.dto';
import { WalletService } from './wallet.service';

@ApiTags('Wallet')
@ApiBearerAuth()
@Controller('api/wallet')
export class WalletController {
  constructor(private walletService: WalletService) {}

  @Get('me')
  @ApiOperation({ summary: 'Obter saldo da carteira do usuário logado' })
  @ApiResponse({
    status: 200,
    description: 'Carteira retornada com sucesso',
    type: WalletResponseDTO,
  })
  async getMyWallet(@CurrentUser() user: CurrentUserData): Promise<WalletResponseDTO> {
    return this.walletService.getWalletBalance(user.id);
  }

  @Post('deposit')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Depositar na própria carteira' })
  @ApiBody({ type: DepositDTO })
  @ApiResponse({
    status: 201,
    description: 'Depósito realizado com sucesso',
    type: TransactionResponseDTO,
  })
  @ApiResponse({ status: 400, description: 'Valor inválido' })
  async deposit(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: DepositDTO,
  ): Promise<TransactionResponseDTO> {
    return this.walletService.deposit(user.id, dto);
  }
}
```

- [ ] **Step 4: Run the integration tests again**

Run: `pnpm test:e2e`
Expected: PASS (6 tests total)

- [ ] **Step 5: Run the unit suite too**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/modules/wallet/wallet.service.ts src/modules/wallet/wallet.controller.ts test/wallet.e2e-spec.ts
git commit -m "Add deposit endpoint with idempotency support"
```

---

### Task 7: Transfer

**Files:**
- Modify: `src/modules/wallet/wallet.service.ts`
- Modify: `src/modules/wallet/wallet.controller.ts`
- Modify: `test/wallet.e2e-spec.ts`

- [ ] **Step 1: Add the failing integration tests**

Add this `describe` block inside `test/wallet.e2e-spec.ts`, after the `POST /api/wallet/deposit` block:

```typescript
  describe('POST /api/wallet/transfer', () => {
    it('moves balance from sender to recipient', async () => {
      const sender = await createAuthenticatedUser(app);
      const recipient = await createAuthenticatedUser(app);
      await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${sender.accessToken}`)
        .send({ amount: '100.00' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/api/wallet/transfer')
        .set('Authorization', `Bearer ${sender.accessToken}`)
        .send({ toEmail: recipient.email, amount: '40.00' })
        .expect(201);

      expect(response.body.type).toBe('TRANSFER');
      expect(response.body.amount).toBe('40.0000');

      const senderWallet = await request(app.getHttpServer())
        .get('/api/wallet/me')
        .set('Authorization', `Bearer ${sender.accessToken}`)
        .expect(200);
      expect(senderWallet.body.balance).toBe('60.0000');

      const recipientWallet = await request(app.getHttpServer())
        .get('/api/wallet/me')
        .set('Authorization', `Bearer ${recipient.accessToken}`)
        .expect(200);
      expect(recipientWallet.body.balance).toBe('40.0000');
    });

    it('rejects a transfer larger than the sender balance', async () => {
      const sender = await createAuthenticatedUser(app);
      const recipient = await createAuthenticatedUser(app);

      await request(app.getHttpServer())
        .post('/api/wallet/transfer')
        .set('Authorization', `Bearer ${sender.accessToken}`)
        .send({ toEmail: recipient.email, amount: '1.00' })
        .expect(400);
    });

    it('rejects transferring to yourself', async () => {
      const sender = await createAuthenticatedUser(app);
      await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${sender.accessToken}`)
        .send({ amount: '10.00' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/wallet/transfer')
        .set('Authorization', `Bearer ${sender.accessToken}`)
        .send({ toEmail: sender.email, amount: '1.00' })
        .expect(400);
    });

    it('rejects an unknown recipient', async () => {
      const sender = await createAuthenticatedUser(app);
      await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${sender.accessToken}`)
        .send({ amount: '10.00' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/wallet/transfer')
        .set('Authorization', `Bearer ${sender.accessToken}`)
        .send({ toEmail: 'nobody@example.com', amount: '1.00' })
        .expect(404);
    });

    it('keeps the sender balance correct under two concurrent transfers for the same amount', async () => {
      const sender = await createAuthenticatedUser(app);
      const recipientA = await createAuthenticatedUser(app);
      const recipientB = await createAuthenticatedUser(app);
      await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${sender.accessToken}`)
        .send({ amount: '100.00' })
        .expect(201);

      const results = await Promise.all([
        request(app.getHttpServer())
          .post('/api/wallet/transfer')
          .set('Authorization', `Bearer ${sender.accessToken}`)
          .send({ toEmail: recipientA.email, amount: '80.00' }),
        request(app.getHttpServer())
          .post('/api/wallet/transfer')
          .set('Authorization', `Bearer ${sender.accessToken}`)
          .send({ toEmail: recipientB.email, amount: '80.00' }),
      ]);

      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([201, 400]);

      const senderWallet = await request(app.getHttpServer())
        .get('/api/wallet/me')
        .set('Authorization', `Bearer ${sender.accessToken}`)
        .expect(200);
      expect(senderWallet.body.balance).toBe('20.0000');
    });
  });
```

- [ ] **Step 1b: Run it to confirm it fails**

Run: `pnpm test:e2e`
Expected: FAIL — `404` on `POST /api/wallet/transfer`

- [ ] **Step 2: Add `transfer()` to `WalletService`**

In `src/modules/wallet/wallet.service.ts`:

Update the imports at the top of the file to:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Decimal from 'decimal.js';
import { DataSource, Repository } from 'typeorm';
import { LedgerEntry } from '../../shared/entities/ledger-entry.entity';
import { Transaction } from '../../shared/entities/transaction.entity';
import { Wallet } from '../../shared/entities/wallet.entity';
import { UsersService } from '../users/users.service';
import { DepositDTO } from './dto/deposit.dto';
import { TransactionResponseDTO } from './dto/transaction-response.dto';
import { TransferDTO } from './dto/transfer.dto';
import { WalletResponseDTO } from './dto/wallet-response.dto';
import { RecipientNotFoundException } from './exceptions/recipient-not-found.exception';
import { WalletNotFoundException } from './exceptions/wallet-not-found.exception';
import { LedgerDirection, TransactionType } from '../../shared/enums/wallet.enum';
import { assertNotSelfTransfer, assertSufficientBalance } from './wallet-rules';
```

Update the constructor to add `usersService`:

```typescript
  constructor(
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(LedgerEntry)
    private ledgerEntryRepository: Repository<LedgerEntry>,
    private usersService: UsersService,
    private dataSource: DataSource,
  ) {}
```

Add this method to the class, right after `deposit(...)`:

```typescript
  async transfer(userId: string, dto: TransferDTO): Promise<TransactionResponseDTO> {
    const existing = await this.findIdempotentTransaction(userId, dto.idempotencyKey);
    if (existing) {
      return this.toTransactionResponse(existing);
    }

    const recipient = await this.usersService.findByEmail(dto.toEmail);
    if (!recipient) {
      throw new RecipientNotFoundException();
    }
    assertNotSelfTransfer(userId, recipient.id);

    await this.getOrCreateWallet(userId);
    await this.getOrCreateWallet(recipient.id);
    const amount = new Decimal(dto.amount);

    return this.dataSource.transaction(async (manager) => {
      const walletRepository = manager.getRepository(Wallet);
      // Lock in a deterministic order (sorted user id) regardless of who is sender/receiver,
      // so two transfers between the same pair of wallets in opposite directions can never
      // deadlock waiting on each other's row lock.
      const [firstUserId, secondUserId] = [userId, recipient.id].sort();
      const firstWallet = await walletRepository.findOne({
        where: { userId: firstUserId },
        lock: { mode: 'pessimistic_write' },
      });
      const secondWallet = await walletRepository.findOne({
        where: { userId: secondUserId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!firstWallet || !secondWallet) {
        throw new WalletNotFoundException();
      }

      const source = firstWallet.userId === userId ? firstWallet : secondWallet;
      const destination = firstWallet.userId === userId ? secondWallet : firstWallet;

      assertSufficientBalance(source.balance, amount);

      source.balance = source.balance.minus(amount);
      destination.balance = destination.balance.plus(amount);
      await walletRepository.save([source, destination]);

      const transaction = manager.getRepository(Transaction).create({
        type: TransactionType.TRANSFER,
        amount,
        fromWalletId: source.id,
        toWalletId: destination.id,
        requestedByUserId: userId,
        idempotencyKey: dto.idempotencyKey ?? null,
      });
      await manager.getRepository(Transaction).save(transaction);

      await manager.getRepository(LedgerEntry).save([
        manager.getRepository(LedgerEntry).create({
          transactionId: transaction.id,
          walletId: source.id,
          direction: LedgerDirection.DEBIT,
          amount,
          balanceAfter: source.balance,
        }),
        manager.getRepository(LedgerEntry).create({
          transactionId: transaction.id,
          walletId: destination.id,
          direction: LedgerDirection.CREDIT,
          amount,
          balanceAfter: destination.balance,
        }),
      ]);

      return this.toTransactionResponse(transaction);
    });
  }
```

- [ ] **Step 3: Add the `POST /api/wallet/transfer` endpoint**

In `src/modules/wallet/wallet.controller.ts`, update the imports:

```typescript
import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { DepositDTO } from './dto/deposit.dto';
import { TransactionResponseDTO } from './dto/transaction-response.dto';
import { TransferDTO } from './dto/transfer.dto';
import { WalletResponseDTO } from './dto/wallet-response.dto';
import { WalletService } from './wallet.service';
```

Add this method to the class, right after `deposit(...)`:

```typescript
  @Post('transfer')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Transferir para a carteira de outro usuário' })
  @ApiBody({ type: TransferDTO })
  @ApiResponse({
    status: 201,
    description: 'Transferência realizada com sucesso',
    type: TransactionResponseDTO,
  })
  @ApiResponse({ status: 400, description: 'Saldo insuficiente, valor inválido ou auto-transferência' })
  @ApiResponse({ status: 404, description: 'Destinatário não encontrado' })
  async transfer(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: TransferDTO,
  ): Promise<TransactionResponseDTO> {
    return this.walletService.transfer(user.id, dto);
  }
```

- [ ] **Step 4: Run the integration tests again**

Run: `pnpm test:e2e`
Expected: PASS (11 tests total)

- [ ] **Step 5: Run the unit suite too**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/modules/wallet/wallet.service.ts src/modules/wallet/wallet.controller.ts test/wallet.e2e-spec.ts
git commit -m "Add transfer endpoint with pessimistic locking"
```

---

### Task 8: Admin-only reversal

**Files:**
- Modify: `src/shared/enums/casl-action.enum.ts`
- Modify: `src/modules/auth/decorators/check-abilities.decorator.ts`
- Modify: `src/modules/wallet/wallet.service.ts`
- Modify: `src/modules/wallet/wallet.controller.ts`
- Modify: `test/wallet.e2e-spec.ts`

- [ ] **Step 1: Add the failing integration tests**

Add this `describe` block inside `test/wallet.e2e-spec.ts`, after the `POST /api/wallet/transfer` block:

```typescript
  describe('POST /api/wallet/transactions/:id/reverse', () => {
    it('rejects a non-admin user with 403', async () => {
      const user = await createAuthenticatedUser(app);
      const deposit = await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ amount: '10.00' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/wallet/transactions/${deposit.body.id}/reverse`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(403);
    });

    it('reverses a deposit, debiting the wallet back', async () => {
      const admin = await createAuthenticatedUser(app, { roles: ['admin'] });
      const user = await createAuthenticatedUser(app);
      const deposit = await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ amount: '30.00' })
        .expect(201);

      const reversal = await request(app.getHttpServer())
        .post(`/api/wallet/transactions/${deposit.body.id}/reverse`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);

      expect(reversal.body.type).toBe('REVERSAL');
      expect(reversal.body.reversalOfId).toBe(deposit.body.id);

      const wallet = await request(app.getHttpServer())
        .get('/api/wallet/me')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);
      expect(wallet.body.balance).toBe('0.0000');
    });

    it('reverses a transfer even if the recipient already spent the money, going negative', async () => {
      const admin = await createAuthenticatedUser(app, { roles: ['admin'] });
      const a = await createAuthenticatedUser(app);
      const b = await createAuthenticatedUser(app);
      const c = await createAuthenticatedUser(app);

      await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ amount: '100.00' })
        .expect(201);

      const transfer = await request(app.getHttpServer())
        .post('/api/wallet/transfer')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ toEmail: b.email, amount: '100.00' })
        .expect(201);

      // B immediately forwards everything to C — B's wallet is now at 0.
      await request(app.getHttpServer())
        .post('/api/wallet/transfer')
        .set('Authorization', `Bearer ${b.accessToken}`)
        .send({ toEmail: c.email, amount: '100.00' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/wallet/transactions/${transfer.body.id}/reverse`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);

      const bWallet = await request(app.getHttpServer())
        .get('/api/wallet/me')
        .set('Authorization', `Bearer ${b.accessToken}`)
        .expect(200);
      expect(bWallet.body.balance).toBe('-100.0000');

      const aWallet = await request(app.getHttpServer())
        .get('/api/wallet/me')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .expect(200);
      expect(aWallet.body.balance).toBe('100.0000');

      // A subsequent deposit into B's wallet just adds on top of the negative balance.
      await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${b.accessToken}`)
        .send({ amount: '30.00' })
        .expect(201);

      const bWalletAfterDeposit = await request(app.getHttpServer())
        .get('/api/wallet/me')
        .set('Authorization', `Bearer ${b.accessToken}`)
        .expect(200);
      expect(bWalletAfterDeposit.body.balance).toBe('-70.0000');
    });

    it('rejects reversing the same transaction twice', async () => {
      const admin = await createAuthenticatedUser(app, { roles: ['admin'] });
      const user = await createAuthenticatedUser(app);
      const deposit = await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ amount: '10.00' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/wallet/transactions/${deposit.body.id}/reverse`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/api/wallet/transactions/${deposit.body.id}/reverse`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(409);
    });
  });
```

- [ ] **Step 1b: Run it to confirm it fails**

Run: `pnpm test:e2e`
Expected: FAIL — `404` on `POST /api/wallet/transactions/:id/reverse`

- [ ] **Step 2: Add `Resource.TRANSACTION` to the CASL enum**

In `src/shared/enums/casl-action.enum.ts`, change the `Resource` enum to:

```typescript
export enum Resource {
  USER = 'User',
  ROLE = 'Role',
  PERMISSION = 'Permission',
  TRANSACTION = 'Transaction',
  ALL = 'all',
}
```

- [ ] **Step 3: Add a `ManageTransactions` decorator**

At the end of `src/modules/auth/decorators/check-abilities.decorator.ts`, add:

```typescript
export const ManageTransactions = () =>
  CheckAbilities({ action: Action.MANAGE, subject: Resource.TRANSACTION });
```

Only the `admin` role can pass this check: `AbilitiesGuard` grants access when the user's ability includes `manage all` (which is exactly what the `admin` role has per `src/config/database/seeds/role.seed.ts`), and denies it otherwise — no changes needed to `CaslAbilityFactory` or the seed data, `user`/`moderator` roles simply don't have a rule matching `Transaction` or `all`.

- [ ] **Step 4: Add `reverse()` to `WalletService`**

Update the imports at the top of `src/modules/wallet/wallet.service.ts` to:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Decimal from 'decimal.js';
import { DataSource, Repository } from 'typeorm';
import { LedgerEntry } from '../../shared/entities/ledger-entry.entity';
import { Transaction } from '../../shared/entities/transaction.entity';
import { Wallet } from '../../shared/entities/wallet.entity';
import { LedgerDirection, TransactionStatus, TransactionType } from '../../shared/enums/wallet.enum';
import { UsersService } from '../users/users.service';
import { DepositDTO } from './dto/deposit.dto';
import { TransactionResponseDTO } from './dto/transaction-response.dto';
import { TransferDTO } from './dto/transfer.dto';
import { WalletResponseDTO } from './dto/wallet-response.dto';
import { RecipientNotFoundException } from './exceptions/recipient-not-found.exception';
import { WalletNotFoundException } from './exceptions/wallet-not-found.exception';
import {
  assertNotSelfTransfer,
  assertReversible,
  assertSufficientBalance,
  computeReversalWalletIds,
} from './wallet-rules';
```

Add this method to the class, right after `transfer(...)`:

```typescript
  async reverse(adminUserId: string, transactionId: string): Promise<TransactionResponseDTO> {
    const original = await this.transactionRepository.findOne({ where: { id: transactionId } });
    if (!original) {
      throw new NotFoundException('Transação não encontrada');
    }
    assertReversible(original);

    return this.dataSource.transaction(async (manager) => {
      const transactionRepository = manager.getRepository(Transaction);
      const walletRepository = manager.getRepository(Wallet);
      const ledgerRepository = manager.getRepository(LedgerEntry);

      const lockedOriginal = await transactionRepository.findOne({ where: { id: transactionId } });
      if (!lockedOriginal) {
        throw new NotFoundException('Transação não encontrada');
      }
      assertReversible(lockedOriginal);

      const walletIds = [lockedOriginal.fromWalletId, lockedOriginal.toWalletId]
        .filter((id): id is string => id !== null)
        .sort();

      const wallets = new Map<string, Wallet>();
      for (const id of walletIds) {
        const wallet = await walletRepository.findOne({
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!wallet) {
          throw new WalletNotFoundException();
        }
        wallets.set(id, wallet);
      }

      const { fromWalletId, toWalletId } = computeReversalWalletIds(lockedOriginal);

      // fromWalletId is whoever received in the original transaction — always set for a
      // completed deposit or transfer — and gets debited back. No balance-sufficiency check
      // here: reversing on top of money the recipient already spent elsewhere is exactly the
      // "negative balance for some reason" case the spec calls out, and it's deliberate.
      const debitedWallet = wallets.get(fromWalletId as string)!;
      debitedWallet.balance = debitedWallet.balance.minus(lockedOriginal.amount);
      const ledgerEntries = [
        ledgerRepository.create({
          walletId: debitedWallet.id,
          direction: LedgerDirection.DEBIT,
          amount: lockedOriginal.amount,
          balanceAfter: debitedWallet.balance,
        }),
      ];

      if (toWalletId) {
        const creditedWallet = wallets.get(toWalletId)!;
        creditedWallet.balance = creditedWallet.balance.plus(lockedOriginal.amount);
        ledgerEntries.push(
          ledgerRepository.create({
            walletId: creditedWallet.id,
            direction: LedgerDirection.CREDIT,
            amount: lockedOriginal.amount,
            balanceAfter: creditedWallet.balance,
          }),
        );
      }

      await walletRepository.save([...wallets.values()]);

      const reversalTransaction = transactionRepository.create({
        type: TransactionType.REVERSAL,
        amount: lockedOriginal.amount,
        fromWalletId,
        toWalletId,
        reversalOfId: lockedOriginal.id,
        requestedByUserId: adminUserId,
      });
      await transactionRepository.save(reversalTransaction);

      for (const entry of ledgerEntries) {
        entry.transactionId = reversalTransaction.id;
      }
      await ledgerRepository.save(ledgerEntries);

      lockedOriginal.status = TransactionStatus.REVERSED;
      await transactionRepository.save(lockedOriginal);

      return this.toTransactionResponse(reversalTransaction);
    });
  }
```

- [ ] **Step 5: Add the `POST /api/wallet/transactions/:id/reverse` endpoint**

Update the imports at the top of `src/modules/wallet/wallet.controller.ts` to:

```typescript
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ManageTransactions } from '../auth/decorators/check-abilities.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { AbilitiesGuard } from '../auth/guards/abilities.guard';
import { DepositDTO } from './dto/deposit.dto';
import { TransactionResponseDTO } from './dto/transaction-response.dto';
import { TransferDTO } from './dto/transfer.dto';
import { WalletResponseDTO } from './dto/wallet-response.dto';
import { WalletService } from './wallet.service';
```

Add this method to the class, right after `transfer(...)`:

```typescript
  @Post('transactions/:id/reverse')
  @UseGuards(AbilitiesGuard)
  @ManageTransactions()
  @ApiOperation({ summary: 'Reverter uma transação (somente admin)' })
  @ApiResponse({
    status: 200,
    description: 'Transação revertida com sucesso',
    type: TransactionResponseDTO,
  })
  @ApiResponse({ status: 403, description: 'Sem permissão para reverter transações' })
  @ApiResponse({ status: 404, description: 'Transação não encontrada' })
  @ApiResponse({ status: 409, description: 'Transação já revertida' })
  async reverse(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ): Promise<TransactionResponseDTO> {
    return this.walletService.reverse(user.id, id);
  }
```

- [ ] **Step 6: Run the integration tests again**

Run: `pnpm test:e2e`
Expected: PASS (15 tests total)

- [ ] **Step 7: Run the unit suite too**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/shared/enums/casl-action.enum.ts src/modules/auth/decorators/check-abilities.decorator.ts src/modules/wallet/wallet.service.ts src/modules/wallet/wallet.controller.ts test/wallet.e2e-spec.ts
git commit -m "Add admin-only transaction reversal"
```

---

### Task 9: List and detail endpoints, with authorization

**Files:**
- Modify: `src/modules/wallet/wallet.service.ts`
- Modify: `src/modules/wallet/wallet.controller.ts`
- Modify: `test/wallet.e2e-spec.ts`

- [ ] **Step 1: Add the failing integration tests**

Add this `describe` block inside `test/wallet.e2e-spec.ts`, after the reversal `describe` block:

```typescript
  describe('GET /api/wallet/transactions', () => {
    it('lists only transactions the caller participated in, newest first', async () => {
      const a = await createAuthenticatedUser(app);
      const b = await createAuthenticatedUser(app);

      await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ amount: '50.00' })
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/wallet/transfer')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ toEmail: b.email, amount: '20.00' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/api/wallet/transactions')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .expect(200);

      expect(response.body.total).toBe(2);
      expect(response.body.transactions[0].type).toBe('TRANSFER');
      expect(response.body.transactions[1].type).toBe('DEPOSIT');

      const recipientResponse = await request(app.getHttpServer())
        .get('/api/wallet/transactions')
        .set('Authorization', `Bearer ${b.accessToken}`)
        .expect(200);
      expect(recipientResponse.body.total).toBe(1);
    });
  });

  describe('GET /api/wallet/transactions/:id', () => {
    it('lets a participant see the transaction', async () => {
      const a = await createAuthenticatedUser(app);
      const b = await createAuthenticatedUser(app);
      await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ amount: '50.00' })
        .expect(201);
      const transfer = await request(app.getHttpServer())
        .post('/api/wallet/transfer')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ toEmail: b.email, amount: '20.00' })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/api/wallet/transactions/${transfer.body.id}`)
        .set('Authorization', `Bearer ${b.accessToken}`)
        .expect(200);
    });

    it('forbids a non-participant, non-admin user', async () => {
      const a = await createAuthenticatedUser(app);
      const outsider = await createAuthenticatedUser(app);
      const deposit = await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ amount: '50.00' })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/api/wallet/transactions/${deposit.body.id}`)
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .expect(403);
    });

    it('lets an admin see any transaction', async () => {
      const admin = await createAuthenticatedUser(app, { roles: ['admin'] });
      const a = await createAuthenticatedUser(app);
      const deposit = await request(app.getHttpServer())
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ amount: '50.00' })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/api/wallet/transactions/${deposit.body.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);
    });

    it('returns 404 for an unknown transaction id', async () => {
      const a = await createAuthenticatedUser(app);
      await request(app.getHttpServer())
        .get('/api/wallet/transactions/00000000-0000-7000-8000-000000000000')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .expect(404);
    });
  });
```

- [ ] **Step 1b: Run it to confirm it fails**

Run: `pnpm test:e2e`
Expected: FAIL — `404` on `GET /api/wallet/transactions`

- [ ] **Step 2: Add `listTransactions()` and `getTransaction()` to `WalletService`**

Update the `@nestjs/common` import at the top of `src/modules/wallet/wallet.service.ts` to:

```typescript
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
```

Change the existing DTO import line:

```typescript
import { TransactionResponseDTO } from './dto/transaction-response.dto';
```

to:

```typescript
import { TransactionListResponseDTO, TransactionResponseDTO } from './dto/transaction-response.dto';
```

Add these methods to the class, right after `getWalletBalance(...)`:

```typescript
  async listTransactions(
    userId: string,
    page: number,
    limit: number,
  ): Promise<TransactionListResponseDTO> {
    const wallet = await this.walletRepository.findOne({ where: { userId } });

    const [transactions, total] = await this.transactionRepository.findAndCount({
      where: wallet
        ? [
            { fromWalletId: wallet.id },
            { toWalletId: wallet.id },
            { requestedByUserId: userId },
          ]
        : { requestedByUserId: userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      transactions: transactions.map((transaction) => this.toTransactionResponse(transaction)),
      total,
      page,
      limit,
    };
  }

  async getTransaction(
    userId: string,
    isAdmin: boolean,
    transactionId: string,
  ): Promise<TransactionResponseDTO> {
    const transaction = await this.transactionRepository.findOne({ where: { id: transactionId } });
    if (!transaction) {
      throw new NotFoundException('Transação não encontrada');
    }

    if (!isAdmin) {
      const wallet = await this.walletRepository.findOne({ where: { userId } });
      const isParticipant =
        transaction.requestedByUserId === userId ||
        (!!wallet && (transaction.fromWalletId === wallet.id || transaction.toWalletId === wallet.id));

      if (!isParticipant) {
        throw new ForbiddenException('Sem permissão para ver esta transação');
      }
    }

    return this.toTransactionResponse(transaction);
  }
```

- [ ] **Step 3: Add the `GET` endpoints**

Update the imports at the top of `src/modules/wallet/wallet.controller.ts` to:

```typescript
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ManageTransactions } from '../auth/decorators/check-abilities.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { AbilitiesGuard } from '../auth/guards/abilities.guard';
import { isAdmin } from '../../shared/utils/auth.utils';
import { DepositDTO } from './dto/deposit.dto';
import { TransactionListResponseDTO, TransactionResponseDTO } from './dto/transaction-response.dto';
import { TransactionQueryDTO } from './dto/transaction-query.dto';
import { TransferDTO } from './dto/transfer.dto';
import { WalletResponseDTO } from './dto/wallet-response.dto';
import { WalletService } from './wallet.service';
```

Add these methods to the class, right after `getMyWallet(...)`:

```typescript
  @Get('transactions')
  @ApiOperation({ summary: 'Listar transações da carteira do usuário logado' })
  @ApiResponse({ status: 200, description: 'Lista de transações', type: TransactionListResponseDTO })
  async listTransactions(
    @CurrentUser() user: CurrentUserData,
    @Query() query: TransactionQueryDTO,
  ): Promise<TransactionListResponseDTO> {
    return this.walletService.listTransactions(user.id, query.page, query.limit);
  }

  @Get('transactions/:id')
  @ApiOperation({ summary: 'Detalhe de uma transação' })
  @ApiResponse({ status: 200, description: 'Transação encontrada', type: TransactionResponseDTO })
  @ApiResponse({ status: 403, description: 'Sem permissão para ver esta transação' })
  @ApiResponse({ status: 404, description: 'Transação não encontrada' })
  async getTransaction(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ): Promise<TransactionResponseDTO> {
    return this.walletService.getTransaction(user.id, isAdmin(user), id);
  }
```

`isAdmin` comes from the existing `src/shared/utils/auth.utils.ts` (`isAdmin({ roles }) => roles.includes('admin')`) — `CurrentUserData` already carries `roles: string[]` from the JWT guard, so this needs no new plumbing.

- [ ] **Step 4: Run the integration tests again**

Run: `pnpm test:e2e`
Expected: PASS (20 tests total)

- [ ] **Step 5: Run the unit suite too**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/modules/wallet/wallet.service.ts src/modules/wallet/wallet.controller.ts test/wallet.e2e-spec.ts
git commit -m "Add transaction list and detail endpoints"
```

---

### Task 10: README documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a Wallet section**

Read the current `README.md` first (`cat README.md`) and add a `## Wallet` section before the license/footer (or at the end if there's no clear footer), covering:

```markdown
## Wallet

Financial wallet domain: deposit, transfer between users, and admin-only reversal. Full
design rationale in `docs/superpowers/specs/2026-07-11-wallet-design.md`.

Every user has exactly one wallet (`BRL`), created lazily on first access. Money is stored as
`numeric(19,4)` and handled as `Decimal` (via `decimal.js`) everywhere in code — never a raw
JS `number` — to avoid floating-point rounding errors. Every operation runs inside a single
database transaction with `SELECT ... FOR UPDATE` row locks on the involved wallets, so
concurrent transfers on the same balance can't overdraw it. Every deposit, transfer and
reversal is recorded twice: once as a `Transaction` (the business-level record) and once per
affected wallet as an immutable `LedgerEntry` (the audit trail) — `Wallet.balance` is never
edited outside of these flows.

Reversal is admin-only (`AbilitiesGuard` + CASL, same mechanism the roles module already
uses) and never fails for insufficient balance: reversing a transfer whose recipient already
spent the funds elsewhere is expected to push their wallet negative — that's the "negative
balance for some reason" case a subsequent deposit is required to just add on top of.

### Endpoints

All under the existing global JWT guard (`Authorization: Bearer <token>`).

| Method | Path                                    | Description                                  |
|--------|------------------------------------------|-----------------------------------------------|
| GET    | `/api/wallet/me`                         | Own wallet balance                            |
| GET    | `/api/wallet/transactions`               | Own transaction history (paginated)           |
| GET    | `/api/wallet/transactions/:id`           | Transaction detail (participant or admin)     |
| POST   | `/api/wallet/deposit`                    | Deposit into own wallet                       |
| POST   | `/api/wallet/transfer`                   | Transfer to another user's wallet, by email   |
| POST   | `/api/wallet/transactions/:id/reverse`   | Reverse a completed deposit/transfer (admin)  |

### Example

```bash
# Deposit
curl -X POST http://localhost:8888/api/wallet/deposit \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"amount": "150.00"}'

# Transfer
curl -X POST http://localhost:8888/api/wallet/transfer \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"toEmail": "recipient@example.com", "amount": "40.00"}'

# Reverse (admin token required)
curl -X POST http://localhost:8888/api/wallet/transactions/<id>/reverse \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Testing

- `pnpm test` — unit tests for the pure domain rules (`wallet-rules.spec.ts`) and money
  primitives (`decimal.transformer.spec.ts`, `is-positive-decimal-string.validator.spec.ts`).
- `pnpm test:e2e` — integration tests (`test/wallet.e2e-spec.ts`) against a real Postgres
  (`docker-compose up -d` first), covering the full deposit → transfer → reverse lifecycle,
  concurrency, idempotency, and authorization.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Document the wallet module"
```

---

## Plan Self-Review Notes

- **Spec coverage:** cadastro/auth (pre-existing, untouched) · deposit (Task 6) · transfer with balance validation (Task 7) · deposit onto negative balance just adds (Task 6, test 2) · reversal of either operation, on inconsistency or by request (Task 8; here "by request" is the admin endpoint itself — there's no separate automatic-inconsistency path because every operation already runs inside one DB transaction, so partial failures roll back on their own without ever reaching a committed, reversible state) · Docker (already exists, unmodified) · integration tests (every task from 5 on) · unit tests (Tasks 1, 3) · documentation (Task 10).
- **Not built:** metrics/tracing infra — noted as an explicit non-goal in the design doc's Observability section (logging is the only structured signal, and no task above adds even that, since none of the reviewed requirements call for it beyond what NestJS's default request logging already gives; if this turns out to matter, add a small `Logger` call at the start/end of each `WalletService` method as a follow-up).
