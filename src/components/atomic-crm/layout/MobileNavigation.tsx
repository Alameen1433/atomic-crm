import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  BriefcaseBusiness,
  Building2,
  CheckSquare2,
  Home,
  IndianRupee,
  Menu,
  NotebookPen,
  Plus,
  Settings,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";
import { CanAccess, useTranslate } from "ra-core";
import { Link, matchPath, useLocation, useMatch } from "react-router";
import { useState } from "react";

import { ContactCreateSheet } from "../contacts/ContactCreateSheet";
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
  } else if (matchPath("/sales/*", location.pathname)) {
    currentPath = "/sales";
  } else {
    currentPath = false;
  }

  return (
    <nav
      aria-label={translate("crm.navigation.label")}
      className="fixed inset-x-0 bottom-0 z-50 h-[calc(4.5rem+env(safe-area-inset-bottom))] border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgb(0_0_0/0.06)] backdrop-blur-lg dark:bg-background/90"
    >
      <div className="grid h-18 w-full grid-cols-5 items-stretch px-1.5">
        <NavigationButton
          href="/"
          Icon={Home}
          label="Home"
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
        <CreateButton />
        <NavigationButton
          href="/deals"
          Icon={BriefcaseBusiness}
          label={translate("resources.deals.name", { smart_count: 2 })}
          isActive={currentPath === "/deals"}
        />
        <MoreButton currentPath={currentPath} />
      </div>
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
      "relative h-full min-w-0 flex-col gap-1 rounded-xl px-1 py-2 text-muted-foreground active:bg-accent",
      isActive && "text-foreground",
    )}
  >
    <Link to={href} aria-current={isActive ? "page" : undefined}>
      <span
        className={cn(
          "absolute top-1.5 h-0.5 w-5 rounded-full bg-transparent",
          isActive && "bg-primary",
        )}
        aria-hidden="true"
      />
      <Icon className="size-5.5" aria-hidden="true" />
      <span className="w-full truncate text-center text-[10px] font-semibold leading-none">
        {label}
      </span>
    </Link>
  </Button>
);

const CreateButton = () => {
  const translate = useTranslate();
  const contact_id = useMatch("/contacts/:id/*")?.params.id;
  const [createOpen, setCreateOpen] = useState(false);
  const [contactCreateOpen, setContactCreateOpen] = useState(false);
  const [noteCreateOpen, setNoteCreateOpen] = useState(false);
  const [taskCreateOpen, setTaskCreateOpen] = useState(false);

  const openAfterClosingCreate = (openTarget: () => void) => {
    setCreateOpen(false);
    window.setTimeout(openTarget, 120);
  };

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
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            className="h-full min-w-0 flex-col gap-1 rounded-xl px-1 py-1 text-foreground active:bg-accent"
            aria-label={translate("ra.action.create")}
          >
            <span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Plus className="size-6" aria-hidden="true" />
            </span>
            <span className="text-[10px] font-semibold leading-none">
              {translate("ra.action.create")}
            </span>
          </Button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="text-left">
            <SheetTitle>{translate("ra.action.create")}</SheetTitle>
            <SheetDescription>
              Add a record without leaving your current workflow.
            </SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <CreateLink
              to="/companies/create"
              label={translate("resources.companies.forcedCaseName", {
                _: "Company",
              })}
              Icon={Building2}
              onNavigate={() => setCreateOpen(false)}
            />
            <CreateLink
              to="/deals/create"
              label={translate("resources.deals.name", {
                smart_count: 1,
                _: "Deal",
              })}
              Icon={BriefcaseBusiness}
              onNavigate={() => setCreateOpen(false)}
            />
            <CreateAction
              label={translate("resources.contacts.forcedCaseName", {
                _: "Contact",
              })}
              Icon={UserPlus}
              onSelect={() =>
                openAfterClosingCreate(() => setContactCreateOpen(true))
              }
            />
            <CreateAction
              label={translate("resources.tasks.forcedCaseName", {
                _: "Task",
              })}
              Icon={CheckSquare2}
              onSelect={() =>
                openAfterClosingCreate(() => setTaskCreateOpen(true))
              }
            />
            <CreateAction
              label={translate("resources.notes.forcedCaseName", {
                _: "Note",
              })}
              Icon={NotebookPen}
              className="col-span-2"
              onSelect={() =>
                openAfterClosingCreate(() => setNoteCreateOpen(true))
              }
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

const CreateLink = ({
  to,
  label,
  Icon,
  onNavigate,
}: {
  to: string;
  label: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  onNavigate: () => void;
}) => (
  <Button
    asChild
    variant="outline"
    className="h-16 justify-start rounded-xl px-4 text-base"
  >
    <Link to={to} onClick={onNavigate}>
      <Icon className="size-5" aria-hidden="true" />
      {label}
    </Link>
  </Button>
);

const CreateAction = ({
  label,
  Icon,
  onSelect,
  className,
}: {
  label: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  onSelect: () => void;
  className?: string;
}) => (
  <Button
    type="button"
    variant="outline"
    className={cn("h-16 justify-start rounded-xl px-4 text-base", className)}
    onClick={onSelect}
  >
    <Icon className="size-5" aria-hidden="true" />
    {label}
  </Button>
);

const MoreButton = ({ currentPath }: { currentPath: string | boolean }) => {
  const translate = useTranslate();
  const isActive = [
    "/companies",
    "/commissions",
    "/tasks",
    "/settings",
    "/sales",
  ].includes(String(currentPath));

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "relative h-full min-w-0 flex-col gap-1 rounded-xl px-1 py-2 text-muted-foreground active:bg-accent",
            isActive && "text-foreground",
          )}
          aria-label="More navigation"
        >
          <span
            className={cn(
              "absolute top-1.5 h-0.5 w-5 rounded-full bg-transparent",
              isActive && "bg-primary",
            )}
            aria-hidden="true"
          />
          <Menu className="size-5.5" aria-hidden="true" />
          <span className="text-[10px] font-semibold leading-none">More</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl px-3 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="text-left">
          <SheetTitle>More</SheetTitle>
          <SheetDescription>Open another part of the CRM.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-1 pt-1">
          <MoreLink
            to="/companies"
            label={translate("resources.companies.name", { smart_count: 2 })}
            Icon={Building2}
            isActive={currentPath === "/companies"}
          />
          <MoreLink
            to="/tasks"
            label={translate("resources.tasks.name", { smart_count: 2 })}
            Icon={CheckSquare2}
            isActive={currentPath === "/tasks"}
          />
          <MoreLink
            to="/commissions"
            label="Commissions"
            Icon={IndianRupee}
            isActive={currentPath === "/commissions"}
          />
          <CanAccess resource="sales" action="list">
            <MoreLink
              to="/sales"
              label={translate("resources.sales.name", { smart_count: 2 })}
              Icon={UserCog}
              isActive={currentPath === "/sales"}
            />
          </CanAccess>
          <MoreLink
            to="/settings"
            label={translate("crm.settings.title")}
            Icon={Settings}
            isActive={currentPath === "/settings"}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};

const MoreLink = ({
  to,
  label,
  Icon,
  isActive,
}: {
  to: string;
  label: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  isActive: boolean;
}) => (
  <SheetClose asChild>
    <Link
      to={to}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-medium transition-colors active:bg-accent",
        isActive && "bg-accent",
      )}
    >
      <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
      <span className="flex-1">{label}</span>
      {isActive ? (
        <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
      ) : null}
    </Link>
  </SheetClose>
);
