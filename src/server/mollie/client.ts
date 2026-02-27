import createMollieClient from "@mollie/api-client";
import { env } from "~/env";

const globalForMollie = globalThis as unknown as {
  mollieClient: ReturnType<typeof createMollieClient> | undefined;
};

export const mollieClient =
  globalForMollie.mollieClient ??
  createMollieClient({ apiKey: env.MOLLIE_API_KEY });

if (env.NODE_ENV !== "production") globalForMollie.mollieClient = mollieClient;
