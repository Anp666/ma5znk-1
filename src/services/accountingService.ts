import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  increment, 
  runTransaction,
  serverTimestamp,
  query,
  where,
  getDocs,
  limit,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { Transaction, Account } from '../types';

export const ensureSystemAccounts = async () => {
  const accountsRef = collection(db, 'accounts');
  const systemAccounts = [
    { code: '1100', name: 'Cash', type: 'Asset' },
    { code: '1200', name: 'Accounts Receivable', type: 'Asset' },
    { code: '1300', name: 'Inventory', type: 'Asset' },
    { code: '2100', name: 'Accounts Payable', type: 'Liability' },
    { code: '4100', name: 'Sales Revenue', type: 'Revenue' },
    { code: '5100', name: 'Cost of Goods Sold', type: 'Expense' },
  ];

  for (const acc of systemAccounts) {
    const q = query(accountsRef, where('name', '==', acc.name));
    const snap = await getDocs(q);
    if (snap.empty) {
      await addDoc(accountsRef, {
        ...acc,
        balance: 0,
        isSystem: true,
        createdAt: serverTimestamp()
      });
    }
  }
};

const findAccount = async (criteria: { name?: string, type?: string }) => {
  const accountsRef = collection(db, 'accounts');
  
  // 1. Try by name
  if (criteria.name) {
    const q = query(accountsRef, where('name', '==', criteria.name), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0];
  }

  // 2. Try by type
  if (criteria.type) {
    const q = query(accountsRef, where('type', '==', criteria.type), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0];
  }

  // 3. If it's a system account and still not found, try to ensure they exist and try one last time
  await ensureSystemAccounts();
  
  if (criteria.name) {
    const q = query(accountsRef, where('name', '==', criteria.name), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0];
  }

  if (criteria.type) {
    const q = query(accountsRef, where('type', '==', criteria.type), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0];
  }

  return null;
};

import { logAction } from './actionTrackingService';

export const createAccountingEntry = async (
  accountId: string,
  amount: number,
  type: 'debit' | 'credit',
  description: string,
  invoiceId?: string,
  userId?: string
) => {
  try {
    await runTransaction(db, async (transaction) => {
      // 1. READS FIRST
      const accountRef = doc(db, 'accounts', accountId);
      const accountDoc = await transaction.get(accountRef);
      if (!accountDoc.exists()) throw new Error("Account does not exist");
      
      const accountData = accountDoc.data();
      const isNaturalDebit = ['Asset', 'Expense'].includes(accountData.type);

      // 2. WRITES AFTER
      const txRef = doc(collection(db, 'transactions'));
      transaction.set(txRef, {
        date: new Date().toISOString(),
        accountId,
        amount,
        type,
        description,
        invoiceId: invoiceId || null,
        userId: userId || null,
        createdAt: serverTimestamp()
      });
      
      let balanceChange = 0;
      if (isNaturalDebit) {
        balanceChange = type === 'debit' ? amount : -amount;
      } else {
        balanceChange = type === 'credit' ? amount : -amount;
      }

      transaction.update(accountRef, {
        balance: increment(balanceChange)
      });
    });
    await logAction({
      userId: userId || 'system',
      userName: 'System',
      action: 'CREATE_ACCOUNTING_ENTRY',
      module: 'Accounting',
      details: `Entry for account ${accountId}: ${type} of SAR ${amount} - ${description}`
    });
  } catch (error) {
    console.error("Error creating accounting entry:", error);
    throw error;
  }
};

export const recordTreasuryMovement = async (
  type: 'income' | 'expense',
  amount: number,
  description: string,
  accountId: string,
  userId?: string
) => {
  const entryType = type === 'income' ? 'debit' : 'credit';
  await createAccountingEntry(accountId, amount, entryType, description, undefined, userId);
};

export const recordSupplierPayment = async (
  supplierId: string,
  amount: number,
  description: string,
  cashAccountId: string,
  userId?: string
) => {
  try {
    await runTransaction(db, async (transaction) => {
      // 1. Update Supplier Balance
      const supplierRef = doc(db, 'suppliers', supplierId);
      const supplierDoc = await transaction.get(supplierRef);
      if (!supplierDoc.exists()) throw new Error("Supplier not found");
      
      transaction.update(supplierRef, {
        balance: increment(-amount) // Payment reduces what we owe
      });

      // 2. Create Accounting Entry (Debit Accounts Payable, Credit Cash)
      // We'll assume there's an "Accounts Payable" account
      // For now, we'll just record the cash movement
      const txRef = doc(collection(db, 'transactions'));
      transaction.set(txRef, {
        date: new Date().toISOString(),
        accountId: cashAccountId,
        amount,
        type: 'credit', // Credit Cash (Asset) decreases it
        description: `Payment to Supplier: ${supplierDoc.data().name}. ${description}`,
        supplierId,
        createdAt: serverTimestamp()
      });
    });
    await logAction({
      userId: userId || 'system',
      userName: 'System',
      action: 'RECORD_SUPPLIER_PAYMENT',
      module: 'Treasury',
      details: `Payment of SAR ${amount} to supplier ${supplierId} - ${description}`
    });
  } catch (error) {
    console.error("Error recording supplier payment:", error);
    throw error;
  }
};

export const recordSalesInvoice = async (
  invoice: any,
  cashAccountId?: string
) => {
  try {
    // Find Revenue Account (Try "Sales Revenue" then any Revenue)
    const revenueAccount = await findAccount({ name: 'Sales Revenue', type: 'Revenue' });
    if (!revenueAccount) throw new Error('Revenue account not found. Please create a Revenue account first.');

    // Find AR Account if credit
    let debitAccountId = cashAccountId;
    if (!debitAccountId) {
      const arAccount = await findAccount({ name: 'Accounts Receivable', type: 'Asset' });
      if (!arAccount) throw new Error('Accounts Receivable account not found. Please create an Asset account named "Accounts Receivable".');
      debitAccountId = arAccount.id;
    }

    await runTransaction(db, async (transaction) => {
      const entries = [
        {
          accountId: debitAccountId!,
          type: 'debit' as const,
          amount: invoice.total
        },
        {
          accountId: revenueAccount.id,
          type: 'credit' as const,
          amount: invoice.total
        }
      ];

      // 1. READS FIRST
      const accountDocs: any[] = [];
      for (const entry of entries) {
        const accountRef = doc(db, 'accounts', entry.accountId);
        const accountDoc = await transaction.get(accountRef);
        if (!accountDoc.exists()) throw new Error(`Account ${entry.accountId} not found`);
        accountDocs.push({ ref: accountRef, doc: accountDoc, entry });
      }

      let customerDoc = null;
      let customerRef = null;
      if (!cashAccountId && invoice.customerId) {
        customerRef = doc(db, 'customers', invoice.customerId);
        customerDoc = await transaction.get(customerRef);
        if (!customerDoc.exists()) throw new Error("Customer not found");
      }

      // 2. WRITES AFTER
      const txRef = doc(collection(db, 'transactions'));
      transaction.set(txRef, {
        date: new Date().toISOString(),
        type: 'Sales Invoice',
        description: `Invoice ${invoice.number}`,
        entries,
        total: invoice.total,
        referenceId: invoice.id,
        createdAt: serverTimestamp()
      });

      // Update Account Balances
      for (const item of accountDocs) {
        const accountData = item.doc.data() as Account;
        const isNaturalDebit = ['Asset', 'Expense'].includes(accountData.type);
        
        let balanceChange = 0;
        if (isNaturalDebit) {
          balanceChange = item.entry.type === 'debit' ? item.entry.amount : -item.entry.amount;
        } else {
          balanceChange = item.entry.type === 'credit' ? item.entry.amount : -item.entry.amount;
        }

        transaction.update(item.ref, {
          balance: increment(balanceChange)
        });
      }

      // Update Customer Balance if credit
      if (customerRef) {
        transaction.update(customerRef, {
          balance: increment(invoice.total),
          totalPurchases: increment(invoice.total)
        });
      }
    });
    await logAction({
      userId: 'system',
      userName: 'System',
      action: 'RECORD_SALES_INVOICE',
      module: 'Sales',
      details: `Invoice ${invoice.number} - Total: SAR ${invoice.total}`
    });
  } catch (error) {
    console.error("Error recording sales invoice:", error);
    throw error;
  }
};

export const recordPurchaseInvoice = async (
  invoice: any,
  cashAccountId?: string
) => {
  try {
    // Find Inventory Account (Asset)
    const inventoryAccount = await findAccount({ name: 'Inventory', type: 'Asset' });
    if (!inventoryAccount) throw new Error('Inventory account not found. Please create an Asset account named "Inventory".');

    // Find AP Account if credit
    let creditAccountId = cashAccountId;
    if (!creditAccountId) {
      const apAccount = await findAccount({ name: 'Accounts Payable', type: 'Liability' });
      if (!apAccount) throw new Error('Accounts Payable account not found. Please create a Liability account named "Accounts Payable".');
      creditAccountId = apAccount.id;
    }

    await runTransaction(db, async (transaction) => {
      const entries = [
        {
          accountId: inventoryAccount.id,
          type: 'debit' as const,
          amount: invoice.total
        },
        {
          accountId: creditAccountId!,
          type: 'credit' as const,
          amount: invoice.total
        }
      ];

      // 1. READS FIRST
      const accountDocs: any[] = [];
      for (const entry of entries) {
        const accountRef = doc(db, 'accounts', entry.accountId);
        const accountDoc = await transaction.get(accountRef);
        if (!accountDoc.exists()) throw new Error(`Account ${entry.accountId} not found`);
        accountDocs.push({ ref: accountRef, doc: accountDoc, entry });
      }

      let supplierDoc = null;
      let supplierRef = null;
      if (!cashAccountId && invoice.supplierId) {
        supplierRef = doc(db, 'suppliers', invoice.supplierId);
        supplierDoc = await transaction.get(supplierRef);
        if (!supplierDoc.exists()) throw new Error("Supplier not found");
      }

      // 2. WRITES AFTER
      const txRef = doc(collection(db, 'transactions'));
      transaction.set(txRef, {
        date: new Date().toISOString(),
        type: 'Purchase Invoice',
        description: `Purchase Invoice ${invoice.number}`,
        entries,
        total: invoice.total,
        referenceId: invoice.id,
        createdAt: serverTimestamp()
      });

      // Update Account Balances
      for (const item of accountDocs) {
        const accountData = item.doc.data() as Account;
        const isNaturalDebit = ['Asset', 'Expense'].includes(accountData.type);
        
        let balanceChange = 0;
        if (isNaturalDebit) {
          balanceChange = item.entry.type === 'debit' ? item.entry.amount : -item.entry.amount;
        } else {
          balanceChange = item.entry.type === 'credit' ? item.entry.amount : -item.entry.amount;
        }

        transaction.update(item.ref, {
          balance: increment(balanceChange)
        });
      }

      // Update Supplier Balance if credit
      if (supplierRef) {
        transaction.update(supplierRef, {
          balance: increment(invoice.total) // We owe more
        });
      }
    });
    await logAction({
      userId: 'system',
      userName: 'System',
      action: 'RECORD_PURCHASE_INVOICE',
      module: 'Purchases',
      details: `Purchase Invoice ${invoice.number} - Total: SAR ${invoice.total}`
    });
  } catch (error) {
    console.error("Error recording purchase invoice:", error);
    throw error;
  }
};

export const recordExpense = async (
  amount: number,
  description: string,
  expenseAccountId: string,
  cashAccountId: string,
  userId?: string
) => {
  try {
    await runTransaction(db, async (transaction) => {
      const expenseRef = doc(db, 'accounts', expenseAccountId);
      const cashRef = doc(db, 'accounts', cashAccountId);
      
      const expenseDoc = await transaction.get(expenseRef);
      const cashDoc = await transaction.get(cashRef);
      
      if (!expenseDoc.exists() || !cashDoc.exists()) throw new Error("Account not found");

      // Record Transaction
      const txRef = doc(collection(db, 'transactions'));
      transaction.set(txRef, {
        date: new Date().toISOString(),
        type: 'Expense',
        description,
        amount,
        debitAccountId: expenseAccountId,
        creditAccountId: cashAccountId,
        userId: userId || null,
        createdAt: serverTimestamp()
      });

      // Update Balances
      transaction.update(expenseRef, { balance: increment(amount) }); // Expense (Debit) increases
      transaction.update(cashRef, { balance: increment(-amount) }); // Cash (Asset) decreases
    });
    await logAction({
      userId: userId || 'system',
      userName: 'System',
      action: 'RECORD_EXPENSE',
      module: 'Treasury',
      details: `Expense of SAR ${amount} - ${description}`
    });
  } catch (error) {
    console.error("Error recording expense:", error);
    throw error;
  }
};

export const recordCashMovement = async (
  amount: number,
  description: string,
  type: 'in' | 'out',
  cashAccountId: string,
  userId?: string
) => {
  try {
    await runTransaction(db, async (transaction) => {
      const cashRef = doc(db, 'accounts', cashAccountId);
      const cashDoc = await transaction.get(cashRef);
      if (!cashDoc.exists()) throw new Error("Cash account not found");

      const txRef = doc(collection(db, 'transactions'));
      transaction.set(txRef, {
        date: new Date().toISOString(),
        type: type === 'in' ? 'Cash In' : 'Cash Out',
        description,
        amount,
        accountId: cashAccountId,
        userId: userId || null,
        createdAt: serverTimestamp()
      });

      transaction.update(cashRef, {
        balance: increment(type === 'in' ? amount : -amount)
      });
    });
    await logAction({
      userId: userId || 'system',
      userName: 'System',
      action: 'RECORD_CASH_MOVEMENT',
      module: 'Treasury',
      details: `Cash ${type} of SAR ${amount} - ${description}`
    });
  } catch (error) {
    console.error("Error recording cash movement:", error);
    throw error;
  }
};

export const recordCustomerPayment = async (
  customerId: string,
  amount: number,
  method: string,
  notes: string,
  cashAccountId: string,
  userId?: string
) => {
  try {
    const arAccount = await findAccount({ name: 'Accounts Receivable', type: 'Asset' });
    if (!arAccount) throw new Error('Accounts Receivable account not found.');

    await runTransaction(db, async (transaction) => {
      // 1. Update Customer Balance
      const customerRef = doc(db, 'customers', customerId);
      const customerDoc = await transaction.get(customerRef);
      if (!customerDoc.exists()) throw new Error("Customer not found");
      
      transaction.update(customerRef, {
        balance: increment(-amount), // Payment reduces what they owe
        totalPaid: increment(amount)
      });

      // 2. Record Payment in 'payments' collection
      const paymentRef = doc(collection(db, 'payments'));
      transaction.set(paymentRef, {
        date: new Date().toISOString(),
        customerId,
        customerName: customerDoc.data().name,
        amount,
        method,
        notes,
        userId: userId || 'system',
        createdAt: serverTimestamp()
      });

      // 3. Create Accounting Entries (Debit Cash, Credit Accounts Receivable)
      const entries = [
        {
          accountId: cashAccountId,
          type: 'debit' as const,
          amount
        },
        {
          accountId: arAccount.id,
          type: 'credit' as const,
          amount
        }
      ];

      const txRef = doc(collection(db, 'transactions'));
      transaction.set(txRef, {
        date: new Date().toISOString(),
        type: 'Customer Payment',
        description: `Payment from Customer: ${customerDoc.data().name}. ${notes}`,
        entries,
        total: amount,
        customerId,
        createdAt: serverTimestamp()
      });

      // Update Account Balances
      // Cash (Asset) Debit -> Increase
      const cashRef = doc(db, 'accounts', cashAccountId);
      transaction.update(cashRef, { balance: increment(amount) });

      // AR (Asset) Credit -> Decrease
      const arRef = doc(db, 'accounts', arAccount.id);
      transaction.update(arRef, { balance: increment(-amount) });
    });

    await logAction({
      userId: userId || 'system',
      userName: 'System',
      action: 'RECORD_CUSTOMER_PAYMENT',
      module: 'Treasury',
      details: `Payment of SAR ${amount} from customer ${customerId} - ${notes}`
    });
  } catch (error) {
    console.error("Error recording customer payment:", error);
    throw error;
  }
};
