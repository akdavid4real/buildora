import { prisma } from '@buildora/database';

let commerceReady: Promise<void> | null = null;

async function initializeCommerceSchema() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS commerce_products (
      id TEXT PRIMARY KEY NOT NULL,
      siteId TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'NGN',
      imageUrl TEXT,
      stockQuantity INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(siteId, slug)
    )`,
    `CREATE TABLE IF NOT EXISTS commerce_orders (
      id TEXT PRIMARY KEY NOT NULL,
      siteId TEXT NOT NULL,
      customerName TEXT NOT NULL,
      customerEmail TEXT NOT NULL,
      customerPhone TEXT,
      items TEXT NOT NULL,
      subtotal INTEGER NOT NULL,
      total INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'NGN',
      status TEXT NOT NULL DEFAULT 'PENDING',
      paymentStatus TEXT NOT NULL DEFAULT 'UNPAID',
      paymentReference TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS commerce_products_siteId_status_idx ON commerce_products(siteId, status)`,
    `CREATE INDEX IF NOT EXISTS commerce_orders_siteId_createdAt_idx ON commerce_orders(siteId, createdAt)`,
  ];

  for (const statement of statements) await prisma.$executeRawUnsafe(statement);
}

export async function ensureCommerceSchema() {
  commerceReady ??= initializeCommerceSchema().catch((error) => {
    commerceReady = null;
    throw error;
  });
  return commerceReady;
}

export type CommerceProductRow = {
  id: string;
  siteId: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  imageUrl: string | null;
  stockQuantity: number;
  status: 'DRAFT' | 'PUBLISHED';
  createdAt: string;
  updatedAt: string;
};

export type CommerceOrderRow = {
  id: string;
  siteId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  items: string;
  subtotal: number;
  total: number;
  currency: string;
  status: string;
  paymentStatus: string;
  paymentReference: string | null;
  createdAt: string;
  updatedAt: string;
};
