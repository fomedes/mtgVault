import { cn } from "@/lib/utils";

/** Responsive card grid per overview §10: 2 / 3 / 4–6 columns. */
export function CardGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="bg-muted aspect-5/7 w-full animate-pulse rounded-[4.75%/3.43%]"
        />
      ))}
    </>
  );
}
