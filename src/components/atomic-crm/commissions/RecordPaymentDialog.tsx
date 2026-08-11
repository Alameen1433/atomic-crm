import { useMutation } from "@tanstack/react-query";
import { useDataProvider, useNotify, useRefresh } from "ra-core";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
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
import type { ClientType, Deal } from "../types";
import {
  getTodayInputDateString,
  parseInputDateAtLocalMidnight,
} from "../misc/localDate";

export const RecordPaymentDialog = ({
  deal,
  open,
  onOpenChange,
}: {
  deal: Deal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();
  const [clientType, setClientType] = useState<ClientType>(
    deal.client_type ?? "new",
  );
  const [invoiceTotal, setInvoiceTotal] = useState(String(deal.amount || ""));
  const [paymentAmount, setPaymentAmount] = useState("");
  const [receivedAt, setReceivedAt] = useState(getTodayInputDateString());
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      dataProvider.recordClientPayment({
        deal_id: deal.id,
        confirmed_client_type: clientType,
        final_invoice_total: Number(invoiceTotal),
        first_payment_amount: Number(paymentAmount),
        first_payment_received_at:
          parseInputDateAtLocalMidnight(receivedAt).toISOString(),
        first_payment_reference: reference || undefined,
        internal_note: note || undefined,
      }),
    onSuccess: () => {
      notify("Commission created in Pending Review", { type: "success" });
      onOpenChange(false);
      refresh();
    },
    onError: (error: Error) => notify(error.message, { type: "error" }),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (Number(paymentAmount) > Number(invoiceTotal)) {
      notify("First payment cannot exceed the final invoice total", {
        type: "error",
      });
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record first client payment</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This creates the full commission using the rate locked when the deal
          was created.
        </p>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="confirmed-client-type">Confirmed client type</Label>
            <select
              id="confirmed-client-type"
              className="h-10 w-full rounded-md border bg-background px-3"
              value={clientType}
              onChange={(event) =>
                setClientType(event.target.value as ClientType)
              }
            >
              <option value="new">New client</option>
              <option value="recurring">Recurring client</option>
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="final-invoice-total">
                Final invoice total (₹)
              </Label>
              <Input
                id="final-invoice-total"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={invoiceTotal}
                onChange={(event) => setInvoiceTotal(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="first-payment-amount">
                First payment received (₹)
              </Label>
              <Input
                id="first-payment-amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-received-at">Received date</Label>
            <Input
              id="payment-received-at"
              type="date"
              required
              value={receivedAt}
              onChange={(event) => setReceivedAt(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-reference">
              Payment reference (optional)
            </Label>
            <Input
              id="payment-reference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-note">Internal note (optional)</Label>
            <Textarea
              id="payment-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating…" : "Create commission"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
