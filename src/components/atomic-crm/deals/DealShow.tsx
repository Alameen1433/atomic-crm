import { useMutation } from "@tanstack/react-query";
import { isValid } from "date-fns";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  IndianRupee,
  Layers3,
  Shapes,
  type LucideIcon,
} from "lucide-react";
import {
  InfiniteListBase,
  ShowBase,
  useDataProvider,
  useNotify,
  useRecordContext,
  useGetIdentity,
  useGetList,
  useRedirect,
  useRefresh,
  useTranslate,
  useUpdate,
} from "ra-core";
import { DeleteButton } from "@/components/admin/delete-button";
import { EditButton } from "@/components/admin/edit-button";
import { ReferenceArrayField } from "@/components/admin/reference-array-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import { NoteCreate } from "../notes/NoteCreate";
import { NotesIterator } from "../notes/NotesIterator";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Commission, Deal } from "../types";
import { ContactList } from "./ContactList";
import { findDealLabel, formatISODateString } from "./dealUtils";
import { RecordPaymentDialog } from "../commissions/RecordPaymentDialog";
import { ReassignDealDialog } from "./ReassignDealDialog";
import { DealDialogContent } from "./DealDialogContent";
import { DealDialogHeader } from "./DealDialogHeader";

export const DealShow = ({ open, id }: { open: boolean; id?: string }) => {
  const redirect = useRedirect();
  const handleClose = () => {
    redirect("list", "deals");
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DealDialogContent>
        {id ? (
          <ShowBase id={id}>
            <DealShowContent />
          </ShowBase>
        ) : null}
      </DealDialogContent>
    </Dialog>
  );
};

const DealShowContent = () => {
  const translate = useTranslate();
  const { dealStages, dealCategories, currency } = useConfigurationContext();
  const record = useRecordContext<Deal>();
  const { identity } = useGetIdentity();
  const isMobile = useIsMobile();
  if (!record) return null;

  return (
    <div className="min-h-full">
      <div className={cn(!isMobile && "space-y-2")}>
        {record.archived_at ? <ArchivedTitle /> : null}
        <div className="flex-1">
          <DealDialogHeader
            title={record.name}
            actions={
              <DealActions
                record={record}
                identity={identity}
                className={record.archived_at ? "" : "pr-12"}
              />
            }
          />

          <div className={cn(isMobile && "space-y-6 px-4 py-4 pb-8")}>
            {isMobile ? (
              <DealActions record={record} identity={identity} mobile />
            ) : null}

            <dl
              className={cn(
                isMobile ? "grid grid-cols-2 gap-3" : "m-4 flex gap-8",
              )}
            >
              <DealFact
                icon={CalendarDays}
                label={translate(
                  "resources.deals.fields.expected_closing_date",
                )}
                mobile={isMobile}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span>
                    {isValid(new Date(record.expected_closing_date))
                      ? formatISODateString(record.expected_closing_date)
                      : translate("resources.deals.invalid_date")}
                  </span>
                  {new Date(record.expected_closing_date) < new Date() ? (
                    <Badge variant="destructive">
                      {translate("crm.common.past")}
                    </Badge>
                  ) : null}
                </div>
              </DealFact>

              <DealFact
                icon={IndianRupee}
                label={translate("resources.deals.fields.amount")}
                mobile={isMobile}
              >
                {record.amount.toLocaleString("en-US", {
                  notation: "compact",
                  style: "currency",
                  currency,
                  currencyDisplay: "narrowSymbol",
                  minimumSignificantDigits: 3,
                })}
              </DealFact>

              {record.category ? (
                <DealFact
                  icon={Shapes}
                  label={translate("resources.deals.fields.category")}
                  mobile={isMobile}
                >
                  {dealCategories.find((c) => c.value === record.category)
                    ?.label ?? record.category}
                </DealFact>
              ) : null}

              <DealFact
                icon={Layers3}
                label={translate("resources.deals.fields.stage")}
                mobile={isMobile}
              >
                {findDealLabel(dealStages, record.stage)}
              </DealFact>
            </dl>

            {!!record.contact_ids?.length && (
              <section className={cn(!isMobile && "m-4")}>
                <div className="flex min-h-12 flex-col">
                  <h3 className="text-xs font-medium tracking-wide text-muted-foreground">
                    {translate("resources.deals.fields.contact_ids")}
                  </h3>
                  <ReferenceArrayField
                    source="contact_ids"
                    reference="contacts_summary"
                  >
                    <ContactList />
                  </ReferenceArrayField>
                </div>
              </section>
            )}

            {record.description && (
              <section
                className={cn("whitespace-pre-line", !isMobile && "m-4")}
              >
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground">
                  {translate("resources.deals.fields.description")}
                </h3>
                <p className="mt-1 text-sm leading-6">{record.description}</p>
              </section>
            )}

            <section className={cn(!isMobile && "m-4")}>
              <Separator className="mb-4" />
              <InfiniteListBase
                resource="deal_notes"
                filter={{ deal_id: record.id }}
                sort={{ field: "date", order: "DESC" }}
                perPage={25}
                disableSyncWithLocation
                storeKey={false}
                empty={<NoteCreate reference={"deals"} />}
              >
                <NotesIterator reference="deals" />
              </InfiniteListBase>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

const DealActions = ({
  record,
  identity,
  mobile = false,
  className,
}: {
  record: Deal;
  identity: unknown;
  mobile?: boolean;
  className?: string;
}) => (
  <div
    aria-label="Deal actions"
    className={cn(
      mobile
        ? "grid grid-cols-2 gap-2 [&>*]:h-auto [&>*]:min-h-11 [&>*]:w-full [&>*]:justify-center [&>*]:whitespace-normal"
        : "flex flex-wrap justify-end gap-2",
      className,
    )}
  >
    {(identity as any)?.administrator && record.stage === "won" ? (
      <RecordPaymentButton deal={record} />
    ) : null}
    {(identity as any)?.administrator ? (
      <ReassignDealButton deal={record} />
    ) : null}
    {record.archived_at ? (
      <>
        <UnarchiveButton record={record} />
        <DeleteButton />
      </>
    ) : (
      <>
        <ArchiveButton record={record} />
        <EditButton />
      </>
    )}
  </div>
);

const DealFact = ({
  icon: Icon,
  label,
  mobile,
  children,
}: {
  icon: LucideIcon;
  label: string;
  mobile: boolean;
  children: ReactNode;
}) => (
  <div
    className={cn(
      "min-w-0",
      mobile ? "rounded-xl border bg-muted/30 p-3" : "mr-10 flex flex-col",
    )}
  >
    <dt className="flex items-center gap-1.5 text-xs tracking-wide text-muted-foreground">
      {mobile ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
      {label}
    </dt>
    <dd className="mt-1 text-sm font-medium">{children}</dd>
  </div>
);

const RecordPaymentButton = ({ deal }: { deal: Deal }) => {
  const [open, setOpen] = useState(false);
  const { data, isPending, error } = useGetList<Commission>("commissions", {
    filter: { deal_id: deal.id },
    pagination: { page: 1, perPage: 20 },
    sort: { field: "created_at", order: "DESC" },
  });
  if (isPending || error) return null;
  if (
    data?.some(
      (commission) => !["rejected", "reversed"].includes(commission.status),
    )
  ) {
    return null;
  }
  return (
    <>
      <Button onClick={() => setOpen(true)}>Record client payment</Button>
      <RecordPaymentDialog deal={deal} open={open} onOpenChange={setOpen} />
    </>
  );
};

const ReassignDealButton = ({ deal }: { deal: Deal }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Reassign
      </Button>
      <ReassignDealDialog deal={deal} open={open} onOpenChange={setOpen} />
    </>
  );
};

const ArchivedTitle = () => {
  const translate = useTranslate();
  return (
    <div className="bg-orange-500 px-6 py-4">
      <h3 className="text-lg font-bold text-white">
        {translate("resources.deals.archived.title")}
      </h3>
    </div>
  );
};

const ArchiveButton = ({ record }: { record: Deal }) => {
  const translate = useTranslate();
  const [update] = useUpdate();
  const redirect = useRedirect();
  const notify = useNotify();
  const refresh = useRefresh();
  const handleClick = () => {
    update(
      "deals",
      {
        id: record.id,
        data: { archived_at: new Date().toISOString() },
        previousData: record,
      },
      {
        onSuccess: () => {
          redirect("list", "deals");
          notify("resources.deals.archived.success", {
            type: "info",
            undoable: false,
          });
          refresh();
        },
        onError: () => {
          notify("resources.deals.archived.error", {
            type: "error",
          });
        },
      },
    );
  };

  return (
    <Button
      onClick={handleClick}
      size="sm"
      variant="outline"
      className="flex h-11 items-center gap-2"
    >
      <Archive className="w-4 h-4" />
      {translate("resources.deals.archived.action")}
    </Button>
  );
};

const UnarchiveButton = ({ record }: { record: Deal }) => {
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const redirect = useRedirect();
  const notify = useNotify();
  const refresh = useRefresh();

  const { mutate } = useMutation({
    mutationFn: () => dataProvider.unarchiveDeal(record),
    onSuccess: () => {
      redirect("list", "deals");
      notify("resources.deals.unarchived.success", {
        type: "info",
        undoable: false,
      });
      refresh();
    },
    onError: () => {
      notify("resources.deals.unarchived.error", {
        type: "error",
      });
    },
  });

  const handleClick = () => {
    mutate();
  };

  return (
    <Button
      onClick={handleClick}
      size="sm"
      variant="outline"
      className="flex h-11 items-center gap-2"
    >
      <ArchiveRestore className="w-4 h-4" />
      {translate("resources.deals.unarchived.action")}
    </Button>
  );
};
