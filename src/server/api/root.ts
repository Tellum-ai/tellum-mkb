import { emailRouter } from "~/server/api/routers/email";
import { invoiceRouter } from "~/server/api/routers/invoice";
import { contactRouter } from "~/server/api/routers/contact";
import { billingRouter } from "~/server/api/routers/billing";
import { ledgerRouter } from "~/server/api/routers/ledger";
import { bankRouter } from "~/server/api/routers/bank";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  invoice: invoiceRouter,
  contact: contactRouter,
  billing: billingRouter,
  email: emailRouter,
  ledger: ledgerRouter,
  bank: bankRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
