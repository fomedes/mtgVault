import { Suspense } from "react";
import { ShopBrowser } from "@/components/shop/shop-browser";

export default function ShopPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Shop</h1>
        <p className="text-muted-foreground text-sm">
          Open booster packs to add cards to your collection.
        </p>
      </header>
      <Suspense>
        <ShopBrowser />
      </Suspense>
    </main>
  );
}
