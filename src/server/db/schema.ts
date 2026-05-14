import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const posts = pgTable(
  "post",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    name: d.varchar({ length: 256 }),
    createdById: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => user.id),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("created_by_idx").on(t.createdById),
    index("name_idx").on(t.name),
  ],
);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(
    () => /* @__PURE__ */ new Date(),
  ),
  updatedAt: timestamp("updated_at").$defaultFn(
    () => /* @__PURE__ */ new Date(),
  ),
});

// ── Billing tables ──────────────────────────────────────────────

export const subscription = pgTable(
  "subscription",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: d
      .text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    plan: d.varchar({ length: 20 }).notNull(), // starter / pro / unlimited
    billingCycle: d.varchar({ length: 10 }).notNull(), // monthly / yearly
    status: d.varchar({ length: 30 }).notNull(), // trialing / active / cancelled / suspended / expired
    trialStartedAt: d.timestamp({ withTimezone: true }),
    trialEndsAt: d.timestamp({ withTimezone: true }),
    activatedAt: d.timestamp({ withTimezone: true }),
    cancelledAt: d.timestamp({ withTimezone: true }),
    currentPeriodStart: d.timestamp({ withTimezone: true }),
    currentPeriodEnd: d.timestamp({ withTimezone: true }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [index("subscription_user_idx").on(t.userId)],
);

export const payment = pgTable(
  "payment",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: d
      .text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    amount: d.integer().notNull(), // cents
    currency: d.varchar({ length: 3 }).notNull().default("EUR"),
    status: d.varchar({ length: 20 }).notNull(), // open/pending/paid/failed/expired/canceled
    description: d.text(),
    method: d.varchar({ length: 30 }),
    sequenceType: d.varchar({ length: 10 }).notNull(), // first / recurring
    paidAt: d.timestamp({ withTimezone: true }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [index("payment_user_idx").on(t.userId)],
);

export const invoiceUsage = pgTable(
  "invoice_usage",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: d
      .text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    year: d.integer().notNull(),
    month: d.integer().notNull(), // 1-12
    invoiceCount: d.integer().notNull().default(0),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [unique("invoice_usage_user_month").on(t.userId, t.year, t.month)],
);

// ── Contacts table ──────────────────────────────────────────────

export const contacts = pgTable(
  "contacts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    companyName: text("company_name"),
    // bookkeeping identity
    type: text("type", { enum: ["debiteur", "crediteur", "beide"] })
      .notNull()
      .default("crediteur"),
    kvkNumber: text("kvk_number"),
    vatNumber: text("vat_number"), // BTW-nummer, e.g. NL123456789B01
    iban: text("iban"),
    // address
    street: text("street"),
    city: text("city"),
    postalCode: text("postal_code"),
    country: text("country").default("NL"),
    // email processing
    isWhitelisted: boolean("is_whitelisted").notNull().default(false),
    autoApprove: boolean("auto_approve").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (t) => [
    index("contacts_user_idx").on(t.userId),
    unique("contacts_user_email").on(t.userId, t.email),
  ],
);

// ── Bookkeeping: Chart of accounts ─────────────────────────────

export const ledgerAccounts = pgTable(
  "ledger_accounts",
  (d) => ({
    id: d.text().primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: d
      .text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    number: d.integer().notNull(), // e.g. 1000, 4500
    name: d.text().notNull(),
    type: d
      .text("type", { enum: ["activa", "passiva", "omzet", "kosten"] })
      .notNull(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("ledger_accounts_user_idx").on(t.userId),
    unique("ledger_accounts_user_number").on(t.userId, t.number),
  ],
);

// ── Bookkeeping: Journal entries (double-entry) ─────────────────

export const journalEntries = pgTable(
  "journal_entries",
  (d) => ({
    id: d.text().primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: d
      .text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: d.timestamp({ withTimezone: true }).notNull(),
    description: d.text().notNull(),
    reference: d.text(), // invoice number, bank reference, etc.
    type: d
      .text("type", {
        enum: ["purchase_invoice", "sales_invoice", "bank_payment", "manual"],
      })
      .notNull(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("journal_entries_user_idx").on(t.userId),
    index("journal_entries_date_idx").on(t.date),
  ],
);

// Each line is either a debit OR a credit — never both. Debit + credit per
// entry must balance (enforced at application level).
export const journalEntryLines = pgTable(
  "journal_entry_lines",
  (d) => ({
    id: d.text().primaryKey().$defaultFn(() => crypto.randomUUID()),
    journalEntryId: d
      .text()
      .notNull()
      .references(() => journalEntries.id, { onDelete: "cascade" }),
    ledgerAccountId: d
      .text()
      .notNull()
      .references(() => ledgerAccounts.id),
    debit: d.integer(), // cents, null if this is a credit line
    credit: d.integer(), // cents, null if this is a debit line
    description: d.text(),
  }),
  (t) => [index("journal_entry_lines_entry_idx").on(t.journalEntryId)],
);

// ── Bookkeeping: Outgoing invoices (verkoopfacturen) ────────────

export const salesInvoices = pgTable(
  "sales_invoices",
  (d) => ({
    id: d.text().primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: d
      .text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    contactId: d.text().references(() => contacts.id, {
      onDelete: "set null",
    }),
    invoiceNumber: d.text().notNull(),
    invoiceDate: d.timestamp({ withTimezone: true }).notNull(),
    dueDate: d.timestamp({ withTimezone: true }),
    status: d
      .text("status", {
        enum: ["concept", "verstuurd", "betaald", "vervallen"],
      })
      .notNull()
      .default("concept"),
    notes: d.text(),
    journalEntryId: d.text().references(() => journalEntries.id, {
      onDelete: "set null",
    }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("sales_invoices_user_idx").on(t.userId),
    unique("sales_invoices_user_number").on(t.userId, t.invoiceNumber),
  ],
);

export const salesInvoiceLines = pgTable(
  "sales_invoice_lines",
  (d) => ({
    id: d.text().primaryKey().$defaultFn(() => crypto.randomUUID()),
    salesInvoiceId: d
      .text()
      .notNull()
      .references(() => salesInvoices.id, { onDelete: "cascade" }),
    description: d.text().notNull(),
    quantity: d.integer().notNull().default(1), // whole units for v1
    unitPrice: d.integer().notNull(), // cents excl. BTW
    vatRate: d.integer().notNull().default(21), // 0, 9, or 21
    ledgerAccountId: d.text().references(() => ledgerAccounts.id, {
      onDelete: "set null",
    }),
  }),
  (t) => [index("sales_invoice_lines_invoice_idx").on(t.salesInvoiceId)],
);

// ── Bookkeeping: Bank connections (Plaid) ──────────────────────

export const bankConnections = pgTable(
  "bank_connections",
  (d) => ({
    id: d.text().primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: d
      .text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: d
      .text("provider", { enum: ["plaid", "nordigen", "demo"] })
      .notNull()
      .default("demo"),
    institutionName: d.text(),
    accountName: d.text(),
    accountIban: d.text(),
    lastSyncAt: d.timestamp({ withTimezone: true }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [index("bank_connections_user_idx").on(t.userId)],
);

export const bankTransactions = pgTable(
  "bank_transactions",
  (d) => ({
    id: d.text().primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: d
      .text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    bankConnectionId: d
      .text()
      .notNull()
      .references(() => bankConnections.id, { onDelete: "cascade" }),
    plaidTransactionId: d.text().unique(), // idempotency
    date: d.timestamp({ withTimezone: true }).notNull(),
    amount: d.integer().notNull(), // cents, negative = money leaving account
    description: d.text(),
    merchantName: d.text(),
    status: d
      .text("status", { enum: ["pending", "posted"] })
      .notNull()
      .default("posted"),
    // set once matched to an open crediteuren/debiteuren journaalpost
    journalEntryId: d.text().references(() => journalEntries.id, {
      onDelete: "set null",
    }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [
    index("bank_transactions_user_idx").on(t.userId),
    index("bank_transactions_connection_idx").on(t.bankConnectionId),
  ],
);

// ── Email processing tables ─────────────────────────────────────

// Idempotency table — tracks every Gmail message we have seen to prevent
// duplicate processing across cron runs.
export const processedEmails = pgTable(
  "processed_emails",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    gmailMessageId: text("gmail_message_id").notNull().unique(),
    imapUid: text("imap_uid"),
    subject: text("subject"),
    fromAddress: text("from_address"),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    processedAt: timestamp("processed_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    wasInvoice: text("was_invoice", { enum: ["yes", "no"] }).notNull(),
  },
  (t) => [uniqueIndex("processed_emails_msg_id_idx").on(t.gmailMessageId)],
);

// Stores extracted invoice JSON from Gemini AI plus downstream status.
export const invoices = pgTable("invoices", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  processedEmailId: text("processed_email_id")
    .notNull()
    .references(() => processedEmails.id, { onDelete: "cascade" }),
  gmailMessageId: text("gmail_message_id").notNull(),
  invoiceData: jsonb("invoice_data").notNull(),
  status: text("status", {
    enum: ["not_processed", "processing", "processed", "error"],
  })
    .notNull()
    .default("not_processed"),
  invoiceNumber: text("invoice_number"),
  invoiceDate: text("invoice_date"),
  senderCompany: text("sender_company"),
  totalInclVat: text("total_incl_vat"),
  /** R2 URLs of every PDF attachment that was saved for this invoice email */
  pdfUrls: text("pdf_urls").array().default([]),
  contactId: text("contact_id").references(() => contacts.id, {
    onDelete: "set null",
  }),
  /** Set after the invoice is approved and booked into the ledger */
  journalEntryId: text("journal_entry_id").references(() => journalEntries.id, {
    onDelete: "set null",
  }),
  /** Payment status: nieuw → goedgekeurd → ingepland → betaald */
  paymentStatus: text("payment_status", {
    enum: ["nieuw", "goedgekeurd", "ingepland", "betaald"],
  })
    .notNull()
    .default("nieuw"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
    () => new Date(),
  ),
});

// ── Relations ───────────────────────────────────────────────────

export const userRelations = relations(user, ({ many }) => ({
  accounts: many(account),
  sessions: many(session),
  subscriptions: many(subscription),
  payments: many(payment),
  invoiceUsages: many(invoiceUsage),
  contacts: many(contacts),
  ledgerAccounts: many(ledgerAccounts),
  journalEntries: many(journalEntries),
  salesInvoices: many(salesInvoices),
  bankConnections: many(bankConnections),
  bankTransactions: many(bankTransactions),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const subscriptionRelations = relations(subscription, ({ one }) => ({
  user: one(user, { fields: [subscription.userId], references: [user.id] }),
}));

export const paymentRelations = relations(payment, ({ one }) => ({
  user: one(user, { fields: [payment.userId], references: [user.id] }),
}));

export const invoiceUsageRelations = relations(invoiceUsage, ({ one }) => ({
  user: one(user, { fields: [invoiceUsage.userId], references: [user.id] }),
}));

export const contactRelations = relations(contacts, ({ one, many }) => ({
  user: one(user, { fields: [contacts.userId], references: [user.id] }),
  invoices: many(invoices),
  salesInvoices: many(salesInvoices),
}));

export const ledgerAccountRelations = relations(ledgerAccounts, ({ one, many }) => ({
  user: one(user, { fields: [ledgerAccounts.userId], references: [user.id] }),
  journalEntryLines: many(journalEntryLines),
  salesInvoiceLines: many(salesInvoiceLines),
}));

export const journalEntryRelations = relations(journalEntries, ({ one, many }) => ({
  user: one(user, { fields: [journalEntries.userId], references: [user.id] }),
  lines: many(journalEntryLines),
  invoice: one(invoices, {
    fields: [journalEntries.id],
    references: [invoices.journalEntryId],
  }),
  salesInvoice: one(salesInvoices, {
    fields: [journalEntries.id],
    references: [salesInvoices.journalEntryId],
  }),
  bankTransaction: one(bankTransactions, {
    fields: [journalEntries.id],
    references: [bankTransactions.journalEntryId],
  }),
}));

export const journalEntryLineRelations = relations(journalEntryLines, ({ one }) => ({
  journalEntry: one(journalEntries, {
    fields: [journalEntryLines.journalEntryId],
    references: [journalEntries.id],
  }),
  ledgerAccount: one(ledgerAccounts, {
    fields: [journalEntryLines.ledgerAccountId],
    references: [ledgerAccounts.id],
  }),
}));

export const salesInvoiceRelations = relations(salesInvoices, ({ one, many }) => ({
  user: one(user, { fields: [salesInvoices.userId], references: [user.id] }),
  contact: one(contacts, {
    fields: [salesInvoices.contactId],
    references: [contacts.id],
  }),
  journalEntry: one(journalEntries, {
    fields: [salesInvoices.journalEntryId],
    references: [journalEntries.id],
  }),
  lines: many(salesInvoiceLines),
}));

export const salesInvoiceLineRelations = relations(salesInvoiceLines, ({ one }) => ({
  salesInvoice: one(salesInvoices, {
    fields: [salesInvoiceLines.salesInvoiceId],
    references: [salesInvoices.id],
  }),
  ledgerAccount: one(ledgerAccounts, {
    fields: [salesInvoiceLines.ledgerAccountId],
    references: [ledgerAccounts.id],
  }),
}));

export const bankConnectionRelations = relations(bankConnections, ({ one, many }) => ({
  user: one(user, { fields: [bankConnections.userId], references: [user.id] }),
  transactions: many(bankTransactions),
}));

export const bankTransactionRelations = relations(bankTransactions, ({ one }) => ({
  user: one(user, { fields: [bankTransactions.userId], references: [user.id] }),
  bankConnection: one(bankConnections, {
    fields: [bankTransactions.bankConnectionId],
    references: [bankConnections.id],
  }),
  journalEntry: one(journalEntries, {
    fields: [bankTransactions.journalEntryId],
    references: [journalEntries.id],
  }),
}));

export const processedEmailRelations = relations(
  processedEmails,
  ({ one }) => ({
    invoice: one(invoices, {
      fields: [processedEmails.id],
      references: [invoices.processedEmailId],
    }),
  }),
);

export const invoiceRelations = relations(invoices, ({ one }) => ({
  processedEmail: one(processedEmails, {
    fields: [invoices.processedEmailId],
    references: [processedEmails.id],
  }),
  contact: one(contacts, {
    fields: [invoices.contactId],
    references: [contacts.id],
  }),
  journalEntry: one(journalEntries, {
    fields: [invoices.journalEntryId],
    references: [journalEntries.id],
  }),
}));
