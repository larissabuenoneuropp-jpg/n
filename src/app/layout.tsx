import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: { default: "NeuroPlanner", template: "%s · NeuroPlanner" },
  description: "Gestão clínica, planejamento terapêutico com IA e financeiro para Neuropsicopedagogas.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#f7f8fb", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
