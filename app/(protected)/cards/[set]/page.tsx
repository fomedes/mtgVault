import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CardBrowser } from "@/components/cards/card-browser";
import { connectToDatabase } from "@/lib/db";
import { CardSet } from "@/lib/models/CardSet";

export const revalidate = 300;

export default async function SetPage({
  params,
}: {
  params: Promise<{ set: string }>;
}) {
  const { set } = await params;
  const code = set.toLowerCase();
  if (!/^[a-z0-9]{2,6}$/.test(code)) notFound();

  await connectToDatabase();
  const cardSet = await CardSet.findOne({
    code,
    enabled: true,
    cachedAt: { $exists: true },
  }).lean();
  if (!cardSet) notFound();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-10">
      {/* useSearchParams in CardBrowser requires a Suspense boundary. */}
      <Suspense>
        <CardBrowser setCode={cardSet.code} setName={cardSet.name} />
      </Suspense>
    </main>
  );
}
