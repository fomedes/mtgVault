"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { NotificationBell } from "@/components/layout/notification-bell";
import { BackgroundPicker } from "@/components/layout/background-picker";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { isNavActive, navLinksForRole } from "@/components/layout/nav-links";
import { cn } from "@/lib/utils";

export function Nav({
  role,
  unreadNotifications = 0,
}: {
  role: string;
  unreadNotifications?: number;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const links = navLinksForRole(role);

  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <nav className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            className="text-muted-foreground hover:text-foreground hover:bg-muted/50 focus-visible:ring-ring/50 -ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md outline-none transition-colors focus-visible:ring-2 lg:hidden"
          >
            <MenuIcon className="size-5" />
          </button>

          <Link
            href="/dashboard"
            className="shrink-0 text-sm font-bold tracking-tight"
          >
            MTG Vault
          </Link>

          {/* Desktop inline bar */}
          <div className="hidden flex-1 items-center gap-0.5 overflow-x-auto lg:flex">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={isNavActive(pathname, href) ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
                  isNavActive(pathname, href)
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                {label}
              </Link>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1 lg:ml-0">
            <NotificationBell unreadCount={unreadNotifications} />
            <BackgroundPicker />
            <SignOutButton />
          </div>
        </nav>
      </header>

      {/* Rendered outside <header> so backdrop-filter doesn't confine fixed positioning to the header's bounds in WebKit. */}
      <MobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        links={links}
      />
    </>
  );
}
