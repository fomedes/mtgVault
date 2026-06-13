/** Single source of truth for the primary menu (desktop bar + mobile overlay). */
export interface NavLink {
  href: string;
  label: string;
}

export const NAV_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Home" },
  { href: "/draft", label: "Multiplayer Draft" },
  { href: "/solo-draft", label: "Phantom Draft" },
  { href: "/shop", label: "Shop" },
  { href: "/collection", label: "My Collection" },
  { href: "/decks", label: "Decks" },
  { href: "/history", label: "History" },
  { href: "/cards", label: "Card Library" },
  { href: "/friends", label: "Friends" },
];

export const ADMIN_LINK: NavLink = { href: "/admin", label: "Admin" };

/** Build the visible link set for a role (admin appends the Admin entry). */
export function navLinksForRole(role: string): NavLink[] {
  return role === "admin" ? [...NAV_LINKS, ADMIN_LINK] : NAV_LINKS;
}

export function isNavActive(pathname: string, href: string): boolean {
  return href === "/dashboard"
    ? pathname === "/dashboard"
    : pathname.startsWith(href);
}
