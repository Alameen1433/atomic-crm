import {
  EditBase,
  Form,
  useEditContext,
  useNotify,
  useRecordContext,
  useRedirect,
  useTranslate,
} from "ra-core";
import { Link } from "react-router";
import { DeleteButton } from "@/components/admin/delete-button";
import { ReferenceField } from "@/components/admin/reference-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import { FormToolbar } from "../layout/FormToolbar";
import { CompanyAvatar } from "../companies/CompanyAvatar";
import type { Deal } from "../types";
import { DealInputs } from "./DealInputs";
import { DealDialogContent } from "./DealDialogContent";

export const DealEdit = ({ open, id }: { open: boolean; id?: string }) => {
  const redirect = useRedirect();
  const notify = useNotify();
  const isMobile = useIsMobile();

  const handleClose = () => {
    redirect("/deals", undefined, undefined, undefined, {
      _scrollToTop: false,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DealDialogContent>
        {id ? (
          <EditBase
            id={id}
            mutationMode="pessimistic"
            mutationOptions={{
              onSuccess: () => {
                notify("resources.deals.updated", {});
                redirect(`/deals/${id}/show`, undefined, undefined, undefined, {
                  _scrollToTop: false,
                });
              },
            }}
          >
            <EditHeader />
            <Form>
              <div
                className={cn(
                  isMobile &&
                    "px-4 pt-5 [&_input]:min-h-11 [&_[role=combobox]]:min-h-11",
                )}
              >
                <DealInputs />
              </div>
              <FormToolbar mobileFullBleed />
            </Form>
          </EditBase>
        ) : null}
      </DealDialogContent>
    </Dialog>
  );
};

function EditHeader() {
  const { defaultTitle } = useEditContext<Deal>();
  const deal = useRecordContext<Deal>();
  const isMobile = useIsMobile();
  if (!deal) {
    return null;
  }

  return (
    <>
      <header
        className={cn(
          "flex items-center",
          isMobile
            ? "sticky top-0 z-20 gap-3 border-b bg-background/95 px-4 py-3 pr-16 backdrop-blur"
            : "mb-8 justify-between gap-4",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <ReferenceField source="company_id" reference="companies" link="show">
            <CompanyAvatar />
          </ReferenceField>
          <DialogTitle
            className={cn(
              "min-w-0 text-left font-semibold",
              isMobile
                ? "line-clamp-2 text-lg leading-snug"
                : "text-2xl leading-tight",
            )}
          >
            {defaultTitle}
          </DialogTitle>
        </div>
        {!isMobile ? <EditHeaderActions deal={deal} /> : null}
      </header>
      {isMobile ? (
        <div className="px-4 pt-4">
          <EditHeaderActions deal={deal} mobile />
        </div>
      ) : null}
    </>
  );
}

const EditHeaderActions = ({
  deal,
  mobile = false,
}: {
  deal: Deal;
  mobile?: boolean;
}) => {
  const translate = useTranslate();

  return (
    <div
      className={cn(
        mobile
          ? "grid grid-cols-2 gap-2 [&>*]:h-auto [&>*]:min-h-11 [&>*]:w-full [&>*]:justify-center [&>*]:whitespace-normal"
          : "flex gap-2 pr-12",
      )}
    >
      <DeleteButton />
      <Button asChild variant="outline" className="h-11">
        <Link to={`/deals/${deal.id}/show`}>
          {translate("resources.deals.action.back_to_deal")}
        </Link>
      </Button>
    </div>
  );
};
