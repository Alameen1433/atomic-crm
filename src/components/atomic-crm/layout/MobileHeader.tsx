const MobileHeader = ({ children }: { children: React.ReactNode }) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 flex h-14 w-full items-center justify-between gap-2 bg-secondary px-3 sm:px-4">
      {children}
    </header>
  );
};

export default MobileHeader;
