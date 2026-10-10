import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/ui";
import { VaultGate } from "@/components/vault-gate";
import { DataProvider } from "@/lib/data/provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <VaultGate>
      <DataProvider>
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </DataProvider>
    </VaultGate>
  );
}
