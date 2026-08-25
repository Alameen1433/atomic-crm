import { useListContext, useTranslate } from "ra-core";
import { Link as RouterLink } from "react-router";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import { Avatar } from "../contacts/Avatar";

export const ContactList = () => {
  const { data, error, isPending } = useListContext();
  const translate = useTranslate();
  const isMobile = useIsMobile();
  if (isPending || error) return <div className="h-8" />;
  return (
    <div
      className={cn(
        "mt-3 flex flex-row flex-wrap gap-3",
        isMobile && "flex-col",
      )}
    >
      {data.map((contact) => (
        <div
          className={cn(
            "flex flex-row items-center gap-3",
            isMobile && "rounded-xl border bg-muted/20 p-3",
          )}
          key={contact.id}
        >
          <Avatar record={contact} />
          <div className="flex flex-col">
            <RouterLink
              to={`/contacts/${contact.id}/show`}
              className="text-sm font-medium hover:underline"
            >
              {contact.first_name} {contact.last_name}
            </RouterLink>
            <span className="text-xs text-muted-foreground">
              {contact.title && contact.company_name
                ? translate("resources.contacts.position_at_company", {
                    title: contact.title,
                    company: contact.company_name,
                  })
                : contact.title || contact.company_name}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
