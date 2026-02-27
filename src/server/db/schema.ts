import { relations } from "drizzle-orm";
import {
  boolean,
  index,
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

export const customer = pgTable("customer", (d) => ({
  id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
  userId: d
    .text()
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  mollieCustomerId: d.text().notNull().unique(),
  createdAt: d
    .timestamp({ withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
}));

export const subscription = pgTable(
  "subscription",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: d
      .text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    mollieSubscriptionId: d.text().unique(),
    mollieCustomerId: d.text().notNull(),
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
    molliePaymentId: d.text().notNull().unique(),
    mollieSubscriptionId: d.text(),
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
  (t) => [
    uniqueIndex("processed_emails_msg_id_idx").on(t.gmailMessageId),
  ],
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
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
    () => new Date(),
  ),
});

// ── Relations ───────────────────────────────────────────────────
export const userRelations = relations(user, ({ many }) => ({
  account: many(account),
  session: many(session),
  subscriptions: many(subscription),
  payments: many(payment),
  invoiceUsages: many(invoiceUsage),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const customerRelations = relations(customer, ({ one }) => ({
  user: one(user, { fields: [customer.userId], references: [user.id] }),
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
}));
