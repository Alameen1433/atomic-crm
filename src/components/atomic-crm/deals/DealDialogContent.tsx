import type { ComponentProps } from "react";

import { DialogContent } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export const DealDialogContent = ({
  className,
  ...props
}: ComponentProps<typeof DialogContent>) => {
  const isMobile = useIsMobile();

  return (
    <DialogContent
      className={cn(
        isMobile
          ? "inset-0 h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto overscroll-contain rounded-none border-0 p-0 pt-[env(safe-area-inset-top)] shadow-none data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 sm:max-w-none"
          : "top-[5%] max-h-[90dvh] translate-y-0 overflow-y-auto p-4 lg:max-w-4xl",
        className,
      )}
      {...props}
    />
  );
};
