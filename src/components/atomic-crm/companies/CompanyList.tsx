import {
  ListBase,
  useGetIdentity,
  useGetList,
  useListContext,
  useTranslate,
} from "ra-core";
import { CreateButton } from "@/components/admin/create-button";
import { ExportButton } from "@/components/admin/export-button";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { SortButton } from "@/components/admin/sort-button";

import { TopToolbar } from "../layout/TopToolbar";
import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import type { Company } from "../types";
import { CompanyEmpty } from "./CompanyEmpty";
import { CompanyListFilter } from "./CompanyListFilter";
import { ImageList } from "./GridList";

export const CompanyList = () => {
  const { identity } = useGetIdentity();
  if (!identity) return null;
  return (
    <List
      title={false}
      perPage={25}
      sort={{ field: "name", order: "ASC" }}
      actions={<CompanyListActions />}
      filter={{ "archived_at@is": null }}
      pagination={<ListPagination rowsPerPageOptions={[10, 25, 50, 100]} />}
    >
      <CompanyListLayout />
    </List>
  );
};

export const CompanyListMobile = () => {
  const { identity } = useGetIdentity();
  if (!identity) return null;

  return (
    <ListBase
      perPage={25}
      sort={{ field: "name", order: "ASC" }}
      filter={{ "archived_at@is": null }}
    >
      <CompanyListLayoutMobile />
    </ListBase>
  );
};

const CompanyListLayoutMobile = () => {
  const { data, isPending, filterValues } = useListContext<Company>();
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  return (
    <>
      <MobileHeader>
        <CompanyListFilter />
      </MobileHeader>
      <MobileContent>
        {!isPending && !data?.length && !hasFilters ? (
          <CompanyEmpty />
        ) : (
          <div className="flex flex-col gap-4">
            <DuplicateCompanyWarning />
            <ImageList />
            <ListPagination rowsPerPageOptions={[10, 25, 50]} />
          </div>
        )}
      </MobileContent>
    </>
  );
};

const CompanyListLayout = () => {
  const { data, isPending, filterValues } = useListContext();
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (isPending) return null;
  if (!data?.length && !hasFilters) return <CompanyEmpty />;

  return (
    <div className="w-full flex flex-row gap-8">
      <CompanyListFilter />
      <div className="flex flex-col flex-1 gap-4">
        <DuplicateCompanyWarning />
        <ImageList />
      </div>
    </div>
  );
};

const DuplicateCompanyWarning = () => {
  const { identity } = useGetIdentity();
  const isAdmin = Boolean((identity as any)?.administrator);
  const { data = [] } = useGetList<Company>(
    "companies",
    {
      filter: { "archived_at@is": null },
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "name", order: "ASC" },
    },
    { enabled: isAdmin },
  );
  if (!isAdmin) return null;
  const seenNames = new Set<string>();
  const seenWebsites = new Set<string>();
  const duplicates = new Set<string>();
  for (const company of data) {
    const nameKey = company.name.trim().toLocaleLowerCase();
    let websiteKey = "";
    try {
      websiteKey = company.website
        ? new URL(company.website).hostname.replace(/^www\./, "")
        : "";
    } catch {
      websiteKey = company.website?.trim().toLocaleLowerCase() ?? "";
    }
    if (nameKey) {
      if (seenNames.has(nameKey)) duplicates.add(`name:${nameKey}`);
      seenNames.add(nameKey);
    }
    if (websiteKey) {
      if (seenWebsites.has(websiteKey)) duplicates.add(`website:${websiteKey}`);
      seenWebsites.add(websiteKey);
    }
  }
  if (duplicates.size === 0) return null;
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
      {duplicates.size} possible duplicate client{" "}
      {duplicates.size === 1 ? "record" : "groups"} detected by company name or
      website. Review ownership before merging or reassigning deals.
    </div>
  );
};

const CompanyListActions = () => {
  const translate = useTranslate();
  return (
    <TopToolbar>
      <SortButton fields={["name", "created_at", "nb_contacts"]} />
      <ExportButton />
      <CreateButton
        label={translate("resources.companies.action.new", {
          _: "New Company",
        })}
      />
    </TopToolbar>
  );
};
