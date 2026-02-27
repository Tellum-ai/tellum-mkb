export type InvoiceStatus = "nieuw" | "goedgekeurd" | "betaald";

export interface Invoice {
  id: string;
  leverancier: string;
  leverancierEmail: string;
  onderwerp: string;
  bedrag: number;
  btw: number;
  totaal: number;
  factuurnummer: string;
  factuurdatum: string;
  vervaldatum: string;
  status: InvoiceStatus;
  ontvangen: string;
}

export const mockInvoices: Invoice[] = [
  {
    id: "1",
    leverancier: "Coolblue B.V.",
    leverancierEmail: "facturen@coolblue.nl",
    onderwerp: "Kantoorbenodigdheden februari",
    bedrag: 245.0,
    btw: 51.45,
    totaal: 296.45,
    factuurnummer: "CB-2026-0847",
    factuurdatum: "2026-02-20",
    vervaldatum: "2026-03-20",
    status: "nieuw",
    ontvangen: "2026-02-20",
  },
  {
    id: "2",
    leverancier: "KPN Zakelijk",
    leverancierEmail: "billing@kpn.com",
    onderwerp: "Telefonie & internet februari",
    bedrag: 89.5,
    btw: 18.8,
    totaal: 108.3,
    factuurnummer: "KPN-8834921",
    factuurdatum: "2026-02-18",
    vervaldatum: "2026-03-18",
    status: "nieuw",
    ontvangen: "2026-02-18",
  },
  {
    id: "3",
    leverancier: "Greenwheels",
    leverancierEmail: "factuur@greenwheels.nl",
    onderwerp: "Deelauto januari",
    bedrag: 156.0,
    btw: 32.76,
    totaal: 188.76,
    factuurnummer: "GW-2026-1204",
    factuurdatum: "2026-02-01",
    vervaldatum: "2026-03-01",
    status: "goedgekeurd",
    ontvangen: "2026-02-02",
  },
  {
    id: "4",
    leverancier: "Drukwerkdeal",
    leverancierEmail: "administratie@drukwerkdeal.nl",
    onderwerp: "Visitekaartjes 500 stuks",
    bedrag: 67.5,
    btw: 14.18,
    totaal: 81.68,
    factuurnummer: "DWD-90234",
    factuurdatum: "2026-02-15",
    vervaldatum: "2026-03-15",
    status: "nieuw",
    ontvangen: "2026-02-15",
  },
  {
    id: "5",
    leverancier: "TransIP",
    leverancierEmail: "billing@transip.nl",
    onderwerp: "Webhosting & domein Q1 2026",
    bedrag: 49.95,
    btw: 10.49,
    totaal: 60.44,
    factuurnummer: "TIP-2026-445",
    factuurdatum: "2026-01-15",
    vervaldatum: "2026-02-15",
    status: "betaald",
    ontvangen: "2026-01-15",
  },
  {
    id: "6",
    leverancier: "Bol.com Zakelijk",
    leverancierEmail: "factuur@bol.com",
    onderwerp: "Kantoormeubelen",
    bedrag: 1249.0,
    btw: 262.29,
    totaal: 1511.29,
    factuurnummer: "BOL-ZAK-77291",
    factuurdatum: "2026-01-28",
    vervaldatum: "2026-02-28",
    status: "goedgekeurd",
    ontvangen: "2026-01-29",
  },
  {
    id: "7",
    leverancier: "PostNL",
    leverancierEmail: "facturatie@postnl.nl",
    onderwerp: "Verzendkosten januari",
    bedrag: 34.2,
    btw: 7.18,
    totaal: 41.38,
    factuurnummer: "PNL-2026-2891",
    factuurdatum: "2026-02-05",
    vervaldatum: "2026-03-05",
    status: "betaald",
    ontvangen: "2026-02-05",
  },
  {
    id: "8",
    leverancier: "Essent Zakelijk",
    leverancierEmail: "facturen@essent.nl",
    onderwerp: "Energie februari",
    bedrag: 312.0,
    btw: 65.52,
    totaal: 377.52,
    factuurnummer: "ESS-9920384",
    factuurdatum: "2026-02-22",
    vervaldatum: "2026-03-22",
    status: "nieuw",
    ontvangen: "2026-02-22",
  },
  {
    id: "9",
    leverancier: "Exact Online",
    leverancierEmail: "billing@exact.com",
    onderwerp: "Boekhoudpakket maandlicentie",
    bedrag: 45.0,
    btw: 9.45,
    totaal: 54.45,
    factuurnummer: "EXA-2026-0302",
    factuurdatum: "2026-02-01",
    vervaldatum: "2026-03-01",
    status: "betaald",
    ontvangen: "2026-02-01",
  },
  {
    id: "10",
    leverancier: "Staples Nederland",
    leverancierEmail: "factuur@staples.nl",
    onderwerp: "Printerpapier & toner",
    bedrag: 178.5,
    btw: 37.49,
    totaal: 215.99,
    factuurnummer: "STA-NL-44829",
    factuurdatum: "2026-02-12",
    vervaldatum: "2026-03-12",
    status: "goedgekeurd",
    ontvangen: "2026-02-13",
  },
];

export function getStats() {
  const totaal = mockInvoices.length;
  const nieuw = mockInvoices.filter((i) => i.status === "nieuw").length;
  const openstaand = mockInvoices
    .filter((i) => i.status !== "betaald")
    .reduce((sum, i) => sum + i.totaal, 0);
  const betaaldDezeMaand = mockInvoices
    .filter(
      (i) =>
        i.status === "betaald" &&
        i.factuurdatum.startsWith("2026-02"),
    )
    .reduce((sum, i) => sum + i.totaal, 0);

  return { totaal, nieuw, openstaand, betaaldDezeMaand };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(dateString));
}
