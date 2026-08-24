import { RecordContextProvider, useListContext, useTranslate } from "ra-core";

import type { Company } from "../types";
import { CompanyCard } from "./CompanyCard";

const times = (nbChildren: number, fn: (key: number) => any) =>
  Array.from({ length: nbChildren }, (_, key) => fn(key));

const LoadingGridList = () => (
  <div className="grid w-full grid-cols-2 gap-2 md:[grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
    {times(15, (key) => (
      <div
        className="h-[168px] animate-pulse rounded-xl bg-muted md:h-[200px]"
        key={key}
      />
    ))}
  </div>
);

const LoadedGridList = () => {
  const { data, error, isPending } = useListContext<Company>();
  const translate = useTranslate();

  if (isPending || error) return null;

  return (
    <div className="grid w-full grid-cols-2 gap-2 md:[grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
      {data.map((record) => (
        <RecordContextProvider key={record.id} value={record}>
          <CompanyCard />
        </RecordContextProvider>
      ))}

      {data.length === 0 && (
        <div className="p-2">
          {translate("resources.companies.empty.title", {
            _: "No companies found",
          })}
        </div>
      )}
    </div>
  );
};

export const ImageList = () => {
  const { isPending } = useListContext();
  return isPending ? <LoadingGridList /> : <LoadedGridList />;
};
