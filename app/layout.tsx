import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mi Dinero — Finanzas personales",
  description: "Control sencillo de tus ingresos, gastos y cuentas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
