import * as bcrypt from 'bcryptjs';
import Decimal from 'decimal.js';
import { LedgerEntry, Role, Transaction, User, Wallet } from 'src/shared/entities';
import { LedgerDirection, TransactionStatus, TransactionType } from 'src/shared/enums/wallet.enum';
import { DataSource } from 'typeorm';
import { v7 as uuid } from 'uuid';

const TEST_ACCOUNTS = [
  {
    email: 'alice@abank.dev',
    password: 'Test123!',
    name: 'Alice Teste',
    balance: '1000.00',
  },
  {
    email: 'bob@abank.dev',
    password: 'Test123!',
    name: 'Bob Teste',
    balance: '500.00',
  },
] as const;

const SEED_DEPOSIT_IDEMPOTENCY_KEY = 'seed-initial-balance';

export async function seedTestWallets(dataSource: DataSource): Promise<void> {
  const userRepository = dataSource.getRepository(User);
  const roleRepository = dataSource.getRepository(Role);
  const walletRepository = dataSource.getRepository(Wallet);
  const transactionRepository = dataSource.getRepository(Transaction);
  const ledgerEntryRepository = dataSource.getRepository(LedgerEntry);

  const userRole = await roleRepository.findOne({ where: { name: 'user' } });
  if (!userRole) {
    throw new Error('Role "user" not found — run seedRolesAndPermissions first');
  }

  for (const account of TEST_ACCOUNTS) {
    let user = await userRepository.findOne({
      where: { email: account.email },
      relations: ['roles'],
    });

    if (!user) {
      const hashedPassword = await bcrypt.hash(account.password, 10);
      user = userRepository.create({
        email: account.email,
        password: hashedPassword,
        name: account.name,
        isVerified: true,
        roles: [userRole],
      });
      await userRepository.save(user);
      console.log(`👤 Created test user: ${account.email}`);
    }

    let wallet = await walletRepository.findOne({ where: { userId: user.id } });
    if (!wallet) {
      wallet = walletRepository.create({
        id: uuid(),
        userId: user.id,
        balance: new Decimal(0),
      });
      await walletRepository.save(wallet);
      console.log(`💳 Created wallet for ${account.email}`);
    }

    const existingDeposit = await transactionRepository.findOne({
      where: {
        requestedByUserId: user.id,
        idempotencyKey: SEED_DEPOSIT_IDEMPOTENCY_KEY,
      },
    });
    if (existingDeposit) {
      console.log(`⏭️  Skipping deposit for ${account.email} (already seeded)`);
      continue;
    }

    const amount = new Decimal(account.balance);

    await dataSource.transaction(async (manager) => {
      const lockedWallet = await manager.getRepository(Wallet).findOne({
        where: { id: wallet!.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedWallet) {
        throw new Error(`Wallet not found for ${account.email}`);
      }

      lockedWallet.balance = lockedWallet.balance.plus(amount);
      await manager.getRepository(Wallet).save(lockedWallet);

      const transaction = manager.getRepository(Transaction).create({
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.COMPLETED,
        amount,
        toWalletId: lockedWallet.id,
        requestedByUserId: user!.id,
        idempotencyKey: SEED_DEPOSIT_IDEMPOTENCY_KEY,
      });
      await manager.getRepository(Transaction).save(transaction);

      await manager.getRepository(LedgerEntry).save(
        manager.getRepository(LedgerEntry).create({
          transactionId: transaction.id,
          walletId: lockedWallet.id,
          direction: LedgerDirection.CREDIT,
          amount,
          balanceAfter: lockedWallet.balance,
        }),
      );
    });

    console.log(`💰 Seeded ${account.balance} BRL for ${account.email}`);
  }

  console.log('✅ Test wallet accounts seeded:');
  for (const account of TEST_ACCOUNTS) {
    console.log(`   ${account.email} / ${account.password} — saldo inicial ${account.balance} BRL`);
  }
}
