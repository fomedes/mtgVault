import { Suspense } from "react";
import { CollectionBrowser } from "@/components/collection/collection-browser";

export default function CollectionPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-10">
      <Suspense>
        <CollectionBrowser />
      </Suspense>
    </main>
  );
}
