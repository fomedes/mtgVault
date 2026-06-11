import { redirect } from "next/navigation";
import { Nav } from "@/components/layout/nav";
import { getCurrentUser } from "@/lib/auth/session";

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <Nav role={user.role ?? "user"} />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
