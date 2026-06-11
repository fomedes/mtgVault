import { Suspense } from "react";
import { ShopBrowser } from "@/components/shop/shop-browser";
import { getCurrentUser } from "@/lib/auth/session";

export default async function ShopPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Shop</h1>
        <p className="text-muted-foreground text-sm">
          Balance:{" "}
          <span className="text-foreground font-semibold">{user.vaultCoins} VC</span>
          {" · "}Open a booster to add cards to your collection.
        </p>
      </header>
      <Suspense>
        <ShopBrowser />
      </Suspense>
    </main>
  );
}
