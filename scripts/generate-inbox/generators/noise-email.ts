import type { NoiseScenario } from "../types.js"

export const NOISE_SCENARIOS: NoiseScenario[] = [
  {
    id: "006-ing-balance",
    from: "noreply@ing.nl",
    fromName: "ING",
    subject: "Uw maandoverzicht april 2026",
    date: "2026-05-01T08:00:00+02:00",
    body: `Geachte klant,

Uw maandoverzicht voor april 2026 staat klaar in Mijn ING.

Rekening:         NL91 INGB 0004 6789 21
Beginsaldo:       €12.450,00
Eindsaldo:        €9.234,67

U kunt uw overzicht bekijken via de ING app of Mijn ING.

Met vriendelijke groet,
ING Nederland N.V.

---
Dit is een automatisch gegenereerd bericht. Heeft u vragen?
Bel dan 020 22 888 88 (ma-vr 08:00-22:00, za-zo 09:00-18:00).`,
  },
  {
    id: "007-kpn-payment-confirm",
    from: "klantenservice@kpn.com",
    fromName: "KPN",
    subject: "Uw betaling is ontvangen - bedankt!",
    date: "2026-04-18T11:22:00+02:00",
    body: `Beste klant,

Wij hebben uw betaling ontvangen. Hartelijk dank!

Betaling ontvangen:  €54,45
Datum:               18 april 2026
Factuurnummer:       KPN-2026-04-001234

Uw factuur is nu volledig voldaan. U hoeft verder niets te doen.

Met vriendelijke groet,
KPN Klantenservice

---
Heeft u vragen over uw factuur? Log in op Mijn KPN of bel 0800 0402.
KPN B.V., Wilhelminakade 123, 3072 AP Rotterdam
KvK: 27124701`,
  },
  {
    id: "008-newsletter-rvo",
    from: "nieuwsbrief@rvo.nl",
    fromName: "RVO Nederland",
    subject: "Nieuwsbrief Ondernemersplein - mei 2026",
    date: "2026-05-02T09:00:00+02:00",
    body: `Ondernemersplein Nieuwsbrief | mei 2026

Beste ondernemer,

Dit zijn de belangrijkste updates voor u als ondernemer deze maand:

► BTW-aangifte Q1 2026
De deadline voor uw BTW-aangifte over het eerste kwartaal is 30 april 2026.
Heeft u al aangifte gedaan? Log in op Mijn Belastingdienst.

► Energie-investeringsaftrek (EIA) verhoogd
Vanaf 1 mei 2026 is de EIA verhoogd naar 45,5%. Dit geldt voor investeringen
in energiebesparende bedrijfsmiddelen die op de Energielijst staan.

► Nieuw: Subsidie digitalisering mkb
Er is een nieuwe subsidieregeling beschikbaar voor mkb-bedrijven die willen
investeren in digitalisering. Het budget is €50 miljoen.
Meer informatie: ondernemersplein.nl/subsidies

Met vriendelijke groet,
Redactie Ondernemersplein
Rijksdienst voor Ondernemend Nederland (RVO)

---
U ontvangt deze nieuwsbrief omdat u zich heeft aangemeld via ondernemersplein.nl.
Afmelden? Klik hier.`,
  },
]
