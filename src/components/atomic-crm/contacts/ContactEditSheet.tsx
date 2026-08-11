import type { Identifier } from "ra-core";
import { useNotify, useRecordContext, useTranslate, useUpdate } from "ra-core";
import { Archive, EllipsisVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { EditSheet } from "../misc/EditSheet";
import { ContactInputs } from "./ContactInputs";
import {
  cleanupContactForEdit,
  defaultEmailJsonb,
  defaultPhoneJsonb,
} from "./contactModel";

export interface ContactEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: Identifier;
}

export const ContactEditSheet = ({
  open,
  onOpenChange,
  contactId,
}: ContactEditSheetProps) => {
  return (
    <EditSheet
      resource="contacts"
      id={contactId}
      open={open}
      onOpenChange={onOpenChange}
      transform={cleanupContactForEdit}
      defaultValues={{
        email_jsonb: defaultEmailJsonb,
        phone_jsonb: defaultPhoneJsonb,
      }}
      headerActions={<ContactEditMenuButton onOpenChange={onOpenChange} />}
    >
      <ContactInputs />
    </EditSheet>
  );
};

const ContactEditMenuButton = ({
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void;
}) => {
  const translate = useTranslate();
  const record = useRecordContext();
  const notify = useNotify();
  const [update] = useUpdate();

  const onArchive = () => {
    if (!record) return;
    update(
      "contacts",
      {
        id: record.id,
        data: { archived_at: new Date().toISOString() },
        previousData: record,
      },
      {
        onSuccess: () => {
          notify("Contact archived", { type: "success" });
          onOpenChange(false);
        },
        onError: () => {
          notify("Could not archive the contact", { type: "error" });
        },
      },
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <EllipsisVertical />
          <span className="sr-only">
            {translate("ra.action.open_menu", { _: "More" })}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          className="h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
          onSelect={onArchive}
        >
          <Archive />
          Archive contact
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
