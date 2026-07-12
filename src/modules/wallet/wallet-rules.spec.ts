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
  isTransactionParticipant,
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

describe('isTransactionParticipant', () => {
  const tx = {
    requestedByUserId: 'requester',
    fromWalletId: 'wallet-from',
    toWalletId: 'wallet-to',
  };

  it('grants access to the user who requested the transaction', () => {
    expect(isTransactionParticipant(tx, 'requester', null)).toBe(true);
  });

  it('grants access to the requester even when their wallet is unrelated to the transaction', () => {
    // This is the audit-trail permanence case: e.g. an admin who reversed a transaction and no
    // longer holds the admin role (so they reach this check) and never participated via a wallet.
    expect(isTransactionParticipant(tx, 'requester', 'some-unrelated-wallet')).toBe(true);
  });

  it('grants access when the caller wallet is the source', () => {
    expect(isTransactionParticipant(tx, 'someone-else', 'wallet-from')).toBe(true);
  });

  it('grants access when the caller wallet is the destination', () => {
    expect(isTransactionParticipant(tx, 'someone-else', 'wallet-to')).toBe(true);
  });

  it('denies a non-requester whose wallet is unrelated', () => {
    expect(isTransactionParticipant(tx, 'someone-else', 'wallet-other')).toBe(false);
  });

  it('denies a non-requester with no wallet', () => {
    expect(isTransactionParticipant(tx, 'someone-else', null)).toBe(false);
  });

  it('does not treat a null wallet id as matching a transaction with a null side', () => {
    const depositReversalOut = {
      requestedByUserId: 'admin',
      fromWalletId: 'wallet-x',
      toWalletId: null,
    };
    expect(isTransactionParticipant(depositReversalOut, 'someone-else', null)).toBe(false);
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
