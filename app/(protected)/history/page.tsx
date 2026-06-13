import { HistoryList } from "@/components/draft/history-list";

export default function HistoryPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Draft History</h1>
        <p className="text-muted-foreground text-sm">
          Your completed multiplayer and phantom draft pick lists.
        </p>
      </header>
      <HistoryList />
    </main>
  );
}
