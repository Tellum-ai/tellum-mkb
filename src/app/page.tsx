import Link from "next/link";
import Image from "next/image";
import {
  Mail,
  ArrowRight,
  LayoutDashboard,
  CheckCircle2,
  Clock,
  Euro,
  FileText,
  AlertCircle,
  Check,
  CreditCard,
  RefreshCw,
  Zap,
  Shield,
} from "lucide-react";

import { TellumLogo, TellumSymbol } from "~/components/tellum-logo";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { getSession } from "~/server/better-auth/server";

/* ==========================================================================
   SHARED ICONS
   ========================================================================== */

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}


/* ==========================================================================
   NAVBAR
   ========================================================================== */

function Navbar({ loggedIn }: { loggedIn: boolean }) {
  return (
    <nav className="fixed top-0 z-50 w-full border-b border-border/50 bg-white/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <TellumLogo variant="dark" className="h-7 w-auto" />
        <div className="flex items-center gap-3">
          {loggedIn ? (
            <Button
              asChild
              className="bg-mirage text-white hover:bg-rich-black"
            >
              <Link href="/dashboard">
                <LayoutDashboard className="mr-1.5 h-4 w-4" />
                Dashboard
              </Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login">Inloggen</Link>
              </Button>
              <Button
                asChild
                className="bg-mirage text-white hover:bg-rich-black"
              >
                <Link href="/login">
                  Gratis starten
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

/* ==========================================================================
   HERO — Dashboard preview in browser window
   ========================================================================== */

function HeroDashboardPreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-white shadow-2xl shadow-mirage/5">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </div>
        <div className="mx-auto flex-1">
          <div className="mx-auto flex max-w-sm items-center gap-2 rounded-md bg-white/80 px-3 py-1 text-xs text-muted-foreground">
            <Shield className="h-3 w-3 text-emerald-500" />
            app.tellum.nl/dashboard
          </div>
        </div>
      </div>

      {/* Dashboard content */}
      <div className="p-5">
        {/* Stats row */}
        <div className="mb-5 grid grid-cols-4 gap-3">
          {[
            {
              label: "Nieuwe facturen",
              value: "5",
              icon: AlertCircle,
              iconColor: "text-blue-600",
              iconBg: "bg-blue-50",
            },
            {
              label: "Totaal deze maand",
              value: "23",
              icon: FileText,
              iconColor: "text-periwinkle-dark",
              iconBg: "bg-secondary",
            },
            {
              label: "Openstaand",
              value: "\u20AC 2.847",
              icon: Euro,
              iconColor: "text-amber-600",
              iconBg: "bg-amber-50",
            },
            {
              label: "Betaald",
              value: "\u20AC 8.420",
              icon: Check,
              iconColor: "text-emerald-600",
              iconBg: "bg-emerald-50",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-border/40 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-medium text-muted-foreground">
                  {stat.label}
                </p>
                <div className={`rounded p-1 ${stat.iconBg}`}>
                  <stat.icon className={`h-3 w-3 ${stat.iconColor}`} />
                </div>
              </div>
              <p className="text-lg font-semibold text-foreground">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Invoice table */}
        <div className="rounded-lg border border-border/40">
          <div className="border-b px-4 py-2.5">
            <div className="flex items-center gap-3">
              <p className="text-xs font-semibold text-foreground">
                Recente facturen
              </p>
              <div className="flex gap-1">
                {["Alle", "Nieuw", "Goedgekeurd", "Betaald"].map(
                  (tab, i) => (
                    <span
                      key={tab}
                      className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                        i === 0
                          ? "bg-mirage text-white"
                          : "text-muted-foreground"
                      }`}
                    >
                      {tab}
                    </span>
                  ),
                )}
              </div>
            </div>
          </div>
          <div className="divide-y divide-border/40">
            {[
              {
                vendor: "Coolblue B.V.",
                initials: "CB",
                color: "bg-blue-100 text-blue-700",
                number: "CB-2026-0847",
                amount: "\u20AC 296,45",
                date: "20 feb",
                status: "nieuw" as const,
              },
              {
                vendor: "KPN Zakelijk",
                initials: "KP",
                color: "bg-green-100 text-green-700",
                number: "KPN-2026-0219",
                amount: "\u20AC 108,30",
                date: "19 feb",
                status: "nieuw" as const,
              },
              {
                vendor: "Greenwheels",
                initials: "GW",
                color: "bg-emerald-100 text-emerald-700",
                number: "GW-26-4412",
                amount: "\u20AC 45,00",
                date: "18 feb",
                status: "goedgekeurd" as const,
              },
              {
                vendor: "Bol.com",
                initials: "BC",
                color: "bg-sky-100 text-sky-700",
                number: "BOL-2026-1892",
                amount: "\u20AC 89,99",
                date: "17 feb",
                status: "betaald" as const,
              },
              {
                vendor: "Essent Zakelijk",
                initials: "ES",
                color: "bg-orange-100 text-orange-700",
                number: "ESS-2026-0384",
                amount: "\u20AC 377,52",
                date: "15 feb",
                status: "betaald" as const,
              },
            ].map((inv) => (
              <div
                key={inv.number}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${inv.color}`}
                >
                  {inv.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground">
                    {inv.vendor}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {inv.number}
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground">{inv.date}</p>
                <p className="w-16 text-right text-xs font-semibold">
                  {inv.amount}
                </p>
                <div
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    inv.status === "nieuw"
                      ? "bg-blue-50 text-blue-700"
                      : inv.status === "goedgekeurd"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {inv.status === "nieuw" && (
                    <AlertCircle className="h-2.5 w-2.5" />
                  )}
                  {inv.status === "goedgekeurd" && (
                    <Clock className="h-2.5 w-2.5" />
                  )}
                  {inv.status === "betaald" && (
                    <CheckCircle2 className="h-2.5 w-2.5" />
                  )}
                  {inv.status === "nieuw"
                    ? "Nieuw"
                    : inv.status === "goedgekeurd"
                      ? "Goedgekeurd"
                      : "Betaald"}
                </div>
                {inv.status === "nieuw" && (
                  <div className="rounded bg-periwinkle px-2 py-0.5 text-[10px] font-semibold text-mirage">
                    Goedkeuren
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-periwinkle/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[400px] w-[400px] rounded-full bg-soft-yellow/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-periwinkle/30 bg-periwinkle/10 px-4 py-1.5 text-sm font-medium text-periwinkle-dark">
            <TellumSymbol className="h-3.5 w-3.5" />
            Automatische facturenverwerking
          </div>

          <h1 className="mb-6 text-5xl leading-tight font-bold tracking-tight text-rich-black md:text-6xl md:leading-tight">
            Nooit meer handmatig
            <span className="relative">
              {" "}
              <span className="relative z-10">facturen</span>
              <span className="absolute bottom-2 left-0 -z-0 h-3 w-full bg-soft-yellow/60" />
            </span>{" "}
            verwerken
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Tellum haalt facturen uit je inbox, categoriseert ze automatisch en
            laat je onbetaalde facturen direct betalen. Alles wordt gesynchroniseerd
            met Moneybird.
          </p>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              asChild
              className="bg-mirage px-8 py-6 text-base text-white hover:bg-rich-black"
            >
              <Link href="/login">
                <GoogleIcon className="mr-2 h-5 w-5" />
                Start gratis met Google
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground">
              Geen creditcard nodig
            </p>
          </div>

          {/* Trust strip — integration logos */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 opacity-40">
            <Image src="/logos/integrations/gmail.svg" alt="Gmail" width={28} height={28} className="h-7 w-7" />
            <Image src="/logos/integrations/moneybird.svg" alt="Moneybird" width={28} height={28} className="h-7 w-auto" />
            <Image src="/logos/integrations/ideal.svg" alt="iDEAL" width={28} height={28} className="h-7 w-7" />
            <Image src="/logos/integrations/ing.svg" alt="ING" width={56} height={28} className="h-6 w-auto" />
            <Image src="/logos/integrations/rabobank.svg" alt="Rabobank" width={80} height={28} className="h-6 w-auto" />
            <Image src="/logos/integrations/abnamro.svg" alt="ABN AMRO" width={80} height={28} className="h-6 w-auto" />
          </div>
        </div>

        {/* Dashboard preview */}
        <div className="mt-20">
          <HeroDashboardPreview />
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   HOW IT WORKS — Visual flow showing the 3 steps
   ========================================================================== */

function HowItWorksSection() {
  return (
    <section className="border-t bg-muted/30 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16">
          <p className="mb-3 text-sm font-medium uppercase tracking-wider text-periwinkle-dark">
            Hoe het werkt
          </p>
          <p className="text-lg text-muted-foreground">
            Van inbox tot boekhouding &mdash; volledig automatisch
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {/* Step 1 */}
          <div className="relative">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm border border-border/40">
              <Image src="/logos/integrations/gmail.svg" alt="Gmail" width={28} height={28} className="h-7 w-7" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-rich-black">
              Facturen worden herkend
            </h3>
            <p className="text-muted-foreground">
              Tellum scant je Gmail-inbox continu en herkent automatisch
              inkomende facturen tussen al je andere e-mails.
            </p>
            <div className="absolute top-6 left-16 hidden h-px w-[calc(100%-4rem)] bg-border md:block" />
          </div>

          {/* Step 2 */}
          <div className="relative">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm border border-border/40">
              <TellumSymbol className="h-7 w-7" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-rich-black">
              Data wordt uitgelezen
            </h3>
            <p className="text-muted-foreground">
              Leverancier, bedrag, factuurnummer, BTW en vervaldatum worden
              automatisch uit elke factuur gehaald &mdash; foutloos.
            </p>
            <div className="absolute top-6 left-16 hidden h-px w-[calc(100%-4rem)] bg-border md:block" />
          </div>

          {/* Step 3 */}
          <div>
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm border border-border/40">
              <div className="flex items-center gap-1">
                <Image src="/logos/integrations/moneybird.svg" alt="Moneybird" width={16} height={16} className="h-4 w-auto" />
                <Image src="/logos/integrations/ideal.svg" alt="iDEAL" width={16} height={16} className="h-4 w-4" />
              </div>
            </div>
            <h3 className="mb-2 text-xl font-semibold text-rich-black">
              Betaal of synchroniseer
            </h3>
            <p className="text-muted-foreground">
              Al betaalde facturen gaan direct naar Moneybird. Onbetaalde
              facturen keur je goed en betaal je via iDEAL.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   FEATURES — Full-width alternating panels with product visuals
   ========================================================================== */

function FeatureInboxVisual() {
  const emails = [
    {
      sender: "Coolblue B.V.",
      initials: "CB",
      color: "bg-blue-100 text-blue-700",
      subject: "Factuur CB-2026-0847",
      preview: "In de bijlage vindt u de factuur voor...",
      time: "10:34",
      isInvoice: true,
    },
    {
      sender: "LinkedIn",
      initials: "LI",
      color: "bg-sky-100 text-sky-700",
      subject: "3 nieuwe connectieverzoeken",
      preview: "Je hebt nieuwe connectieverzoeken van...",
      time: "09:58",
      isInvoice: false,
    },
    {
      sender: "KPN Zakelijk",
      initials: "KP",
      color: "bg-green-100 text-green-700",
      subject: "Uw factuur van februari",
      preview: "Geachte klant, hierbij ontvangt u uw...",
      time: "09:12",
      isInvoice: true,
    },
    {
      sender: "Google Workspace",
      initials: "GW",
      color: "bg-red-100 text-red-700",
      subject: "Uw opslagruimte is bijna vol",
      preview: "U heeft 14,2 GB van uw 15 GB gebruikt...",
      time: "08:45",
      isInvoice: false,
    },
    {
      sender: "Essent Zakelijk",
      initials: "ES",
      color: "bg-orange-100 text-orange-700",
      subject: "Maandnota februari 2026",
      preview: "Beste ondernemer, uw energienota van...",
      time: "08:20",
      isInvoice: true,
    },
    {
      sender: "Slack",
      initials: "SL",
      color: "bg-purple-100 text-purple-700",
      subject: "5 ongelezen berichten",
      preview: "Je hebt nieuwe berichten in #general...",
      time: "07:55",
      isInvoice: false,
    },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-white shadow-lg">
      <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Image src="/logos/integrations/gmail.svg" alt="Gmail" width={16} height={16} className="h-4 w-4" />
          <p className="text-xs font-medium text-muted-foreground">
            Inbox &mdash; 24 e-mails
          </p>
        </div>
        <Badge
          variant="outline"
          className="gap-1 border-periwinkle/30 bg-periwinkle/10 text-periwinkle-dark"
        >
          <TellumSymbol className="h-3 w-3" />3 facturen herkend
        </Badge>
      </div>
      <div className="divide-y">
        {emails.map((email) => (
          <div
            key={email.sender}
            className={`flex items-start gap-3 px-4 py-3 transition-colors ${
              email.isInvoice
                ? "border-l-2 border-l-periwinkle bg-periwinkle/5"
                : "opacity-50"
            }`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${email.color}`}
            >
              {email.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">
                  {email.sender}
                </p>
                <div className="flex items-center gap-2">
                  {email.isInvoice && (
                    <span className="rounded bg-periwinkle/20 px-1.5 py-0.5 text-[10px] font-bold text-periwinkle-dark">
                      FACTUUR
                    </span>
                  )}
                  <p className="text-xs text-muted-foreground">{email.time}</p>
                </div>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {email.subject} &mdash; {email.preview}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureCategorizationVisual() {
  return (
    <div className="space-y-4">
      {/* Already paid - auto synced */}
      <div className="overflow-hidden rounded-xl border border-emerald-200/60 bg-white shadow-lg">
        <div className="flex items-center justify-between border-b bg-emerald-50/50 px-4 py-2.5">
          <p className="text-xs font-medium text-emerald-700">
            Al betaald &mdash; automatisch verwerkt
          </p>
          <RefreshCw className="h-3.5 w-3.5 text-emerald-500" />
        </div>
        <div className="divide-y divide-emerald-100/50">
          {[
            {
              vendor: "Bol.com",
              initials: "BC",
              color: "bg-sky-100 text-sky-700",
              amount: "\u20AC 89,99",
              desc: "Online bestelling",
            },
            {
              vendor: "Notion",
              initials: "NT",
              color: "bg-gray-100 text-gray-700",
              amount: "\u20AC 8,00",
              desc: "Maandabonnement",
            },
          ].map((inv) => (
            <div
              key={inv.vendor}
              className="flex items-center gap-3 px-4 py-3"
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${inv.color}`}
              >
                {inv.initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {inv.vendor}
                </p>
                <p className="text-xs text-muted-foreground">{inv.desc}</p>
              </div>
              <p className="text-sm font-semibold">{inv.amount}</p>
              <div className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700">
                <CheckCircle2 className="h-3 w-3" />
                Gesynchroniseerd
              </div>
            </div>
          ))}
        </div>
        <div className="border-t bg-emerald-50/30 px-4 py-2 text-center">
          <p className="text-[10px] text-emerald-600">
            Automatisch naar Moneybird gestuurd
          </p>
        </div>
      </div>

      {/* Unpaid - needs action */}
      <div className="overflow-hidden rounded-xl border border-amber-200/60 bg-white shadow-lg">
        <div className="flex items-center justify-between border-b bg-amber-50/50 px-4 py-2.5">
          <p className="text-xs font-medium text-amber-700">
            Openstaand &mdash; actie vereist
          </p>
          <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
        </div>
        <div className="divide-y divide-amber-100/50">
          {[
            {
              vendor: "KPN Zakelijk",
              initials: "KP",
              color: "bg-green-100 text-green-700",
              amount: "\u20AC 108,30",
              due: "Vervalt over 12 dagen",
            },
            {
              vendor: "Essent Zakelijk",
              initials: "ES",
              color: "bg-orange-100 text-orange-700",
              amount: "\u20AC 377,52",
              due: "Vervalt over 18 dagen",
            },
          ].map((inv) => (
            <div
              key={inv.vendor}
              className="flex items-center gap-3 px-4 py-3"
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${inv.color}`}
              >
                {inv.initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {inv.vendor}
                </p>
                <p className="text-xs text-muted-foreground">{inv.due}</p>
              </div>
              <p className="text-sm font-semibold">{inv.amount}</p>
              <div className="rounded bg-periwinkle px-2.5 py-1 text-[10px] font-semibold text-mirage">
                Betalen
              </div>
            </div>
          ))}
        </div>
        <div className="border-t bg-amber-50/30 px-4 py-2 text-center">
          <p className="text-[10px] text-amber-600">
            Keur goed en betaal direct via iDEAL
          </p>
        </div>
      </div>
    </div>
  );
}

function FeaturePaymentVisual() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-white shadow-lg">
      <div className="border-b bg-muted/40 px-4 py-2.5">
        <p className="text-xs font-medium text-muted-foreground">
          Factuur betalen
        </p>
      </div>
      <div className="p-5">
        {/* Invoice summary */}
        <div className="mb-5 rounded-lg bg-muted/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">
                KP
              </div>
              <div>
                <p className="text-sm font-semibold">KPN Zakelijk</p>
                <p className="text-xs text-muted-foreground">
                  KPN-2026-0219
                </p>
              </div>
            </div>
            <p className="text-lg font-bold text-foreground">&euro; 108,30</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Vervaldatum</p>
              <p className="font-medium">3 mrt 2026</p>
            </div>
            <div>
              <p className="text-muted-foreground">BTW 21%</p>
              <p className="font-medium">&euro; 18,79</p>
            </div>
          </div>
        </div>

        {/* Payment method */}
        <div className="mb-5">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Betaalmethode
          </p>
          <div className="flex gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-lg border-2 border-periwinkle bg-periwinkle/5 px-3 py-2.5">
              <Image src="/logos/integrations/ideal.svg" alt="iDEAL" width={20} height={20} className="h-5 w-5" />
              <span className="text-sm font-medium">iDEAL</span>
              <CheckCircle2 className="ml-auto h-4 w-4 text-periwinkle-dark" />
            </div>
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-border/60 px-3 py-2.5">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                SEPA
              </span>
            </div>
          </div>
        </div>

        {/* Bank selection */}
        <div className="mb-5">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Selecteer je bank
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { name: "ING", src: "/logos/integrations/ing.svg", selected: true },
              { name: "Rabobank", src: "/logos/integrations/rabobank.svg", selected: false },
              { name: "ABN AMRO", src: "/logos/integrations/abnamro.svg", selected: false },
            ].map((bank) => (
              <div
                key={bank.name}
                className={`flex items-center justify-center rounded-lg border px-3 py-2.5 ${
                  bank.selected
                    ? "border-periwinkle bg-periwinkle/5"
                    : "border-border/60"
                }`}
              >
                <Image src={bank.src} alt={bank.name} width={60} height={24} className="h-5 w-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* Pay button */}
        <div className="flex w-full items-center justify-center gap-2 rounded-lg bg-mirage px-4 py-3 text-sm font-semibold text-white">
          <Image src="/logos/integrations/ideal.svg" alt="iDEAL" width={16} height={16} className="h-4 w-4 brightness-0 invert" />
          Betaal &euro; 108,30 via iDEAL
        </div>
      </div>
    </div>
  );
}

function FeatureSyncVisual() {
  return (
    <div className="space-y-4">
      {/* Sync flow visualization */}
      <div className="overflow-hidden rounded-xl border border-border/60 bg-white shadow-lg">
        <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
          <Image src="/logos/integrations/moneybird.svg" alt="Moneybird" width={16} height={16} className="h-4 w-auto" />
          <p className="text-xs font-medium text-muted-foreground">
            Synchronisatie-overzicht
          </p>
        </div>
        <div className="p-5">
          {/* Sync items */}
          <div className="space-y-3">
            {[
              {
                vendor: "Coolblue B.V.",
                initials: "CB",
                color: "bg-blue-100 text-blue-700",
                amount: "\u20AC 296,45",
                status: "Gesynchroniseerd",
                time: "Zojuist",
                synced: true,
              },
              {
                vendor: "KPN Zakelijk",
                initials: "KP",
                color: "bg-green-100 text-green-700",
                amount: "\u20AC 108,30",
                status: "Gesynchroniseerd",
                time: "2 min geleden",
                synced: true,
              },
              {
                vendor: "Bol.com",
                initials: "BC",
                color: "bg-sky-100 text-sky-700",
                amount: "\u20AC 89,99",
                status: "Gesynchroniseerd",
                time: "5 min geleden",
                synced: true,
              },
              {
                vendor: "Greenwheels",
                initials: "GW",
                color: "bg-emerald-100 text-emerald-700",
                amount: "\u20AC 45,00",
                status: "Wordt gesynchroniseerd...",
                time: "",
                synced: false,
              },
            ].map((item) => (
              <div
                key={item.vendor}
                className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-2.5"
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${item.color}`}
                >
                  {item.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground">
                    {item.vendor}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {item.amount}
                  </p>
                </div>
                {item.synced ? (
                  <div className="flex items-center gap-1 text-[10px] text-emerald-600">
                    <CheckCircle2 className="h-3 w-3" />
                    {item.time}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-[10px] text-periwinkle-dark">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Bezig...
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Moneybird destination */}
          <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5">
            <Image src="/logos/integrations/moneybird.svg" alt="Moneybird" width={16} height={16} className="h-4 w-auto" />
            <p className="text-xs font-medium text-emerald-700">
              Alles automatisch in Moneybird
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeaturesSection() {
  return (
    <section className="space-y-0">
      {/* Feature 1: Inbox scanning */}
      <div className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Badge
                variant="outline"
                className="mb-4 border-periwinkle/30 bg-periwinkle/10 text-periwinkle-dark"
              >
                <Mail className="mr-1.5 h-3 w-3" />
                Inbox scanning
              </Badge>
              <h2 className="mb-4 text-3xl font-bold text-rich-black">
                Facturen worden automatisch herkend in je inbox
              </h2>
              <p className="mb-6 text-lg text-muted-foreground">
                Je inbox zit vol met nieuwsbrieven, notificaties en gesprekken.
                Tellum pikt er automatisch de inkomende facturen
                tussenuit &mdash; of het nu een PDF-bijlage is of een factuur in
                de e-mail zelf.
              </p>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-periwinkle-dark" />
                  Scant continu op nieuwe facturen
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-periwinkle-dark" />
                  Herkent PDF-bijlagen en inline facturen
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-periwinkle-dark" />
                  Negeert spam, nieuwsbrieven en andere e-mails
                </li>
              </ul>
            </div>
            <FeatureInboxVisual />
          </div>
        </div>
      </div>

      {/* Feature 2: Smart categorization — paid vs unpaid */}
      <div className="border-t bg-muted/30 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="order-2 lg:order-1">
              <FeatureCategorizationVisual />
            </div>
            <div className="order-1 lg:order-2">
              <Badge
                variant="outline"
                className="mb-4 border-periwinkle/30 bg-periwinkle/10 text-periwinkle-dark"
              >
                <Zap className="mr-1.5 h-3 w-3" />
                Slimme categorisatie
              </Badge>
              <h2 className="mb-4 text-3xl font-bold text-rich-black">
                Betaald of onbetaald? Tellum weet het verschil
              </h2>
              <p className="mb-6 text-lg text-muted-foreground">
                Facturen van online bestellingen, tools en abonnementen zijn vaak
                al betaald. Tellum herkent dit automatisch en stuurt ze direct
                door naar je boekhouding. Onbetaalde facturen zet Tellum klaar
                zodat jij ze kunt goedkeuren en betalen.
              </p>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  Betaalde facturen direct naar Moneybird
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-amber-600" />
                  Onbetaalde facturen klaar voor goedkeuring
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-periwinkle-dark" />
                  Geen handmatig sorteren meer nodig
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Feature 3: Direct payment via iDEAL */}
      <div className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Badge
                variant="outline"
                className="mb-4 border-periwinkle/30 bg-periwinkle/10 text-periwinkle-dark"
              >
                <Image src="/logos/integrations/ideal.svg" alt="iDEAL" width={12} height={12} className="mr-1.5 h-3 w-3" />
                Direct betalen
              </Badge>
              <h2 className="mb-4 text-3xl font-bold text-rich-black">
                Betaal openstaande facturen direct via iDEAL
              </h2>
              <p className="mb-6 text-lg text-muted-foreground">
                Geen gedoe meer met internetbankieren en handmatig bedragen
                overschrijven. Keur een factuur goed in Tellum en betaal direct
                via iDEAL of SEPA &mdash; veilig en snel via je eigen bank.
              </p>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-periwinkle-dark" />
                  Betaal met iDEAL of SEPA-overboeking
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-periwinkle-dark" />
                  Alle Nederlandse banken ondersteund
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-periwinkle-dark" />
                  Nooit meer een vervaldatum missen
                </li>
              </ul>
            </div>
            <FeaturePaymentVisual />
          </div>
        </div>
      </div>

      {/* Feature 4: Auto-sync to Moneybird */}
      <div className="border-t bg-muted/30 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="order-2 lg:order-1">
              <FeatureSyncVisual />
            </div>
            <div className="order-1 lg:order-2">
              <Badge
                variant="outline"
                className="mb-4 border-periwinkle/30 bg-periwinkle/10 text-periwinkle-dark"
              >
                <RefreshCw className="mr-1.5 h-3 w-3" />
                Moneybird sync
              </Badge>
              <h2 className="mb-4 text-3xl font-bold text-rich-black">
                Alles automatisch in je boekhouding
              </h2>
              <p className="mb-6 text-lg text-muted-foreground">
                Elke factuur &mdash; betaald of onbetaald &mdash; wordt
                automatisch gesynchroniseerd met Moneybird. Geen dubbele
                invoer, geen gemiste facturen. Je boekhouding is altijd
                up-to-date.
              </p>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-periwinkle-dark" />
                  Realtime synchronisatie met Moneybird
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-periwinkle-dark" />
                  BTW en bedragen correct overgenomen
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-periwinkle-dark" />
                  Volledig overzicht in &eacute;&eacute;n dashboard
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   INTEGRATIONS
   ========================================================================== */

function IntegrationsSection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-rich-black md:text-4xl">
            Werkt met de tools die je al gebruikt
          </h2>
          <p className="text-lg text-muted-foreground">
            Tellum integreert naadloos met je bestaande workflow
          </p>
        </div>

        {/* Integration flow diagram */}
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-col items-center gap-6 md:flex-row md:justify-center md:gap-0">
            {/* Gmail */}
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border/60 bg-white shadow-sm">
                <Image src="/logos/integrations/gmail.svg" alt="Gmail" width={48} height={48} className="h-12 w-12" />
              </div>
              <p className="text-sm font-medium text-rich-black">Gmail</p>
            </div>

            {/* Connector → */}
            <div className="hidden h-px w-16 bg-border md:block" />
            <div className="text-muted-foreground md:hidden">
              <ArrowRight className="h-4 w-4 rotate-90" />
            </div>

            {/* Tellum */}
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-periwinkle/40 bg-periwinkle/5 shadow-sm">
                <TellumSymbol className="h-12 w-12" />
              </div>
              <p className="text-sm font-medium text-rich-black">Tellum</p>
            </div>

            {/* Connector → */}
            <div className="hidden h-px w-16 bg-border md:block" />
            <div className="text-muted-foreground md:hidden">
              <ArrowRight className="h-4 w-4 rotate-90" />
            </div>

            {/* Moneybird */}
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border/60 bg-white shadow-sm">
                <Image src="/logos/integrations/moneybird.svg" alt="Moneybird" width={48} height={48} className="h-12 w-auto" />
              </div>
              <p className="text-sm font-medium text-rich-black">Moneybird</p>
            </div>
          </div>

          {/* Vertical connector from Tellum to iDEAL */}
          <div className="flex justify-center">
            <div className="hidden h-10 w-px bg-border md:block" />
          </div>

          {/* iDEAL below Tellum */}
          <div className="mt-6 flex justify-center md:mt-0">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border/60 bg-white shadow-sm">
                <Image src="/logos/integrations/ideal.svg" alt="iDEAL" width={48} height={48} className="h-12 w-12" />
              </div>
              <p className="text-sm font-medium text-rich-black">iDEAL</p>
            </div>
          </div>
        </div>

        {/* Bank logos */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-10 opacity-40 grayscale transition-all hover:opacity-100 hover:grayscale-0">
          <Image src="/logos/integrations/ing.svg" alt="ING" width={80} height={40} className="h-8 w-auto" />
          <Image src="/logos/integrations/rabobank.svg" alt="Rabobank" width={120} height={40} className="h-8 w-auto" />
          <Image src="/logos/integrations/abnamro.svg" alt="ABN AMRO" width={120} height={40} className="h-8 w-auto" />
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   CTA + FOOTER
   ========================================================================== */

function CTASection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="relative overflow-hidden rounded-2xl bg-mirage px-8 py-16 text-center md:px-16">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-periwinkle/10 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-soft-yellow/5 blur-3xl" />
          </div>

          <div className="relative">
            <TellumSymbol className="mx-auto mb-8 h-12 w-12 opacity-60" />
            <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">
              Klaar om facturen op de automatische piloot te zetten?
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-lg text-periwinkle-light">
              Van inbox tot boekhouding &mdash; volledig automatisch. Gratis te
              proberen, geen creditcard nodig.
            </p>
            <Button
              size="lg"
              asChild
              className="bg-periwinkle px-8 py-6 text-base font-semibold text-mirage hover:bg-periwinkle-light"
            >
              <Link href="/login">
                Start gratis met Google
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
        <TellumLogo variant="dark" className="h-6 w-auto" />
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Tellum. Alle rechten voorbehouden.
        </p>
        <div className="flex gap-6 text-sm text-muted-foreground">
          <span className="cursor-pointer hover:text-foreground">
            Voorwaarden
          </span>
          <span className="cursor-pointer hover:text-foreground">Privacy</span>
          <span className="cursor-pointer hover:text-foreground">Contact</span>
        </div>
      </div>
    </footer>
  );
}

/* ==========================================================================
   PAGE
   ========================================================================== */

export default async function LandingPage() {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-white">
      <Navbar loggedIn={!!session} />
      <HeroSection />
      <HowItWorksSection />
      <FeaturesSection />
      <IntegrationsSection />
      <CTASection />
      <Footer />
    </div>
  );
}
