import type { Identifier, RaRecord } from "ra-core";
import type { ComponentType } from "react";

import type {
  COMPANY_CREATED,
  CONTACT_CREATED,
  CONTACT_NOTE_CREATED,
  DEAL_CREATED,
  DEAL_NOTE_CREATED,
} from "./consts";

export type SignUpData = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
};

export type SalesFormData = {
  avatar?: string;
  email: string;
  password?: string;
  first_name: string;
  last_name: string;
  administrator: boolean;
  disabled: boolean;
  new_client_commission_rate: number;
  recurring_client_commission_rate: number;
};

export type Sale = {
  first_name: string;
  last_name: string;
  administrator: boolean;
  avatar?: RAFile;
  disabled?: boolean;
  user_id: string;
  new_client_commission_rate: number;
  recurring_client_commission_rate: number;
  deletion_pending_at?: string | null;
  deletion_replacement_sales_id?: Identifier | null;

  /**
   * This is a copy of the user's email, to make it easier to handle by react admin
   * DO NOT UPDATE this field directly, it should be updated by the backend
   */
  email: string;

  /**
   * This is used by the fake rest provider to store the password
   * DO NOT USE this field in your code besides the fake rest provider
   * @deprecated
   */
  password?: string;
} & Pick<RaRecord, "id">;

export type DeleteSalesUserInput = {
  salesId: Identifier;
  replacementSalesId: Identifier;
  confirmationEmail: string;
};

export type DeleteSalesUserResult = {
  eventId: Identifier;
  sourceSalesId: Identifier;
  replacementSalesId: Identifier;
  transferCounts: Record<string, number>;
};

export type Company = {
  name: string;
  logo: RAFile;
  sector: string;
  size: 1 | 10 | 50 | 250 | 500;
  linkedin_url: string;
  website: string;
  phone_number: string;
  address: string;
  zipcode: string;
  city: string;
  state_abbr: string;
  sales_id?: Identifier;
  created_at: string;
  description: string;
  revenue: string;
  tax_identifier: string;
  country: string;
  context_links?: string[];
  archived_at?: string | null;
  nb_contacts?: number;
  nb_deals?: number;
} & Pick<RaRecord, "id">;

export type EmailAndType = {
  email: string;
  type: "Work" | "Home" | "Other";
};

export type PhoneNumberAndType = {
  number: string;
  type: "Work" | "Home" | "Other";
};

export type Contact = {
  first_name: string;
  last_name: string;
  title: string;
  company_id?: Identifier | null;
  email_jsonb: EmailAndType[];
  avatar?: Partial<RAFile>;
  linkedin_url?: string | null;
  first_seen: string;
  last_seen: string;
  has_newsletter: boolean;
  tags: number[];
  gender: string;
  sales_id?: Identifier;
  status: string;
  background: string;
  phone_jsonb: PhoneNumberAndType[];
  nb_tasks?: number;
  company_name?: string;
  archived_at?: string | null;
} & Pick<RaRecord, "id">;

export type ContactNote = {
  contact_id: Identifier;
  text: string;
  date: string;
  sales_id: Identifier;
  status: string;
  attachments?: AttachmentNote[];
} & Pick<RaRecord, "id">;

export type Deal = {
  name: string;
  company_id: Identifier;
  contact_ids: Identifier[];
  category: string;
  stage: string;
  description: string;
  amount: number;
  created_at: string;
  updated_at: string;
  archived_at?: string;
  expected_closing_date: string;
  sales_id: Identifier;
  index: number;
  lead_source?: string;
  client_type: ClientType;
  next_follow_up_at?: string | null;
  new_commission_rate_snapshot: number;
  recurring_commission_rate_snapshot: number;
} & Pick<RaRecord, "id">;

export type ClientType = "new" | "recurring";

export type CommissionStatus =
  | "pending_review"
  | "approved"
  | "scheduled"
  | "paid"
  | "rejected"
  | "reversed";

export type Commission = {
  deal_id: Identifier;
  sales_id: Identifier;
  confirmed_client_type: ClientType;
  final_invoice_total: number;
  applied_rate: number;
  commission_amount: number;
  prior_settled_amount: number;
  balance_amount: number;
  first_payment_amount: number;
  first_payment_received_at: string;
  first_payment_reference?: string | null;
  status: CommissionStatus;
  scheduled_for?: string | null;
  paid_at?: string | null;
  payout_reference?: string | null;
  internal_note?: string | null;
  reason?: string | null;
  replacement_for_id?: Identifier | null;
  created_by: Identifier;
  created_at: string;
  updated_at: string;
} & Pick<RaRecord, "id">;

export type CommissionEvent = {
  commission_id: Identifier;
  actor_sales_id: Identifier;
  event_type: string;
  previous_status?: CommissionStatus | null;
  new_status?: CommissionStatus | null;
  reason?: string | null;
  details: Record<string, unknown>;
  created_at: string;
} & Pick<RaRecord, "id">;

export type RecordClientPaymentInput = {
  deal_id: Identifier;
  confirmed_client_type: ClientType;
  final_invoice_total: number;
  first_payment_amount: number;
  first_payment_received_at: string;
  first_payment_reference?: string;
  internal_note?: string;
};

export type TransitionCommissionInput = {
  commission_id: Identifier;
  new_status: CommissionStatus;
  scheduled_for?: string;
  paid_at?: string;
  payout_reference?: string;
  reason?: string;
};

export type DealNote = {
  deal_id: Identifier;
  text: string;
  date: string;
  sales_id: Identifier;
  attachments?: AttachmentNote[];

  // This is defined for compatibility with `ContactNote`
  status?: undefined;
} & Pick<RaRecord, "id">;

export type Tag = {
  id: number;
  name: string;
  color: string;
};

export type Task = {
  contact_id: Identifier;
  type: string;
  text: string;
  due_date: string;
  done_date?: string | null;
  sales_id?: Identifier;
} & Pick<RaRecord, "id">;

export type ActivityCompanyCreated = {
  type: typeof COMPANY_CREATED;
  company_id: Identifier;
  company: Company;
  sales_id: Identifier;
  date: string;
} & Pick<RaRecord, "id">;

export type ActivityContactCreated = {
  type: typeof CONTACT_CREATED;
  company_id: Identifier;
  sales_id?: Identifier;
  contact: Contact;
  date: string;
} & Pick<RaRecord, "id">;

export type ActivityContactNoteCreated = {
  type: typeof CONTACT_NOTE_CREATED;
  sales_id?: Identifier;
  contactNote: ContactNote;
  date: string;
} & Pick<RaRecord, "id">;

export type ActivityDealCreated = {
  type: typeof DEAL_CREATED;
  company_id: Identifier;
  sales_id?: Identifier;
  deal: Deal;
  date: string;
};

export type ActivityDealNoteCreated = {
  type: typeof DEAL_NOTE_CREATED;
  sales_id?: Identifier;
  dealNote: DealNote;
  date: string;
};

export type Activity = RaRecord &
  (
    | ActivityCompanyCreated
    | ActivityContactCreated
    | ActivityContactNoteCreated
    | ActivityDealCreated
    | ActivityDealNoteCreated
  );

export interface RAFile {
  src: string;
  title: string;
  path?: string;
  rawFile: File;
  type?: string;
}

export type AttachmentNote = RAFile;

export interface LabeledValue {
  value: string;
  label: string;
}

export type DealStage = LabeledValue;

export interface NoteStatus extends LabeledValue {
  color: string;
}

export interface ContactGender {
  value: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}
