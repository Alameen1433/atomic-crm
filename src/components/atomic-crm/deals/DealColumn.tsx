import { Droppable } from "@hello-pangea/dnd";
import { Plus } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { findDealLabel } from "./dealUtils";
import { DealCard } from "./DealCard";

export const DealColumn = ({
  stage,
  deals,
  stageIndex,
}: {
  stage: string;
  deals: Deal[];
  stageIndex: number;
}) => {
  const totalAmount = deals.reduce((sum, deal) => sum + deal.amount, 0);
  const { dealStages, currency } = useConfigurationContext();
  const stageColors = [
    "bg-sky-500",
    "bg-blue-500",
    "bg-violet-500",
    "bg-amber-500",
    "bg-orange-500",
    "bg-emerald-500",
    "bg-rose-500",
    "bg-slate-500",
  ];

  return (
    <section className="flex h-[clamp(31rem,calc(100dvh-13.5rem),48rem)] w-[86vw] min-w-[86vw] snap-center flex-col overflow-hidden rounded-xl border bg-muted/25 shadow-xs sm:w-[19rem] sm:min-w-[19rem] sm:snap-start">
      <div className={`h-1 ${stageColors[stageIndex % stageColors.length]}`} />
      <header className="border-b bg-background px-3.5 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">
              {findDealLabel(dealStages, stage)}
            </h3>
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">
              {totalAmount.toLocaleString("en-IN", {
                maximumFractionDigits: 2,
                notation: "standard",
                style: "currency",
                currency,
                currencyDisplay: "narrowSymbol",
              })}
              <span className="px-1.5 text-border">•</span>
              {deals.length} {deals.length === 1 ? "deal" : "deals"}
            </p>
          </div>
          <span
            className={`mt-1 size-2 shrink-0 rounded-full ${stageColors[stageIndex % stageColors.length]}`}
          />
        </div>
      </header>
      <Droppable droppableId={stage}>
        {(droppableProvided, snapshot) => (
          <div
            ref={droppableProvided.innerRef}
            {...droppableProvided.droppableProps}
            className={`flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 transition-colors ${
              snapshot.isDraggingOver
                ? "bg-primary/8 ring-2 ring-inset ring-primary/20"
                : ""
            }`}
          >
            {deals.length === 0 && !snapshot.isDraggingOver ? (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed bg-background/40 px-5 text-center">
                <p className="text-xs text-muted-foreground">
                  This stage is empty
                </p>
              </div>
            ) : null}
            {deals.map((deal, index) => (
              <DealCard key={deal.id} deal={deal} index={index} />
            ))}
            {droppableProvided.placeholder}
          </div>
        )}
      </Droppable>
      <footer className="border-t bg-background p-2">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
        >
          <Link to={`/deals/create?stage=${encodeURIComponent(stage)}`}>
            <Plus className="size-4" />
            Add deal
          </Link>
        </Button>
      </footer>
    </section>
  );
};
