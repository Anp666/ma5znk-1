export type UserRole = 'admin' | 'accountant' | 'cashier' | 'manager';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  permissions: string[];
  createdAt: string;
  currency?: 'EGP' | 'SAR';
  phoneNumber?: string;
  password?: string; // For custom auth simulation
}

export interface Cheque {
  id: string;
  number: string;
  bank: string;
  amount: number;
  dueDate: string;
  type: 'incoming' | 'outgoing';
  status: 'pending' | 'cleared' | 'rejected';
  entityId: string;
  entityName: string;
  accountId: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Product {
  id?: string;
  name: string;
  sku: string;
  barcode?: string;
  purchasePrice: number;
  sellingPrice: number; // Retail Price
  wholesalePrice: number;
  vipPrice: number;
  quantity: number;
  minStock: number;
  categoryId?: string;
  supplierId?: string;
  unit?: string;
  description?: string;
  imageUrl?: string;
  userId?: string;
}

export interface Category {
  id?: string;
  name: string;
  description?: string;
}

export interface Account {
  id?: string;
  code: string;
  name: string;
  type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  parentId?: string;
  balance: number;
  isSystem?: boolean;
}

export interface Transaction {
  id?: string;
  date: string;
  accountId: string;
  amount: number;
  type: 'debit' | 'credit';
  description: string;
  invoiceId?: string;
  userId: string;
}

export type PriceType = 'retail' | 'wholesale' | 'vip';

export interface InvoiceItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  priceType?: PriceType;
}

export interface Invoice {
  id?: string;
  number: string;
  type: 'sales' | 'purchase' | 'return';
  date: string;
  customerId?: string;
  customerName?: string;
  supplierId?: string;
  supplierName?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  discountType: 'percentage' | 'fixed';
  taxRate: number;
  tax: number;
  total: number;
  paidAmount: number;
  paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'credit';
  status: 'paid' | 'partially_paid' | 'unpaid' | 'pending' | 'cancelled';
  userId: string;
  priceType?: PriceType;
}

export interface Customer {
  id?: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  balance: number;
  totalPurchases: number;
  totalPaid: number;
  userId?: string;
}

export interface Payment {
  id?: string;
  date: string;
  customerId: string;
  customerName: string;
  amount: number;
  method: 'cash' | 'bank_transfer' | 'other';
  notes?: string;
  userId: string;
  invoiceId?: string; // Optional: link to a specific invoice
}

export interface Supplier {
  id?: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;
  balance: number;
  userId?: string;
}

export interface Expense {
  id?: string;
  date: string;
  amount: number;
  categoryId: string;
  accountId: string;
  description: string;
  userId: string;
  reference?: string;
}

export interface AppSettings {
  id?: string;
  currency: 'EGP' | 'SAR';
  userId: string;
  storeName?: string;
  address?: string;
  phone?: string;
}
