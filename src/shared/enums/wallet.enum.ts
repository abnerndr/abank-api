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

export enum RefundRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}
