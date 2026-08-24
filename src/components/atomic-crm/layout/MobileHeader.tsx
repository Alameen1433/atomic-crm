const MobileHeader = ({ children }: { children: React.ReactNode }) => {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-[calc(3.75rem+env(safe-area-inset-top))] w-full items-center justify-between gap-2 border-b border-border/60 bg-background/95 px-3 pt-[env(safe-area-inset-top)] shadow-xs backdrop-blur-lg sm:px-4">
      {children}
    </header>
  );
};

export default MobileHeader;
