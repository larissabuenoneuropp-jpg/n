import type { Metadata, Viewport } from "next";
import { DM_Sans, Outfit } from "next/font/google";
import "./globals.css";

const body = DM_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
// Fallback para os títulos enquanto/caso a Neulis não esteja disponível
const displayFallback = Outfit({ subsets: ["latin"], variable: "--font-display-fallback", display: "swap" });

/**
 * Neulis é uma fonte comercial (não está no Google Fonts), então não é distribuída com o app.
 * Duas formas de ativá-la — veja o README:
 *  1. NEXT_PUBLIC_ADOBE_FONTS_KIT=<id do kit>  → carrega o kit do Adobe Fonts
 *  2. NEXT_PUBLIC_NEULIS_SELF_HOSTED=1 + arquivos em public/fonts/ → @font-face local
 * Se já estiver instalada no computador, o navegador também a usa automaticamente.
 */
const ADOBE_KIT = process.env.NEXT_PUBLIC_ADOBE_FONTS_KIT;
const SELF_HOSTED = process.env.NEXT_PUBLIC_NEULIS_SELF_HOSTED === "1";

const selfHostedCss = `
@font-face { font-family: "Neulis"; src: local("Neulis"), url("/fonts/Neulis-Regular.woff2") format("woff2"); font-weight: 400; font-display: swap; }
@font-face { font-family: "Neulis"; src: local("Neulis Medium"), url("/fonts/Neulis-Medium.woff2") format("woff2"); font-weight: 500; font-display: swap; }
@font-face { font-family: "Neulis"; src: local("Neulis SemiBold"), url("/fonts/Neulis-SemiBold.woff2") format("woff2"); font-weight: 600; font-display: swap; }
`;

export const metadata: Metadata = {
  title: { default: "NeuroPlanner", template: "%s · NeuroPlanner" },
  description: "Gestão clínica, planejamento terapêutico com IA e financeiro para Neuropsicopedagogas.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#faf7f3", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${body.variable} ${displayFallback.variable}`}>
      <head>
        {ADOBE_KIT && <link rel="stylesheet" href={`https://use.typekit.net/${ADOBE_KIT}.css`} />}
        {SELF_HOSTED && <style dangerouslySetInnerHTML={{ __html: selfHostedCss }} />}
      </head>
      <body>{children}</body>
    </html>
  );
}
