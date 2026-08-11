import { CreateBase, Form, useGetIdentity, useTranslate } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { CancelButton } from "@/components/admin/cancel-button";
import { SaveButton } from "@/components/admin/form";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import { CompanyInputs } from "./CompanyInputs";
import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import { MobileBackButton } from "../misc/MobileBackButton";

export const CompanyCreate = () => {
  const { identity } = useGetIdentity();
  const translate = useTranslate();
  const isMobile = useIsMobile();
  const form = (
    <div className={cn("flex", !isMobile && "mt-2 lg:mr-72")}>
      <div className="min-w-0 flex-1">
        <Form defaultValues={{ sales_id: identity?.id }}>
          <Card className={cn(isMobile && "gap-0 py-0")}>
            <CardContent className={cn(isMobile && "p-4")}>
              <CompanyInputs />
              <div
                role="toolbar"
                className="sticky bottom-0 flex flex-row justify-end gap-2 bg-linear-to-b from-transparent to-card to-10% pt-4 pb-4 md:pb-0"
              >
                <CancelButton />
                <SaveButton
                  label={translate("resources.companies.action.create", {
                    _: "Create Company",
                  })}
                />
              </div>
            </CardContent>
          </Card>
        </Form>
      </div>
    </div>
  );

  return (
    <CreateBase
      redirect="show"
      transform={(values) => {
        // add https:// before website if not present
        if (values.website && !values.website.startsWith("http")) {
          values.website = `https://${values.website}`;
        }
        return values;
      }}
    >
      {isMobile ? (
        <>
          <MobileHeader>
            <MobileBackButton to="/companies" />
            <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">
              {translate("resources.companies.action.new", {
                _: "New Company",
              })}
            </h1>
          </MobileHeader>
          <MobileContent>{form}</MobileContent>
        </>
      ) : (
        form
      )}
    </CreateBase>
  );
};
