import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import {
  useDataProvider,
  useEditController,
  useNotify,
  useRecordContext,
  useRedirect,
  useTranslate,
} from "ra-core";
import type { SubmitHandler } from "react-hook-form";
import { SimpleForm } from "@/components/admin/simple-form";
import { CancelButton } from "@/components/admin/cancel-button";
import { Confirm } from "@/components/admin/confirm";
import { SaveButton } from "@/components/admin/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import type { CrmDataProvider } from "../providers/types";
import type { Sale, SalesFormData } from "../types";
import { SalesInputs } from "./SalesInputs";

/**
 * Renders edit actions for resetting a partner password, canceling changes, and saving the record.
 */
function EditToolbar() {
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      <ResetPartnerPasswordButton />
      <div className="flex justify-end gap-4">
        <CancelButton />
        <SaveButton />
      </div>
    </div>
  );
}

/**
 * Renders a button and confirmation dialog for sending a partner password-reset email.
 */
function ResetPartnerPasswordButton() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const record = useRecordContext<Sale>();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();

  const mutation = useMutation({
    mutationKey: ["resetPartnerPassword", record?.id],
    mutationFn: async () => {
      if (!record) throw new Error("User not found");
      return dataProvider.updatePassword(record.id);
    },
    onSuccess: () => {
      setConfirmOpen(false);
      notify("Password reset email sent", {
        messageArgs: {
          _: `A password reset email was sent to ${record?.email}.`,
        },
      });
    },
    onError: () => {
      notify("Failed to send password reset email", { type: "error" });
    },
  });

  if (!record) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setConfirmOpen(true)}
      >
        <KeyRound className="mr-2 size-4" />
        Send password reset
      </Button>
      <Confirm
        isOpen={confirmOpen}
        loading={mutation.isPending}
        title="Send password reset email?"
        content={`A secure reset link will be sent to ${record.email}. The administrator will not see or choose the new password.`}
        confirm="Send reset email"
        onConfirm={() => mutation.mutate()}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}

/**
 * Renders the sales edit form and handles updating the current sale.
 */
export function SalesEdit() {
  const { record } = useEditController();

  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const redirect = useRedirect();
  const translate = useTranslate();

  const { mutate } = useMutation({
    mutationKey: ["signup"],
    mutationFn: async (data: SalesFormData) => {
      if (!record) {
        throw new Error(
          translate("resources.sales.edit.record_not_found", {
            _: "Record not found",
          }),
        );
      }
      return dataProvider.salesUpdate(record.id, data);
    },
    onSuccess: () => {
      redirect("/sales");
      notify("resources.sales.edit.success", {
        messageArgs: {
          _: "User updated successfully",
        },
      });
    },
    onError: () => {
      notify("resources.sales.edit.error", {
        type: "error",
        messageArgs: {
          _: "An error occurred. Please try again.",
        },
      });
    },
  });

  const onSubmit: SubmitHandler<SalesFormData> = async (data) => {
    mutate(data);
  };

  return (
    <div className="max-w-lg w-full mx-auto mt-8">
      <Card>
        <CardContent>
          <SimpleForm
            toolbar={<EditToolbar />}
            onSubmit={onSubmit as SubmitHandler<any>}
            record={record}
          >
            <SaleEditTitle />
            <SalesInputs />
          </SimpleForm>
        </CardContent>
      </Card>
    </div>
  );
}

const SaleEditTitle = () => {
  const record = useRecordContext<Sale>();
  const translate = useTranslate();
  if (!record) return null;
  return (
    <h2 className="text-lg font-semibold mb-4">
      {translate("resources.sales.edit.title", {
        name: `${record.first_name} ${record.last_name}`,
      })}
    </h2>
  );
};
