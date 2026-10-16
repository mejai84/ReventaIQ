import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "ReventaIQ",
  description: "Mesa de inteligencia financiera para compra y reventa de iPhone.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
