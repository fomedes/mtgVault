import { redirect } from "next/navigation";
import { Nav } from "@/components/layout/nav";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db";
import { Notification } from "@/lib/models/Notification";

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
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <Nav role={user.role ?? "user"} unreadNotifications={unreadCount} />
      <div id="main-content" className="flex flex-1 flex-col">
        {children}
      </div>
    </div>
  );
}
