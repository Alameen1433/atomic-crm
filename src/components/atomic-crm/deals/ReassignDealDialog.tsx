import { useMutation } from "@tanstack/react-query";
import { useDataProvider, useGetList, useNotify, useRefresh } from "ra-core";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { CrmDataProvider } from "../providers/types";
import type { Deal, Sale } from "../types";

export const ReassignDealDialog = ({
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
  const { data: partners = [] } = useGetList<Sale>("sales", {
    filter: { "disabled@neq": true, "administrator@neq": true },
    pagination: { page: 1, perPage: 200 },
    sort: { field: "first_name", order: "ASC" },
  });
  const [partnerId, setPartnerId] = useState("");
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      dataProvider.reassignDeal({
        deal_id: deal.id,
        new_sales_id: partnerId,
        reason,
      }),
    onSuccess: () => {
      notify("Deal reassigned and commission rates re-snapshotted", {
        type: "success",
      });
      onOpenChange(false);
      refresh();
    },
    onError: (error: Error) => notify(error.message, { type: "error" }),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reassign deal</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          The receiving partner gets private copies of the linked company and
          contacts. Approved commissions must be reversed first.
        </p>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="new-partner">New sales partner</Label>
            <select
              id="new-partner"
              className="h-10 w-full rounded-md border bg-background px-3"
              required
              value={partnerId}
              onChange={(event) => setPartnerId(event.target.value)}
            >
              <option value="">Select a partner</option>
              {partners
                .filter((partner) => partner.id !== deal.sales_id)
                .map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.first_name} {partner.last_name}
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reassignment-reason">Reason</Label>
            <Textarea
              id="reassignment-reason"
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
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
              {mutation.isPending ? "Reassigning…" : "Reassign deal"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
