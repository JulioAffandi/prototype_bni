import type { Metadata, Viewport } from "next";
import localFont from "next/font/google";
import "./globals.css";

const inter = localFont({
  src: [
    { path: "../public/fonts/Inter-Regular.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/Inter-Medium.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/Inter-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../public/fonts/Inter-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-inter",
  fallback: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "VALO Education",
    template: "%s | VALO Education",
  },
  description:
    "Closed-Loop Institutional Banking Ecosystem — kontrol pagu jajan, pembayaran SPP otomatis, dan manajemen keuangan sekolah dalam satu platform.",
  applicationName: "VALO Education",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VALO Education",
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: "VALO Education",
    title: "VALO Education Ecosystem",
    description: "Closed-Loop Institutional Banking for Schools",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d9488",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${inter.variable} font-sans antialiased min-h-screen bg-background text-foreground`}>
        {children}
      </body>
    </html>
  );
}
