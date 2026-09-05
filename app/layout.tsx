import type { ReactNode } from "react";

export const metadata = {
  title: "Bank of Sajo - GTA7 Lab",
  description: "O banco da cidade GTA7 Lab",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          padding: "2rem 1.25rem",
          fontFamily: "system-ui, sans-serif",
          background: "#0b1220",
          color: "#e6edf7",
        }}
      >
        <main style={{ maxWidth: 900, margin: "0 auto" }}>{children}</main>
      </body>
    </html>
  );
}
