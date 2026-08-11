import { Archive, ArchiveRestore } from "lucide-react";
import {
  useNotify,
  useRecordContext,
  useRedirect,
  useResourceContext,
  useUpdate,
} from "ra-core";
import { Button } from "@/components/ui/button";

export const ArchiveRecordButton = () => {
  const record = useRecordContext<{
    id: string | number;
    archived_at?: string | null;
  }>();
  const resource = useResourceContext();
  const notify = useNotify();
  const redirect = useRedirect();
  const [update, { isPending }] = useUpdate();
  if (!record) return null;
  const archived = Boolean(record.archived_at);

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() =>
        update(
          resource,
          {
            id: record.id,
            data: { archived_at: archived ? null : new Date().toISOString() },
            previousData: record,
          },
          {
            onSuccess: () => {
              notify(archived ? "Record restored" : "Record archived", {
                type: "success",
              });
              redirect("list", resource);
            },
          },
        )
      }
    >
      {archived ? <ArchiveRestore /> : <Archive />}
      {archived ? "Restore" : "Archive"}
    </Button>
  );
};
