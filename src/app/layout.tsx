import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Levantamiento de Urbanismos · Inmobiliaria Nacional",
  description:
    "Encuesta de voceros para el levantamiento de urbanismos de Inmobiliaria Nacional S.A., República Bolivariana de Venezuela.",
  icons: { icon: "/favicon.ico" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0F3470",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-VE">
      <body className="antialiased">{children}</body>
    </html>
  );
}
