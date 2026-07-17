import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ChevronRight, PlaySquare, Layers, Home, Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { InstallBanner } from "@/components/install-banner";
import { OfflineBanner } from "@/components/offline-banner";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface LayoutProps {
  children: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}

function TelegramIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "/",       label: "Home",   Icon: Home   },
  { href: "/my-mix", label: "My Mix", Icon: Layers },
];

function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border/50 bg-background" style={{ transform: "translateZ(0)", willChange: "transform" }}>
      <div className="flex items-stretch h-16">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = href === "/" ? location === "/" : location.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className={`flex items-center justify-center w-6 h-6 rounded-lg transition-colors ${active ? "bg-primary/15" : ""}`}>
                <Icon className="w-4 h-4" />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Layout({ children, breadcrumbs }: LayoutProps) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary selection:text-primary-foreground overflow-x-hidden">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/98 will-change-transform" style={{ transform: "translateZ(0)" }}>
        <div className="container mx-auto px-4 h-14 sm:h-16 flex items-center gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80 active:opacity-60">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <PlaySquare className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            </div>
            <span className="font-bold text-lg sm:text-xl tracking-tight">
              PW<span className="text-primary">X</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden sm:flex ml-4 items-center gap-1">
            {NAV_ITEMS.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {isDark
                ? <Sun className="w-4 h-4" />
                : <Moon className="w-4 h-4" />}
            </button>

            {/* Telegram */}
            <a
              href="https://t.me/pwxonrender"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-[#29a7e0] hover:bg-[#29a7e0]/10 transition-colors"
              title="Join our Telegram"
            >
              <TelegramIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Telegram</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content — extra bottom padding on mobile for bottom nav */}
      <main className="flex-1 container mx-auto px-4 py-5 sm:py-8 pb-24 sm:pb-8">
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

      {/* Mobile bottom navigation */}
      <BottomNav />

      {/* Offline / back-online banner */}
      <OfflineBanner />

      {/* PWA install prompt — hidden when already installed */}
      <InstallBanner />
    </div>
  );
}
