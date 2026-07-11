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
