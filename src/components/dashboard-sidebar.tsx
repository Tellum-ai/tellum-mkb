"use client";

import {
  LayoutDashboard,
  FileText,
  CreditCard,
  Users,
  Settings,
  LogOut,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { TellumLogo } from "~/components/tellum-logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { authClient } from "~/server/better-auth/client";

const navItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Facturen",
    href: "/dashboard/invoices",
    icon: FileText,
  },
  {
    title: "Abonnement",
    href: "/dashboard/billing",
    icon: CreditCard,
  },
  {
    title: "Contacten",
    href: "/dashboard/contacts",
    icon: Users,
  },
];

interface DashboardSidebarProps {
  user: {
    name: string;
    email: string;
    image?: string | null;
  };
}

export function DashboardSidebar({ user }: DashboardSidebarProps) {
  const pathname = usePathname();

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = async () => {
    await authClient.signOut();
    window.location.href = "/login";
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-6">
        <Link href="/">
          <TellumLogo variant="light" className="h-7 w-auto" />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overzicht</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href)}
                    className="gap-3 px-4 py-2.5"
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="gap-3 px-4 py-6">
                  <Avatar className="h-7 w-7">
                    {user.image && <AvatarImage src={user.image} alt={user.name} />}
                    <AvatarFallback className="bg-sidebar-primary text-xs text-sidebar-primary-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-1 flex-col text-left text-sm">
                    <span className="font-medium">{user.name}</span>
                    <span className="text-xs text-sidebar-foreground/60">
                      {user.email}
                    </span>
                  </div>
                  <ChevronUp className="h-4 w-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56"
                side="top"
                align="start"
              >
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Instellingen
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Uitloggen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
