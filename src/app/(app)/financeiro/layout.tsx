import { FinanceNav } from "@/components/finance/kit";

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FinanceNav />
      {children}
    </>
  );
}
