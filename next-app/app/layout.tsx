import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

// Inter is loaded as the cross-platform fallback. On Apple devices the CSS
// stack prefers San Francisco (-apple-system / "SF Pro Text") which is already
// installed on the system — no font file shipped for SF.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Uniform Logistic",
  description: "Sistema de pedidos de uniformes para empresas en Costa Rica",
};

// Read the user's saved theme from the `theme` cookie and apply the
// `dark` class to <html> at SSR time. No client-side script required —
// the markup ships with the right class so there's no flash, and React
// 19 doesn't complain about an inline <script> in the tree.
//
// ThemeToggle writes the cookie (and a localStorage mirror for legacy
// clients). First-time visitors without a cookie default to light;
// they can flip via the toggle and the choice persists for a year.
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("theme")?.value;
  const isDark = themeCookie === "dark";
  return (
    <html
      lang="es"
      className={`${inter.variable} h-full antialiased${isDark ? " dark" : ""}`}
      style={{ colorScheme: isDark ? "dark" : "light" }}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans transition-colors">
        {children}
      </body>
    </html>
  );
}
