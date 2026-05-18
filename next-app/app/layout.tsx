import type { Metadata } from "next";
import { Inter } from "next/font/google";
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

// Pre-hydration script: applies the user's saved theme (or the OS preference)
// to <html> BEFORE React paints, so there's no light/dark flash on first load.
// Kept tiny and inline because it must run synchronously in <head>.
const noFlashScript = `
(function() {
  try {
    var saved = localStorage.getItem('theme');
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = saved || (prefersDark ? 'dark' : 'light');
    if (theme === 'dark') document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = theme;
  } catch (_) {}
})();
`.trim();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans transition-colors">
        {children}
      </body>
    </html>
  );
}
