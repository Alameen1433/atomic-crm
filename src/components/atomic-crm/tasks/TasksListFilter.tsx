import {
  ListContextProvider,
  ResourceContextProvider,
  useList,
  useTranslate,
} from "ra-core";

import { TasksIterator } from "./TasksIterator";

type TaskListProps = {
  tasks: any[];
  title: string;
  showContact?: boolean;
  isMobile: boolean;
};

export const TaskListFilter = ({
  tasks,
  title,
  showContact,
  isMobile,
}: TaskListProps) => {
  const translate = useTranslate();
  const listContext = useList({
    data: tasks,
    resource: "tasks",
    perPage: isMobile ? 10 : 5,
  });

  const { total } = listContext;

  if (!tasks?.length || !total) return null;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="mb-1 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <ResourceContextProvider value="tasks">
        <ListContextProvider value={listContext}>
          <TasksIterator showContact={showContact} />
        </ListContextProvider>
      </ResourceContextProvider>
      {total > listContext.perPage && (
        <div className="flex justify-center">
          <a
            href="#"
            onClick={(e) => {
              listContext.setPerPage(listContext.perPage + 10);
              e.preventDefault();
            }}
            className="inline-flex min-h-11 items-center px-4 text-sm font-medium underline underline-offset-4 hover:no-underline"
          >
            {translate("crm.common.load_more")}
          </a>
        </div>
      )}
    </div>
  );
};
