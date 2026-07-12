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

/**
 * Who is allowed to read a transaction (non-admins). A caller qualifies as a participant in
 * two ways:
 *
 * 1. They requested it (`requestedByUserId`). This grants *permanent* read access to whoever
 *    performed the action, and is deliberately independent of any role. In particular, an admin
 *    who reverses a transaction stays able to view that reversal forever, even after their
 *    `admin` role is revoked — the role gates *performing* new admin actions, not seeing the
 *    ones already taken. This is audit-trail semantics: "whoever did it can always see that they
 *    did it". It is intentional, not a leak.
 * 2. Their wallet was the source or destination (`fromWalletId`/`toWalletId`). `walletId` is
 *    null when the caller never had a wallet, in which case only the requester path applies.
 */
export function isTransactionParticipant(
  transaction: { requestedByUserId: string; fromWalletId: string | null; toWalletId: string | null },
  userId: string,
  walletId: string | null,
): boolean {
  if (transaction.requestedByUserId === userId) {
    return true;
  }
  return walletId !== null && (transaction.fromWalletId === walletId || transaction.toWalletId === walletId);
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
