import type { DutchSupplier } from "../types.js"

export const KPN: DutchSupplier = {
  type: "dutch",
  name: "KPN",
  legalName: "KPN B.V.",
  email: "facturen@kpn.com",
  domain: "kpn.com",
  address: "Wilhelminakade 123",
  postalCode: "3072 AP",
  city: "Rotterdam",
  kvk: "27124701",
  btwNumber: "NL004073488B01",
  iban: "NL91 ABNA 0417 1643 00",
  invoicePrefix: "KPN",
}

export const TRANSIP: DutchSupplier = {
  type: "dutch",
  name: "TransIP",
  legalName: "TransIP B.V.",
  email: "facturen@transip.nl",
  domain: "transip.nl",
  address: "Schipholweg 9-11",
  postalCode: "2316 XA",
  city: "Leiden",
  kvk: "34280739",
  btwNumber: "NL820538678B01",
  iban: "NL65 RABO 0193 9400 61",
  invoicePrefix: "F",
}

export const ENECO: DutchSupplier = {
  type: "dutch",
  name: "Eneco",
  legalName: "Eneco Energie Retail B.V.",
  email: "factuur@eneco.nl",
  domain: "eneco.nl",
  address: "Marten Meesweg 5",
  postalCode: "3068 AV",
  city: "Rotterdam",
  kvk: "24316604",
  btwNumber: "NL008073665B01",
  iban: "NL55 INGB 0000 1234 56",
  invoicePrefix: "EN",
}
