import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { SavedDeckView } from "@/components/draft/saved-deck-view";

export default async function DeckPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-10">
      <Link
        href="/history"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
      >
        <ArrowLeftIcon className="size-4" />
        Draft History
      </Link>
      <SavedDeckView sessionId={id} />
    </main>
  );
}
