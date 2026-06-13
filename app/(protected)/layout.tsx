import { redirect } from "next/navigation";
import { Nav } from "@/components/layout/nav";
import { BackgroundLayer } from "@/components/layout/background-layer";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db";
import { Notification } from "@/lib/models/Notification";
import { DEFAULT_BACKGROUND_ID } from "@/lib/backgrounds";

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  await connectToDatabase();
  const unreadCount = await Notification.countDocuments({
    userId: user.uid,
    read: false,
  });

  return (
    <div className="relative flex min-h-screen flex-col">
      <BackgroundLayer
        initialBackground={user.preferences?.background ?? DEFAULT_BACKGROUND_ID}
      />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <Nav role={user.role ?? "user"} unreadNotifications={unreadCount} />
      <div id="main-content" className="relative z-10 flex flex-1 flex-col">
        {children}
      </div>
    </div>
  );
}
