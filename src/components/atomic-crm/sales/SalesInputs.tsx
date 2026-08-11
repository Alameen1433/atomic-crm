import {
  email,
  maxValue,
  minValue,
  required,
  useGetIdentity,
  useRecordContext,
} from "ra-core";
import { BooleanInput } from "@/components/admin/boolean-input";
import { NumberInput } from "@/components/admin/number-input";
import { TextInput } from "@/components/admin/text-input";

import type { Sale } from "../types";

/**
 * Renders the sales form fields for partner identity, permissions, and commission rates.
 *
 * @returns The sales form content.
 */
export function SalesInputs() {
  const { identity } = useGetIdentity();
  const record = useRecordContext<Sale>();
  return (
    <div className="space-y-4 w-full">
      <TextInput source="first_name" validate={required()} helperText={false} />
      <TextInput source="last_name" validate={required()} helperText={false} />
      <TextInput
        source="email"
        validate={[required(), email()]}
        helperText={false}
      />
      <BooleanInput
        source="administrator"
        readOnly={record?.id === identity?.id}
        helperText={false}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NumberInput
          source="new_client_commission_rate"
          label="New client commission (%)"
          defaultValue={20}
          validate={[required(), minValue(0), maxValue(100)]}
          helperText="Locked into new deals when they are created"
        />
        <NumberInput
          source="recurring_client_commission_rate"
          label="Recurring client commission (%)"
          defaultValue={15}
          validate={[required(), minValue(0), maxValue(100)]}
          helperText="Used when this partner closes the same client again"
        />
      </div>
      <BooleanInput
        source="disabled"
        readOnly={record?.id === identity?.id}
        helperText={false}
      />
    </div>
  );
}
