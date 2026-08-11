import { EditBase, Form, useTranslate } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import { CompanyInputs } from "./CompanyInputs";
import { CompanyAside } from "./CompanyAside";
import { FormToolbar } from "../layout/FormToolbar";
import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import { MobileBackButton } from "../misc/MobileBackButton";

export const CompanyEdit = () => {
  const isMobile = useIsMobile();
  const translate = useTranslate();
  const form = (
    <div className={cn("flex gap-8", !isMobile && "mt-2")}>
      <Form className="flex min-w-0 flex-1 flex-col gap-4 pb-2">
        <Card className={cn(isMobile && "gap-0 py-0")}>
          <CardContent className={cn(isMobile && "p-4")}>
            <CompanyInputs />
            <FormToolbar />
          </CardContent>
        </Card>
      </Form>

      <CompanyAside link="show" />
    </div>
  );

  return (
    <EditBase
      actions={false}
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
              {translate("resources.companies.action.edit")}
            </h1>
          </MobileHeader>
          <MobileContent>{form}</MobileContent>
        </>
      ) : (
        form
      )}
    </EditBase>
  );
};
