import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const MobileContent = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <main
    className={cn(
      "mx-auto min-h-dvh w-full max-w-screen-xl overflow-x-hidden px-3 pt-[calc(4.75rem+env(safe-area-inset-top))] pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-4",
      className,
    )}
    id="main-content"
  >
    {children}
  </main>
);
