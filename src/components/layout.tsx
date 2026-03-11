import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { IS_AERO } from "@/lib/variant";
import { Titlebar } from "@/components/titlebar";
import { Sidebar } from "@/components/sidebar";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className={cn("flex h-screen flex-col", IS_AERO ? "bg-transparent" : "bg-background")}>
      <Titlebar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className={cn("flex-1 overflow-hidden", IS_AERO && "bg-background")}>
          {children}
        </main>
      </div>
    </div>
  );
}
