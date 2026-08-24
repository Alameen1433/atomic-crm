import { generateCompanies } from "./companies";
import { generateContactNotes } from "./contactNotes";
import { generateContacts } from "./contacts";
import { generateDealNotes } from "./dealNotes";
import { generateDeals } from "./deals";
import { finalize } from "./finalize";
import { generateSales } from "./sales";
import { generateTags } from "./tags";
import { generateTasks } from "./tasks";
import type { Db } from "./types";

export default (): Db => {
  const db = {} as Db;
  db.sales = generateSales(db);
  db.sales_identities = db.sales.map((sale) => ({ ...sale }));
  db.tags = generateTags(db);
  db.companies = generateCompanies(db);
  db.contacts = generateContacts(db);
  db.contact_notes = generateContactNotes(db);
  db.deals = generateDeals(db);
  db.deal_notes = generateDealNotes(db);
  db.tasks = generateTasks(db);
  db.commissions = db.deals
    .filter((deal) => deal.stage === "won")
    .slice(0, 8)
    .map((deal, index) => {
      const rate =
        deal.client_type === "new"
          ? deal.new_commission_rate_snapshot
          : deal.recurring_commission_rate_snapshot;
      const statuses = [
        "pending_review",
        "approved",
        "scheduled",
        "paid",
      ] as const;
      return {
        id: index + 1,
        deal_id: deal.id,
        sales_id: deal.sales_id,
        confirmed_client_type: deal.client_type,
        final_invoice_total: deal.amount,
        applied_rate: rate,
        commission_amount: (deal.amount * rate) / 100,
        prior_settled_amount: 0,
        balance_amount: (deal.amount * rate) / 100,
        first_payment_amount: Math.max(1, deal.amount * 0.25),
        first_payment_received_at: new Date().toISOString(),
        status: statuses[index % statuses.length],
        created_by: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });
  db.commission_events = [];
  db.configuration = [
    {
      id: 1,
      config: {} as Db["configuration"][number]["config"],
    },
  ];
  finalize(db);

  return db;
};
