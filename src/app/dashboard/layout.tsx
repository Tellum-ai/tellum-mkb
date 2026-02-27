import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { SidebarProvider, SidebarInset } from "~/components/ui/sidebar";
import { DashboardSidebar } from "~/components/dashboard-sidebar";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { subscription } from "~/server/db/schema";
import { isTrialExpired } from "~/lib/billing";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const sub = await db.query.subscription.findFirst({
    where: eq(subscription.userId, session.user.id),
    orderBy: (s, { desc }) => [desc(s.createdAt)],
  });

  // No subscription or pending → pick a plan first
  if (!sub || sub.status === "pending") {
    redirect("/pricing");
  }

  // Check access
  const hasAccess =
    (sub.status === "trialing" &&
      sub.trialEndsAt !== null &&
      !isTrialExpired(sub.trialEndsAt)) ||
    sub.status === "active" ||
    (sub.status === "cancelled" &&
      sub.currentPeriodEnd !== null &&
      new Date() < sub.currentPeriodEnd);

  if (!hasAccess) {
    redirect("/dashboard/billing?expired=true");
  }

  return (
    <SidebarProvider>
      <DashboardSidebar
        user={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
        }}
      />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
