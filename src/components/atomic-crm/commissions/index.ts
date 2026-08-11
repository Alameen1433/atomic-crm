import { BadgeIndianRupee } from "lucide-react";

import type { Commission } from "../types";
import { CommissionList } from "./CommissionList";

export default {
  list: CommissionList,
  icon: BadgeIndianRupee,
  recordRepresentation: (record: Commission) => `Commission #${record.id}`,
};
