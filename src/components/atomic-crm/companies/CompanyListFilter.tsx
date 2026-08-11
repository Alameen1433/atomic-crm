import { Building, Truck, Users } from "lucide-react";
import { useGetIdentity, useTranslate } from "ra-core";
import { ToggleFilterButton } from "@/components/admin/toggle-filter-button";
import { useIsMobile } from "@/hooks/use-mobile";

import { FilterCategory } from "../filters/FilterCategory";
import { ResponsiveFilters } from "../misc/ResponsiveFilters";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { getTranslatedCompanySizeLabel } from "./getTranslatedCompanySizeLabel";
import { sizes } from "./sizes";

export const CompanyListFilter = () => {
  const { identity } = useGetIdentity();
  const isMobile = useIsMobile();
  const { companySectors } = useConfigurationContext();
  const translate = useTranslate();
  const translatedSizes = sizes.map((size) => ({
    ...size,
    name: getTranslatedCompanySizeLabel(size, translate),
  }));
  return (
    <ResponsiveFilters>
      <FilterCategory
        icon={<Building className="h-4 w-4" />}
        label="resources.companies.fields.size"
      >
        {translatedSizes.map((size) => (
          <ToggleFilterButton
            className="h-10 w-full justify-between md:h-8"
            label={size.name}
            key={size.name}
            value={{ size: size.id }}
            size={isMobile ? "lg" : undefined}
          />
        ))}
      </FilterCategory>

      <FilterCategory
        icon={<Truck className="h-4 w-4" />}
        label="resources.companies.fields.sector"
      >
        {companySectors.map((sector) => (
          <ToggleFilterButton
            className="h-10 w-full justify-between md:h-8"
            label={sector.label}
            key={sector.value}
            value={{ sector: sector.value }}
            size={isMobile ? "lg" : undefined}
          />
        ))}
      </FilterCategory>

      <FilterCategory
        icon={<Users className="h-4 w-4" />}
        label="resources.companies.fields.sales_id"
      >
        <ToggleFilterButton
          className="h-10 w-full justify-between md:h-8"
          label={translate("crm.common.me")}
          value={{ sales_id: identity?.id }}
          size={isMobile ? "lg" : undefined}
        />
      </FilterCategory>
    </ResponsiveFilters>
  );
};
