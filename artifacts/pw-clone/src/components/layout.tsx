import { ReactNode } from "react";
import { Link } from "wouter";
import { ChevronRight, PlaySquare } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface LayoutProps {
  children: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}

export function Layout({ children, breadcrumbs }: LayoutProps) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary selection:text-primary-foreground">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 group transition-opacity hover:opacity-80 active:opacity-60">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <PlaySquare className="w-5 h-5 fill-current" />
            </div>
            <span className="font-bold text-xl tracking-tight">
              PW<span className="text-primary">X</span>
            </span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8 overflow-x-auto whitespace-nowrap pb-2">
            {breadcrumbs.map((item, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <div key={item.label} className="flex items-center gap-2">
                  {item.href && !isLast ? (
                    <Link href={item.href} className="hover:text-foreground transition-colors duration-150">
                      {item.label}
                    </Link>
                  ) : (
                    <span className={isLast ? "text-foreground font-medium" : ""}>
                      {item.label}
                    </span>
                  )}
                  {!isLast && <ChevronRight className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />}
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
