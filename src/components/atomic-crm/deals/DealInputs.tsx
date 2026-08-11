import { required, useGetIdentity, useGetList, useTranslate } from "ra-core";
import { useWatch } from "react-hook-form";
import { AutocompleteArrayInput } from "@/components/admin/autocomplete-array-input";
import { ReferenceArrayInput } from "@/components/admin/reference-array-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { TextInput } from "@/components/admin/text-input";
import { NumberInput } from "@/components/admin/number-input";
import { DateInput } from "@/components/admin/date-input";
import { SelectInput } from "@/components/admin/select-input";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";

import { contactOptionText } from "../misc/ContactOption";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { AutocompleteCompanyInput } from "../companies/AutocompleteCompanyInput.tsx";

const leadSources = [
  { value: "referral", label: "Referral" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "website", label: "Website / Inbound" },
  { value: "cold-outreach", label: "Cold Outreach" },
  { value: "networking", label: "Networking / Event" },
  { value: "existing-client", label: "Existing Client" },
  { value: "other", label: "Other" },
];

export const DealInputs = () => {
  const isMobile = useIsMobile();
  return (
    <div className="flex flex-col gap-8">
      <DealInfoInputs />

      <div className={`flex gap-6 ${isMobile ? "flex-col" : "flex-row"}`}>
        <DealLinkedToInputs />
        <Separator orientation={isMobile ? "horizontal" : "vertical"} />
        <DealMiscInputs />
      </div>
    </div>
  );
};

const DealInfoInputs = () => {
  return (
    <div className="flex flex-col gap-4 flex-1">
      <TextInput source="name" validate={required()} helperText={false} />
      <TextInput
        source="description"
        label="Project requirements"
        multiline
        rows={3}
        helperText={false}
      />
    </div>
  );
};

const DealLinkedToInputs = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4 flex-1">
      <h3 className="text-base font-medium">
        {translate("resources.deals.inputs.linked_to")}
      </h3>
      <ReferenceInput source="company_id" reference="companies">
        <AutocompleteCompanyInput
          label="resources.deals.fields.company_id"
          validate={required()}
          modal
        />
      </ReferenceInput>

      <ReferenceArrayInput source="contact_ids" reference="contacts_summary">
        <AutocompleteArrayInput
          label="resources.deals.fields.contact_ids"
          optionText={contactOptionText}
          helperText={false}
        />
      </ReferenceArrayInput>
    </div>
  );
};

const DealMiscInputs = () => {
  const { dealStages, dealCategories } = useConfigurationContext();
  const { identity } = useGetIdentity();
  const companyId = useWatch({ name: "company_id" });
  const { data: priorWonDeals = [] } = useGetList(
    "deals",
    {
      filter: {
        company_id: companyId,
        stage: "won",
        sales_id: identity?.id,
      },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "created_at", order: "DESC" },
    },
    { enabled: Boolean(companyId && identity?.id) },
  );
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4 flex-1">
      <h3 className="text-base font-medium">
        {translate("resources.deals.field_categories.misc")}
      </h3>

      <SelectInput
        source="category"
        label="Primary service"
        choices={dealCategories}
        optionText="label"
        optionValue="value"
        helperText={false}
      />
      <SelectInput
        source="lead_source"
        label="Lead source"
        choices={leadSources}
        optionText="label"
        optionValue="value"
        helperText={false}
        validate={required()}
      />
      <SelectInput
        source="client_type"
        label="Client type"
        choices={[
          { value: "new", label: "New client" },
          { value: "recurring", label: "Recurring client" },
        ]}
        optionText="label"
        optionValue="value"
        defaultValue="new"
        helperText={
          identity
            ? `${priorWonDeals.length ? "This partner has a previous won deal for this client; recurring is suggested. " : ""}Estimated rate: new ${Number((identity as any).new_client_commission_rate ?? 20)}% / recurring ${Number((identity as any).recurring_client_commission_rate ?? 15)}%. Admin confirms the final type.`
            : false
        }
        validate={required()}
      />
      <NumberInput
        source="amount"
        defaultValue={0}
        helperText={false}
        validate={required()}
      />
      <DateInput
        validate={required()}
        source="expected_closing_date"
        helperText={false}
        defaultValue={new Date().toISOString().split("T")[0]}
      />
      <DateInput
        source="next_follow_up_at"
        label="Next follow-up"
        helperText={false}
      />
      <SelectInput
        source="stage"
        choices={dealStages}
        optionText="label"
        optionValue="value"
        defaultValue="new-lead"
        helperText={false}
        validate={required()}
      />
    </div>
  );
};
