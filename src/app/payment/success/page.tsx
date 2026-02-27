import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { TellumLogo } from "~/components/tellum-logo";
import { Button } from "~/components/ui/button";
import { TRIAL_DAYS } from "~/lib/billing";

export default function PaymentSuccessPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <Link href="/" className="mb-12">
        <TellumLogo variant="dark" className="h-7 w-auto" />
      </Link>

      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
        </div>

        <h1 className="mb-2 text-2xl font-bold tracking-tight">
          Betaling gelukt!
        </h1>
        <p className="mb-8 text-muted-foreground">
          Je betaalmethode is geautoriseerd. Je proefperiode van {TRIAL_DAYS}{" "}
          dagen is gestart — je betaalt pas daarna.
        </p>

        <Button asChild size="lg">
          <Link href="/dashboard">Ga naar je dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
