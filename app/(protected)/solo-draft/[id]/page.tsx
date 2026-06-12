import { notFound } from "next/navigation";
import { SoloDraftRoom } from "@/components/solo-draft/solo-draft-room";
import { getCurrentUser } from "@/lib/auth/session";
import { getSoloDraftView } from "@/lib/game/solo-draft";

export const revalidate = 0;

export default async function SoloDraftRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { id } = await params;
  const session = await getSoloDraftView(id, user.uid);
  if (!session) notFound();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Solo Draft</h1>
        <p className="text-muted-foreground text-sm uppercase">
          {session.setCode} · {session.difficulty}
        </p>
      </header>

      <SoloDraftRoom initial={session} />
    </main>
  );
}
