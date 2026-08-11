import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  BriefcaseBusiness,
  Building2,
  Home,
  IndianRupee,
  ListTodo,
  Menu,
  Plus,
  Settings,
  Users,
} from "lucide-react";
import { useTranslate } from "ra-core";
import { Link, matchPath, useLocation, useMatch } from "react-router";
import { ContactCreateSheet } from "../contacts/ContactCreateSheet";
import { useState } from "react";
import { NoteCreateSheet } from "../notes/NoteCreateSheet";
import { TaskCreateSheet } from "../tasks/TaskCreateSheet";

export const MobileNavigation = () => {
  const location = useLocation();
  const translate = useTranslate();

  let currentPath: string | boolean = "/";
  if (matchPath("/", location.pathname)) {
    currentPath = "/";
  } else if (matchPath("/contacts/*", location.pathname)) {
    currentPath = "/contacts";
  } else if (matchPath("/companies/*", location.pathname)) {
    currentPath = "/companies";
  } else if (matchPath("/tasks/*", location.pathname)) {
    currentPath = "/tasks";
  } else if (matchPath("/deals/*", location.pathname)) {
    currentPath = "/deals";
  } else if (matchPath("/commissions/*", location.pathname)) {
    currentPath = "/commissions";
  } else if (matchPath("/settings/*", location.pathname)) {
    currentPath = "/settings";
  } else {
    currentPath = false;
  }

  return (
    <nav
      aria-label={translate("crm.navigation.label")}
      className="fixed right-0 bottom-0 left-0 z-50 h-[calc(3.5rem+env(safe-area-inset-bottom))] bg-secondary pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex h-14 w-full items-stretch justify-around px-1">
        <>
          <NavigationButton
            href="/"
            Icon={Home}
            label={translate("ra.page.dashboard")}
            isActive={currentPath === "/"}
          />
          <NavigationButton
            href="/contacts"
            Icon={Users}
            label={translate("resources.contacts.name", {
              smart_count: 2,
            })}
            isActive={currentPath === "/contacts"}
          />
          <NavigationButton
            href="/companies"
            Icon={Building2}
            label={translate("resources.companies.name", {
              smart_count: 2,
            })}
            isActive={currentPath === "/companies"}
          />
          <NavigationButton
            href="/deals"
            Icon={BriefcaseBusiness}
            label={translate("resources.deals.name", { smart_count: 2 })}
            isActive={currentPath === "/deals"}
          />
          <MoreButton currentPath={currentPath} />
        </>
      </div>
      <CreateButton />
    </nav>
  );
};

const NavigationButton = ({
  href,
  Icon,
  label,
  isActive,
}: {
  href: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  isActive: boolean;
}) => (
  <Button
    asChild
    variant="ghost"
    className={cn(
      "h-auto min-w-0 max-w-14 flex-1 flex-col gap-1 rounded-md px-1 py-2",
      isActive ? null : "text-muted-foreground",
    )}
  >
    <Link to={href}>
      <Icon className="size-6" />
      <span className="max-w-full truncate text-[0.6rem] font-medium">
        {label}
      </span>
    </Link>
  </Button>
);

const CreateButton = () => {
  const translate = useTranslate();
  const contact_id = useMatch("/contacts/:id/*")?.params.id;
  const [contactCreateOpen, setContactCreateOpen] = useState(false);
  const [noteCreateOpen, setNoteCreateOpen] = useState(false);
  const [taskCreateOpen, setTaskCreateOpen] = useState(false);

  return (
    <>
      <ContactCreateSheet
        open={contactCreateOpen}
        onOpenChange={setContactCreateOpen}
      />
      <NoteCreateSheet
        open={noteCreateOpen}
        onOpenChange={setNoteCreateOpen}
        contact_id={contact_id}
      />
      <TaskCreateSheet
        open={taskCreateOpen}
        onOpenChange={setTaskCreateOpen}
        contact_id={contact_id}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="default"
            size="icon"
            className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[60] h-14 w-14 rounded-full shadow-lg"
            aria-label={translate("ra.action.create")}
          >
            <Plus className="size-10" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem asChild className="h-12 px-4 text-base">
            <Link to="/companies/create">
              {translate("resources.companies.forcedCaseName", {
                _: "Company",
              })}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="h-12 px-4 text-base">
            <Link to="/deals/create">
              {translate("resources.deals.name", {
                smart_count: 1,
                _: "Deal",
              })}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="h-12 px-4 text-base"
            onSelect={() => {
              setContactCreateOpen(true);
            }}
          >
            {translate("resources.contacts.forcedCaseName", { _: "Contact" })}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="h-12 px-4 text-base"
            onSelect={() => {
              setNoteCreateOpen(true);
            }}
          >
            {translate("resources.notes.forcedCaseName", { _: "Note" })}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="h-12 px-4 text-base"
            onSelect={() => {
              setTaskCreateOpen(true);
            }}
          >
            {translate("resources.tasks.forcedCaseName", { _: "Task" })}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};

const MoreButton = ({ currentPath }: { currentPath: string | boolean }) => {
  const translate = useTranslate();
  const isActive = ["/commissions", "/tasks", "/settings"].includes(
    String(currentPath),
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "h-auto min-w-0 max-w-14 flex-1 flex-col gap-1 rounded-md px-1 py-2",
            isActive ? null : "text-muted-foreground",
          )}
          aria-label={translate("ra.action.show", { _: "More" })}
        >
          <Menu className="size-6" />
          <span className="text-[0.6rem] font-medium">More</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8}>
        <DropdownMenuItem asChild className="h-11 px-4 text-base">
          <Link to="/commissions" className="flex items-center gap-2">
            <IndianRupee className="size-4" /> Commission
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="h-11 px-4 text-base">
          <Link to="/tasks" className="flex items-center gap-2">
            <ListTodo className="size-4" />
            {translate("resources.tasks.name", { smart_count: 2 })}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="h-11 px-4 text-base">
          <Link to="/settings" className="flex items-center gap-2">
            <Settings className="size-4" />
            {translate("crm.settings.title")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
