import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Devfolio — GitHub Portfolio Intelligence",
  description: "A live GitHub portfolio dashboard with contribution, repository, and role-fit insights.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
