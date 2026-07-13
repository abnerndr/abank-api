import Decimal from 'decimal.js';
import { LedgerEntry, Transaction, User, Wallet } from 'src/shared/entities';
import { LedgerDirection, TransactionStatus, TransactionType } from 'src/shared/enums/wallet.enum';
import { DataSource } from 'typeorm';
import { v7 as uuid } from 'uuid';
import { TEST_USERS, type TestUserEmail } from './user.seed';

const INITIAL_BALANCES: Record<TestUserEmail, string> = {
  'alice@abank.dev': '1000.00',
  'bob@abank.dev': '500.00',
};

const SEED_DEPOSIT_IDEMPOTENCY_KEY = 'seed-initial-balance';

export async function seedTestWallets(dataSource: DataSource): Promise<void> {
  const userRepository = dataSource.getRepository(User);
  const walletRepository = dataSource.getRepository(Wallet);
  const transactionRepository = dataSource.getRepository(Transaction);

  for (const account of TEST_USERS) {
    const user = await userRepository.findOne({ where: { email: account.email } });
    if (!user) {
      throw new Error(
        `User ${account.email} not found — run seedTestUsers first`,
      );
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

    const walletId = wallet.id;

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

    const amount = new Decimal(INITIAL_BALANCES[account.email]);

    await dataSource.transaction(async (manager) => {
      const lockedWallet = await manager.getRepository(Wallet).findOne({
        where: { id: walletId },
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
        requestedByUserId: user.id,
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

    console.log(`💰 Seeded ${INITIAL_BALANCES[account.email]} BRL for ${account.email}`);
  }

  console.log('✅ Test wallets seeded:');
  for (const account of TEST_USERS) {
    console.log(
      `   ${account.email} — saldo inicial ${INITIAL_BALANCES[account.email]} BRL`,
    );
  }
}
