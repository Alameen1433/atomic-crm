import type { ReactNode } from "react";
import { ReferenceField } from "@/components/admin/reference-field";
import { DialogTitle } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import { CompanyAvatar } from "../companies/CompanyAvatar";

export const DealDialogHeader = ({
  title,
  actions,
}: {
  title: ReactNode;
  actions?: ReactNode;
}) => {
  const isMobile = useIsMobile();

  return (
    <header
      className={cn(
        "flex items-center",
        isMobile
          ? "sticky top-0 z-20 gap-3 border-b bg-background/95 px-4 py-3 pr-16 backdrop-blur"
          : "mb-8 justify-between gap-4",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <ReferenceField source="company_id" reference="companies" link="show">
          <CompanyAvatar />
        </ReferenceField>
        <DialogTitle
          className={cn(
            "min-w-0 text-left font-semibold",
            isMobile
              ? "line-clamp-2 text-lg leading-snug"
              : "text-2xl leading-tight",
          )}
        >
          {title}
        </DialogTitle>
      </div>
      {!isMobile ? actions : null}
    </header>
  );
};
