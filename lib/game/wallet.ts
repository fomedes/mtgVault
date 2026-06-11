import { connectToDatabase } from "@/lib/db";
import {
  Transaction,
  type TransactionDoc,
  type TransactionReason,
} from "@/lib/models/Transaction";
import { User } from "@/lib/models/User";

export class InsufficientFundsError extends Error {
  constructor() {
    super("Insufficient Vault Coins");
    this.name = "InsufficientFundsError";
  }
}

interface WalletMeta {
  setCode?: string;
  packCount?: number;
  achievementId?: string;
  grantedBy?: string;
}

/**
 * Atomically credits vaultCoins and records the Transaction.
 * Returns the new balance.
 */
export async function creditWallet(
  userId: string,
  amount: number,
  reason: TransactionReason,
  meta: WalletMeta = {},
): Promise<{ newBalance: number }> {
  await connectToDatabase();

  const before = await User.findOneAndUpdate(
    { uid: userId },
    { $inc: { vaultCoins: amount } },
    { returnDocument: "before" },
  ).lean();

  if (!before) throw new Error(`User not found: ${userId}`);

  const balanceBefore = before.vaultCoins ?? 0;
  const balanceAfter = balanceBefore + amount;

  await Transaction.create({
    userId,
    type: "credit",
    amount,
    reason,
    balanceBefore,
    balanceAfter,
    meta,
  });

  return { newBalance: balanceAfter };
}

/**
 * Atomically debits vaultCoins (guarded — balance never goes negative).
 * Throws InsufficientFundsError if the user cannot afford `amount`.
 */
export async function debitWallet(
  userId: string,
  amount: number,
  reason: TransactionReason,
  meta: WalletMeta = {},
): Promise<{ newBalance: number }> {
  await connectToDatabase();

  const before = await User.findOneAndUpdate(
    { uid: userId, vaultCoins: { $gte: amount } },
    { $inc: { vaultCoins: -amount } },
    { returnDocument: "before" },
  ).lean();

  if (!before) throw new InsufficientFundsError();

  const balanceBefore = before.vaultCoins ?? 0;
  const balanceAfter = balanceBefore - amount;

  await Transaction.create({
    userId,
    type: "debit",
    amount,
    reason,
    balanceBefore,
    balanceAfter,
    meta,
  });

  return { newBalance: balanceAfter };
}

/** Returns the most recent N transactions for a user. */
export async function getTransactions(
  userId: string,
  limit = 20,
): Promise<TransactionDoc[]> {
  await connectToDatabase();
  return Transaction.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean() as unknown as TransactionDoc[];
}
