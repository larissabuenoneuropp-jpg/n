import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/ui";
import { DataProvider } from "@/lib/data/provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      <ToastProvider>
        <AppShell>{children}</AppShell>
      </ToastProvider>
    </DataProvider>
  );
}
