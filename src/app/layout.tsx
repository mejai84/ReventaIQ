import type { Metadata } from "next";

import "./globals.css";
import { MobileNavigation } from "../components/mobile-navigation";

export const metadata: Metadata = {
  title: "ReventaIQ",
  description: "Mesa de inteligencia financiera para compra y reventa de iPhone.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body><MobileNavigation>{children}</MobileNavigation></body>
    </html>
  );
}
