import { ReactNode, useState } from "react";
import { Link } from "wouter";
import { ChevronRight, PlaySquare, BookOpen, Layers, Calendar, Menu, X } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface LayoutProps {
  children: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}

export function Layout({ children, breadcrumbs }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary selection:text-primary-foreground">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-14 sm:h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 group transition-opacity hover:opacity-80 active:opacity-60" onClick={() => setMobileMenuOpen(false)}>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <PlaySquare className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            </div>
            <span className="font-bold text-lg sm:text-xl tracking-tight">
              PW<span className="text-primary">X</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex ml-4 items-center gap-1">
            <Link
              href="/materials"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              JEE Materials
            </Link>
            <Link
              href="/my-mix"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Layers className="w-4 h-4" />
              My Mix
            </Link>
            <Link
              href="/schedule"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Calendar className="w-4 h-4" />
              Schedule
            </Link>
          </nav>

          {/* Mobile hamburger */}
          <button
            className="sm:hidden ml-auto p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            onClick={() => setMobileMenuOpen(v => !v)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-border/40 bg-background/95 backdrop-blur px-4 py-3 space-y-1">
            <Link
              href="/materials"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors w-full"
            >
              <BookOpen className="w-4 h-4" />
              JEE Materials
            </Link>
            <Link
              href="/my-mix"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors w-full"
            >
              <Layers className="w-4 h-4" />
              My Mix
            </Link>
            <Link
              href="/schedule"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors w-full"
            >
              <Calendar className="w-4 h-4" />
              Schedule
            </Link>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-5 sm:py-8">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground mb-5 sm:mb-8 overflow-x-auto whitespace-nowrap pb-2">
            {breadcrumbs.map((item, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <div key={item.label} className="flex items-center gap-1.5">
                  {item.href && !isLast ? (
                    <Link href={item.href} className="hover:text-foreground transition-colors duration-150">
                      {item.label}
                    </Link>
                  ) : (
                    <span className={isLast ? "text-foreground font-medium" : ""}>
                      {item.label}
                    </span>
                  )}
                  {!isLast && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />}
                </div>
              );
            })}
          </nav>
        )}

        {children}
      </main>
    </div>
  );
}
