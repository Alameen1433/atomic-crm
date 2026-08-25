import { CancelButton } from "@/components/admin/cancel-button";
import { SaveButton } from "@/components/admin/form";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export const FormToolbar = ({
  mobileFullBleed = false,
}: {
  mobileFullBleed?: boolean;
}) => {
  const isMobile = useIsMobile();
  const isMobileFullBleed = isMobile && mobileFullBleed;

  return (
    <div
      role="toolbar"
      className={cn(
        "sticky bottom-0 flex flex-row justify-end gap-2",
        isMobileFullBleed
          ? "z-20 mt-6 border-t bg-background/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.35)] backdrop-blur [&>button]:min-h-11 [&>button]:flex-1"
          : "bg-linear-to-b from-transparent to-card to-10% pt-4 pb-4 md:pb-0",
      )}
    >
      <CancelButton />
      <SaveButton />
    </div>
  );
};
