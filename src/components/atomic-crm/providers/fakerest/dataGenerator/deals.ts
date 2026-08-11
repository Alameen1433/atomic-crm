import { add } from "date-fns";
import { datatype, lorem, random } from "faker/locale/en_US";

import {
  defaultDealCategories,
  defaultDealStages,
} from "../../../root/defaultConfiguration";
import type { Deal } from "../../../types";
import type { Db } from "./types";
import { randomDate } from "./utils";

export const generateDeals = (db: Db): Deal[] => {
  const deals = Array.from(Array(50).keys()).map((id) => {
    const company = random.arrayElement(db.companies);
    company.nb_deals = (company.nb_deals ?? 0) + 1;
    const contacts = random.arrayElements(
      db.contacts.filter((contact) => contact.company_id === company.id),
      datatype.number({ min: 1, max: 3 }),
    );
    const lowercaseName = lorem.words();
    const created_at = randomDate(new Date(company.created_at)).toISOString();

    const expected_closing_date = randomDate(
      new Date(created_at),
      add(new Date(created_at), { months: 6 }),
    )
      .toISOString()
      .split("T")[0];

    return {
      id,
      name: lowercaseName[0].toUpperCase() + lowercaseName.slice(1),
      company_id: company.id,
      contact_ids: contacts.map((contact) => contact.id),
      category: random.arrayElement(defaultDealCategories).value,
      stage: random.arrayElement(defaultDealStages).value,
      description: lorem.paragraphs(datatype.number({ min: 1, max: 4 })),
      amount: datatype.number(1000) * 100,
      created_at,
      updated_at: randomDate(new Date(created_at)).toISOString(),
      expected_closing_date,
      sales_id: company.sales_id!,
      index: 0,
      lead_source: random.arrayElement([
        "referral",
        "linkedin",
        "website",
        "cold-outreach",
        "networking",
      ]),
      client_type: (datatype.boolean() ? "new" : "recurring") as
        | "new"
        | "recurring",
      next_follow_up_at: randomDate(
        new Date(),
        add(new Date(), { days: 30 }),
      ).toISOString(),
      new_commission_rate_snapshot: 20,
      recurring_commission_rate_snapshot: 15,
    };
  });
  // compute index based on stage
  defaultDealStages.forEach((stage) => {
    deals
      .filter((deal) => deal.stage === stage.value)
      .forEach((deal, index) => {
        deals[deal.id].index = index;
      });
  });
  return deals;
};
