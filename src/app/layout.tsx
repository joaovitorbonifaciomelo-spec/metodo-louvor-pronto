import type { Metadata } from "next";
import "./globals.css";
import { product } from "@/lib/config/product";
import { ToastProvider } from "@/components/ui/toast-provider";
import { MetaPixel } from "@/components/analytics/meta-pixel";

export const metadata: Metadata = {
  title: `${product.name} — ${product.tagline}`,
  description:
    "Descubra quais louvores combinam e monte o repertório do próximo culto em minutos.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="min-h-screen bg-base-950 font-sans antialiased">
        <MetaPixel />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
