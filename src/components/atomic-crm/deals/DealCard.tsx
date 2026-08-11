import { Draggable } from "@hello-pangea/dnd";
import { CalendarDays, GripVertical } from "lucide-react";
import { useRedirect, RecordContextProvider } from "ra-core";
import { ReferenceField } from "@/components/admin/reference-field";
import { NumberField } from "@/components/admin/number-field";
import { SelectField } from "@/components/admin/select-field";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { CompanyAvatar } from "../companies/CompanyAvatar";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";

export const DealCard = ({ deal, index }: { deal: Deal; index: number }) => {
  if (!deal) return null;

  return (
    <Draggable draggableId={String(deal.id)} index={index}>
      {(provided, snapshot) => (
        <DealCardContent provided={provided} snapshot={snapshot} deal={deal} />
      )}
    </Draggable>
  );
};

export const DealCardContent = ({
  provided,
  snapshot,
  deal,
}: {
  provided?: any;
  snapshot?: any;
  deal: Deal;
}) => {
  const { dealCategories, currency } = useConfigurationContext();
  const redirect = useRedirect();
  const handleClick = () => {
    redirect(`/deals/${deal.id}/show`, undefined, undefined, undefined, {
      _scrollToTop: false,
    });
  };

  return (
    <div
      className="cursor-pointer"
      {...provided?.draggableProps}
      {...provided?.dragHandleProps}
      ref={provided?.innerRef}
      onClick={handleClick}
    >
      <RecordContextProvider value={deal}>
        <Card
          className={`rounded-lg py-0 transition-all duration-200 ${
            snapshot?.isDragging
              ? "rotate-1 border-primary/40 opacity-95 shadow-xl"
              : "shadow-xs hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md"
          }`}
        >
          <CardContent className="flex flex-col gap-3 p-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-muted-foreground">
                  <ReferenceField
                    source="company_id"
                    reference="companies"
                    link={false}
                  />
                </p>
                <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug">
                  {deal.name}
                </p>
              </div>
              <ReferenceField
                source="company_id"
                reference="companies"
                link={false}
              >
                <CompanyAvatar width={20} height={20} />
              </ReferenceField>
              <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
            </div>

            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Value
                </p>
                <p className="text-sm font-semibold tabular-nums">
                  <NumberField
                    source="amount"
                    locales="en-IN"
                    options={{
                      notation: "standard",
                      style: "currency",
                      currency,
                      currencyDisplay: "narrowSymbol",
                      maximumFractionDigits: 2,
                    }}
                  />
                </p>
              </div>
              {deal.category ? (
                <Badge variant="secondary" className="max-w-[9rem] truncate">
                  <SelectField
                    source="category"
                    choices={dealCategories}
                    optionText="label"
                    optionValue="value"
                  />
                </Badge>
              ) : null}
            </div>

            {deal.next_follow_up_at || deal.expected_closing_date ? (
              <div className="flex items-center gap-1.5 border-t pt-2 text-[11px] text-muted-foreground">
                <CalendarDays className="size-3.5" />
                <span>
                  {deal.next_follow_up_at ? "Follow up" : "Expected close"}:{" "}
                  {new Intl.DateTimeFormat("en-IN", {
                    day: "numeric",
                    month: "short",
                  }).format(
                    new Date(
                      deal.next_follow_up_at ?? deal.expected_closing_date,
                    ),
                  )}
                </span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </RecordContextProvider>
    </div>
  );
};
