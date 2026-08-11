import { useMutation } from "@tanstack/react-query";
import { CalendarClock, Check, IndianRupee, RotateCcw, X } from "lucide-react";
import {
  useDataProvider,
  useGetIdentity,
  useGetOne,
  useListContext,
  useNotify,
  useRefresh,
} from "ra-core";
import { List } from "@/components/admin/list";
import { useMemo, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { CrmDataProvider } from "../providers/types";
import type { Commission, CommissionStatus, Deal, Sale } from "../types";

const statuses: CommissionStatus[] = [
  "pending_review",
  "approved",
  "scheduled",
  "paid",
  "rejected",
  "reversed",
];

const statusLabels: Record<CommissionStatus, string> = {
  pending_review: "Pending Review",
  approved: "Approved",
  scheduled: "Scheduled",
  paid: "Paid",
  rejected: "Rejected",
  reversed: "Reversed",
};

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

export const CommissionList = () => (
  <List
    title="Commissions"
    perPage={250}
    pagination={false}
    actions={false}
    sort={{ field: "created_at", order: "DESC" }}
  >
    <CommissionBoard />
  </List>
);

const CommissionBoard = () => {
  const { data = [], isPending } = useListContext<Commission>();
  const { identity } = useGetIdentity();
  const isAdmin = Boolean((identity as any)?.administrator);

  const totals = useMemo(
    () =>
      data.reduce(
        (summary, commission) => {
          summary[commission.status] += Number(commission.balance_amount);
          return summary;
        },
        Object.fromEntries(statuses.map((status) => [status, 0])) as Record<
          CommissionStatus,
          number
        >,
      ),
    [data],
  );

  if (isPending) return null;

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Commission pipeline</h2>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Review, schedule, and record partner payouts."
              : "Your commission details and payout progress."}
          </p>
        </div>
        {!isAdmin && identity ? (
          <div className="rounded-lg border bg-card px-4 py-2 text-sm">
            New client{" "}
            <strong>
              {Number((identity as any).new_client_commission_rate)}%
            </strong>
            <span className="mx-2 text-muted-foreground">•</span>
            Recurring{" "}
            <strong>
              {Number((identity as any).recurring_client_commission_rate)}%
            </strong>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Summary label="Pending review" value={totals.pending_review} />
        <Summary
          label="Approved / scheduled"
          value={totals.approved + totals.scheduled}
        />
        <Summary label="Paid" value={totals.paid} />
      </div>

      {data.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          No commissions yet. An admin creates one after recording the first
          payment on a won deal.
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {statuses.map((status) => {
            const records = data.filter((record) => record.status === status);
            return (
              <section
                key={status}
                className="w-80 shrink-0 rounded-xl bg-muted/45 p-3"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-medium">{statusLabels[status]}</h3>
                  <Badge variant="secondary">{records.length}</Badge>
                </div>
                <div className="space-y-3">
                  {records.map((record) => (
                    <CommissionCard
                      key={record.id}
                      commission={record}
                      isAdmin={isAdmin}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

const Summary = ({ label, value }: { label: string; value: number }) => (
  <Card>
    <CardContent className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold">{money.format(value)}</p>
    </CardContent>
  </Card>
);

const CommissionCard = ({
  commission,
  isAdmin,
}: {
  commission: Commission;
  isAdmin: boolean;
}) => {
  const { data: deal } = useGetOne<Deal>("deals", {
    id: commission.deal_id,
  });
  const { data: partner } = useGetOne<Sale>(
    "sales",
    { id: commission.sales_id },
    { enabled: isAdmin },
  );
  const [action, setAction] = useState<Action | null>(null);

  return (
    <Card className="shadow-sm">
      <CardHeader className="space-y-1 p-4 pb-2">
        <CardTitle className="text-base">
          {deal?.name ?? `Deal #${commission.deal_id}`}
        </CardTitle>
        {isAdmin && partner ? (
          <p className="text-xs text-muted-foreground">
            {partner.first_name} {partner.last_name}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-1">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Detail
            label="Invoice"
            value={money.format(Number(commission.final_invoice_total))}
          />
          <Detail label="Rate" value={`${Number(commission.applied_rate)}%`} />
          <Detail
            label="Commission"
            value={money.format(Number(commission.commission_amount))}
          />
          <Detail
            label="Balance"
            value={money.format(Number(commission.balance_amount))}
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <Badge variant="outline">
            {commission.confirmed_client_type === "new"
              ? "New client"
              : "Recurring"}
          </Badge>
          {commission.scheduled_for ? (
            <span className="text-muted-foreground">
              {commission.scheduled_for}
            </span>
          ) : null}
        </div>
        {commission.reason ? (
          <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
            {commission.reason}
          </p>
        ) : null}
        {isAdmin ? (
          <CommissionActions commission={commission} onAction={setAction} />
        ) : null}
      </CardContent>
      {action ? (
        <CommissionActionDialog
          commission={commission}
          action={action}
          open
          onOpenChange={(open) => !open && setAction(null)}
        />
      ) : null}
    </Card>
  );
};

const Detail = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[0.68rem] uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
    <p className="font-medium">{value}</p>
  </div>
);

type Action =
  | "approve"
  | "schedule"
  | "paid"
  | "reject"
  | "reverse"
  | "replace";

const CommissionActions = ({
  commission,
  onAction,
}: {
  commission: Commission;
  onAction: (action: Action) => void;
}) => {
  if (commission.status === "pending_review") {
    return (
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          onClick={() => onAction("approve")}
        >
          <Check /> Approve
        </Button>
        <Button size="sm" variant="outline" onClick={() => onAction("reject")}>
          <X /> Reject
        </Button>
      </div>
    );
  }
  if (commission.status === "approved") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onAction("schedule")}>
          <CalendarClock /> Schedule
        </Button>
        <Button size="sm" variant="outline" onClick={() => onAction("paid")}>
          <IndianRupee /> Paid
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onAction("replace")}>
          Correct
        </Button>
      </div>
    );
  }
  if (commission.status === "scheduled") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onAction("paid")}>
          <IndianRupee /> Mark paid
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onAction("replace")}>
          Correct
        </Button>
      </div>
    );
  }
  if (commission.status === "paid") {
    return (
      <Button size="sm" variant="outline" onClick={() => onAction("replace")}>
        <RotateCcw /> Reverse & replace
      </Button>
    );
  }
  return null;
};

const CommissionActionDialog = ({
  commission,
  action,
  open,
  onOpenChange,
}: {
  commission: Commission;
  action: Action;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [clientType, setClientType] = useState(
    commission.confirmed_client_type,
  );
  const [invoiceTotal, setInvoiceTotal] = useState(
    String(commission.final_invoice_total),
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (action === "replace") {
        return dataProvider.replaceCommission({
          commission_id: commission.id,
          confirmed_client_type: clientType,
          final_invoice_total: Number(invoiceTotal),
          reason,
        });
      }
      const newStatus: CommissionStatus =
        action === "approve"
          ? "approved"
          : action === "schedule"
            ? "scheduled"
            : action === "paid"
              ? "paid"
              : action === "reject"
                ? "rejected"
                : "reversed";
      return dataProvider.transitionCommission({
        commission_id: commission.id,
        new_status: newStatus,
        scheduled_for: action === "schedule" ? date : undefined,
        paid_at: action === "paid" ? new Date(date).toISOString() : undefined,
        payout_reference: action === "paid" ? reference : undefined,
        reason:
          action === "reject" || action === "reverse" ? reason : undefined,
      });
    },
    onSuccess: () => {
      notify("Commission updated", { type: "success" });
      onOpenChange(false);
      refresh();
    },
    onError: (error: Error) => notify(error.message, { type: "error" }),
  });

  const needsReason =
    action === "reject" || action === "reverse" || action === "replace";
  const needsDate = action === "schedule" || action === "paid";
  const needsReference = action === "paid";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {action === "replace" ? "Correct commission" : "Update commission"}
          </DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          {action === "replace" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="client-type">Confirmed client type</Label>
                <select
                  id="client-type"
                  className="h-10 w-full rounded-md border bg-background px-3"
                  value={clientType}
                  onChange={(event) =>
                    setClientType(event.target.value as "new" | "recurring")
                  }
                >
                  <option value="new">New client</option>
                  <option value="recurring">Recurring client</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice-total">Final invoice total</Label>
                <Input
                  id="invoice-total"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={invoiceTotal}
                  onChange={(event) => setInvoiceTotal(event.target.value)}
                />
              </div>
            </>
          ) : null}
          {needsDate ? (
            <div className="space-y-2">
              <Label htmlFor="action-date">
                {action === "paid" ? "Payout date" : "Scheduled payout date"}
              </Label>
              <Input
                id="action-date"
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
          ) : null}
          {needsReference ? (
            <div className="space-y-2">
              <Label htmlFor="payout-reference">Transaction reference</Label>
              <Input
                id="payout-reference"
                required
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </div>
          ) : null}
          {needsReason ? (
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Confirm"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
