import { useQueryClient } from "@tanstack/react-query";
import { MoreVertical } from "lucide-react";
import {
  useDeleteWithUndoController,
  useGetRecordRepresentation,
  useNotify,
  useTranslate,
  useUpdate,
} from "ra-core";
import { useEffect, useState } from "react";
import { ReferenceField } from "@/components/admin/reference-field";
import { DateField } from "@/components/admin/date-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Contact, Task as TData } from "../types";
import { TaskEdit } from "./TaskEdit";
import { TaskEditSheet } from "./TaskEditSheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export const Task = ({
  task,
  showContact,
}: {
  task: TData;
  showContact?: boolean;
}) => {
  const isMobile = useIsMobile();
  const { taskTypes } = useConfigurationContext();
  const notify = useNotify();
  const translate = useTranslate();
  const queryClient = useQueryClient();
  const getContactRepresentation = useGetRecordRepresentation("contacts");

  const [openEdit, setOpenEdit] = useState(false);

  const handleCloseEdit = () => {
    setOpenEdit(false);
  };

  const [update, { isPending: isUpdatePending, isSuccess, variables }] =
    useUpdate();
  const { handleDelete } = useDeleteWithUndoController({
    record: task,
    redirect: false,
    mutationOptions: {
      onSuccess() {
        notify("resources.tasks.deleted", {
          undoable: true,
        });
      },
    },
  });

  const handleEdit = () => {
    setOpenEdit(true);
  };

  const handleCheck = () => () => {
    update("tasks", {
      id: task.id,
      data: {
        done_date: task.done_date ? null : new Date().toISOString(),
      },
      previousData: task,
    });
  };

  useEffect(() => {
    // We do not want to invalidate the query when a tack is checked or unchecked
    if (
      isUpdatePending ||
      !isSuccess ||
      variables?.data?.done_date != undefined
    ) {
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["tasks", "getList"] });
  }, [queryClient, isUpdatePending, isSuccess, variables]);

  const labelId = `checkbox-list-label-${task.id}`;

  return (
    <>
      <div
        className={cn(
          "flex items-start justify-between gap-1",
          isMobile
            ? "min-h-16 rounded-xl border bg-card p-2.5 shadow-xs"
            : "min-h-0 rounded-none border-0 bg-transparent p-0 shadow-none",
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-1">
          <label
            htmlFor={labelId}
            className="flex size-11 shrink-0 cursor-pointer items-start justify-center pt-2"
          >
            <Checkbox
              id={labelId}
              checked={!!task.done_date}
              onCheckedChange={handleCheck()}
              disabled={isUpdatePending}
              className="size-5"
            />
          </label>
          <div className={`flex-grow ${task.done_date ? "line-through" : ""}`}>
            <div
              className={cn(
                "leading-snug",
                isMobile ? "text-[0.95rem]" : "text-sm",
              )}
            >
              {task.type && task.type !== "none" && (
                <>
                  <span className="font-semibold">
                    {(() => {
                      const matchedTaskType = taskTypes.find(
                        (taskType) => taskType.value === task.type,
                      );
                      return matchedTaskType
                        ? matchedTaskType.label
                        : task.type;
                    })()}
                  </span>
                  &nbsp;
                </>
              )}
              {task.text}
            </div>
            <div className="mt-1 text-sm leading-snug text-muted-foreground">
              {translate("resources.tasks.fields.due_short")}
              &nbsp;
              <DateField source="due_date" record={task} showDate showTime />
              {showContact && (
                <ReferenceField<TData, Contact>
                  source="contact_id"
                  reference="contacts"
                  record={task}
                  link="show"
                  className="inline text-sm text-muted-foreground"
                  render={({ referenceRecord }) => {
                    if (!referenceRecord) return null;
                    return (
                      <>
                        {" "}
                        {translate("resources.tasks.regarding_contact", {
                          name: getContactRepresentation(referenceRecord),
                        })}
                      </>
                    );
                  }}
                />
              )}
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 cursor-pointer rounded-xl"
              aria-label={translate("resources.tasks.actions.title")}
            >
              <MoreVertical
                className={isMobile ? "size-5" : "size-4"}
                aria-hidden="true"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className={cn(
                "cursor-pointer",
                isMobile ? "h-12 px-4 text-base" : "h-8 px-2 text-sm",
              )}
              onClick={() => {
                update("tasks", {
                  id: task.id,
                  data: {
                    due_date: new Date(Date.now() + 24 * 60 * 60 * 1000)
                      .toISOString()
                      .slice(0, 10),
                  },
                  previousData: task,
                });
              }}
            >
              {translate("resources.tasks.actions.postpone_tomorrow")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className={cn(
                "cursor-pointer",
                isMobile ? "h-12 px-4 text-base" : "h-8 px-2 text-sm",
              )}
              onClick={() => {
                update("tasks", {
                  id: task.id,
                  data: {
                    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                      .toISOString()
                      .slice(0, 10),
                  },
                  previousData: task,
                });
              }}
            >
              {translate("resources.tasks.actions.postpone_next_week")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className={cn(
                "cursor-pointer",
                isMobile ? "h-12 px-4 text-base" : "h-8 px-2 text-sm",
              )}
              onClick={handleEdit}
            >
              {translate("ra.action.edit")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className={cn(
                "cursor-pointer",
                isMobile ? "h-12 px-4 text-base" : "h-8 px-2 text-sm",
              )}
              onClick={handleDelete}
            >
              {translate("ra.action.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isMobile ? (
        <TaskEditSheet
          taskId={task.id}
          open={openEdit}
          onOpenChange={setOpenEdit}
        />
      ) : (
        <TaskEdit taskId={task.id} open={openEdit} close={handleCloseEdit} />
      )}
    </>
  );
};
