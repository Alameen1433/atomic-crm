import type {
  Company,
  Commission,
  CommissionEvent,
  Contact,
  ContactNote,
  Deal,
  DealNote,
  Sale,
  Tag,
  Task,
} from "../../../types";
import type { ConfigurationContextValue } from "../../../root/ConfigurationContext";

export interface Db {
  companies: Company[];
  contacts: Contact[];
  contact_notes: ContactNote[];
  deals: Deal[];
  deal_notes: DealNote[];
  sales: Sale[];
  sales_identities: Sale[];
  tags: Tag[];
  tasks: Task[];
  commissions: Commission[];
  commission_events: CommissionEvent[];
  configuration: Array<{ id: number; config: ConfigurationContextValue }>;
}
