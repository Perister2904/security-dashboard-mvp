import "./globals.css";
import { ReactNode } from "react";
import { ThemeProvider } from "next-themes";

export const metadata = {
  title: "AI Security Dashboard (Executive)",
  description: "Executive-friendly cybersecurity dashboard MVP",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 text-gray-900 dark:text-gray-100 min-h-screen">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  );
}
