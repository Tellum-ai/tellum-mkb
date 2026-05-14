import type { SaasSupplier } from "../types.js"

export const VERCEL: SaasSupplier = {
  type: "saas",
  name: "Vercel",
  email: "billing@vercel.com",
  domain: "vercel.com",
  address: "340 Pine Street, Suite 1200",
  city: "San Francisco",
  state: "CA",
  zip: "94104",
  country: "United States",
}

export const GITHUB: SaasSupplier = {
  type: "saas",
  name: "GitHub",
  email: "billing@github.com",
  domain: "github.com",
  address: "88 Colin P Kelly Jr Street",
  city: "San Francisco",
  state: "CA",
  zip: "94107",
  country: "United States",
}
