import "~/styles/globals.css";

import { type Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: {
    default: "Tellum - Je AI financieel medewerker",
    template: "%s | Tellum",
  },
  description:
    "Tellum is je AI-medewerker voor inkomende facturen. Koppel je inbox en laat AI je facturen herkennen, verwerken en klaarzetten voor betaling.",
  icons: [{ rel: "icon", url: "/icon.svg", type: "image/svg+xml" }],
};

const attila = localFont({
  src: [
    { path: "../fonts/F37Attila-Thin.otf", weight: "100", style: "normal" },
    { path: "../fonts/F37Attila-Light.otf", weight: "300", style: "normal" },
    { path: "../fonts/F37Attila-Regular.otf", weight: "400", style: "normal" },
    { path: "../fonts/F37Attila-Medium.otf", weight: "500", style: "normal" },
    {
      path: "../fonts/F37Attila-SemiBold.otf",
      weight: "600",
      style: "normal",
    },
    { path: "../fonts/F37Attila-Bold.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-attila",
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl" className={`${attila.variable}`}>
      <body>
        <TRPCReactProvider>{children}</TRPCReactProvider>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
