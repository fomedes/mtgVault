"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { NotificationBell } from "@/components/layout/notification-bell";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Home" },
  { href: "/draft", label: "Draft" },
  { href: "/shop", label: "Shop" },
  { href: "/collection", label: "Collection" },
  { href: "/decks", label: "Decks" },
  { href: "/history", label: "History" },
  { href: "/cards", label: "Browse" },
];

export function Nav({
  role,
  unreadNotifications = 0,
}: {
  role: string;
  unreadNotifications?: number;
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <nav className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link
          href="/dashboard"
          className="mr-2 shrink-0 text-sm font-bold tracking-tight"
        >
          MTG Vault
        </Link>

        <div className="flex flex-1 items-center gap-0.5 overflow-x-auto">
          {LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors whitespace-nowrap",
                isActive(href)
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              {label}
            </Link>
          ))}
          {role === "admin" ? (
            <Link
              href="/admin"
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors whitespace-nowrap",
                isActive("/admin")
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              Admin
            </Link>
          ) : null}
        </div>

        <NotificationBell unreadCount={unreadNotifications} />
        <SignOutButton />
      </nav>
    </header>
  );
}
