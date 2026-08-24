import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Trash2 } from "lucide-react";
import {
  useDataProvider,
  useGetIdentity,
  useGetList,
  useNotify,
  useRecordContext,
  useRedirect,
} from "ra-core";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { CrmDataProvider } from "../providers/types";
import type { Sale } from "../types";
import {
  canDeleteSalesUser,
  matchesDeletionEmail,
  totalTransferredRecords,
} from "./deleteSalesUser";

export function DeleteSalesUserButton() {
  const record = useRecordContext<Sale>();
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const redirect = useRedirect();
  const [open, setOpen] = useState(false);
  const [replacementId, setReplacementId] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const isAdministrator = Boolean(
    (identity as typeof identity & { administrator?: boolean })?.administrator,
  );
  const allowed = canDeleteSalesUser(isAdministrator, identity?.id, record?.id);
  const { data: sales = [], isPending: salesPending } = useGetList<Sale>(
    "sales",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "first_name", order: "ASC" },
      filter: { "disabled@neq": true },
    },
    { enabled: allowed && open },
  );
  const replacements = sales.filter((sale) => sale.id !== record?.id);

  const mutation = useMutation({
    mutationKey: ["deleteSalesUser", record?.id],
    mutationFn: async () => {
      if (!record || !replacementId)
        throw new Error("Select a replacement user");
      return dataProvider.salesDelete({
        salesId: record.id,
        replacementSalesId: Number(replacementId),
        confirmationEmail,
      });
    },
    onSuccess: (result) => {
      setOpen(false);
      queryClient.removeQueries({
        predicate: (query) =>
          query.queryKey[0] === "sales" ||
          query.queryKey[0] === "sales_identities",
      });
      const transferred = totalTransferredRecords(result.transferCounts);
      notify(
        `User permanently deleted. ${transferred} CRM record${transferred === 1 ? "" : "s"} transferred.`,
        { type: "success" },
      );
      redirect("/sales");
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
      notify(error.message, { type: "error" });
    },
  });

  if (!record || !allowed) return null;

  const confirmed = matchesDeletionEmail(confirmationEmail, record.email);
  const canSubmit =
    Boolean(replacementId) && confirmed && !salesPending && !mutation.isPending;

  const close = () => {
    if (mutation.isPending) return;
    setOpen(false);
    setReplacementId("");
    setConfirmationEmail("");
    setErrorMessage("");
  };

  return (
    <>
      <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
        <Trash2 className="mr-2 size-4" />
        {record.deletion_pending_at
          ? "Retry permanent deletion"
          : "Delete user"}
      </Button>

      <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && close()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Permanently delete this user?</DialogTitle>
            <DialogDescription>
              This removes {record.first_name} {record.last_name}&apos;s login.
              Their active CRM records and pending commissions will move to the
              replacement user. Historical attribution will be preserved.
            </DialogDescription>
          </DialogHeader>

          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>This cannot be undone</AlertTitle>
            <AlertDescription>
              The Auth account and active salesperson record will be permanently
              deleted. You cannot delete your own administrator account.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="replacement-user">
                Transfer active records to
              </Label>
              <Select value={replacementId} onValueChange={setReplacementId}>
                <SelectTrigger id="replacement-user" className="w-full">
                  <SelectValue placeholder="Select an active user" />
                </SelectTrigger>
                <SelectContent>
                  {replacements.map((sale) => (
                    <SelectItem key={sale.id} value={String(sale.id)}>
                      {sale.first_name} {sale.last_name} ({sale.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delete-confirmation-email">
                Type <span className="font-semibold">{record.email}</span> to
                confirm
              </Label>
              <Input
                id="delete-confirmation-email"
                type="email"
                autoComplete="off"
                value={confirmationEmail}
                onChange={(event) => setConfirmationEmail(event.target.value)}
                aria-invalid={Boolean(confirmationEmail) && !confirmed}
              />
            </div>

            {errorMessage ? (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>Deletion was not completed</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={close}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!canSubmit}
              onClick={() => mutation.mutate()}
            >
              <Trash2 className="mr-2 size-4" />
              {mutation.isPending ? "Deleting…" : "Permanently delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
