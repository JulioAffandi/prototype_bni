import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "EduConnect — BNI Closed-Loop Education Ecosystem",
    template: "%s | EduConnect — BNI Closed-Loop Education Ecosystem",
  },
  description:
    "BNI Closed-Loop Education Ecosystem — kontrol pagu jajan, pembayaran SPP otomatis, dan manajemen keuangan sekolah dalam satu platform terpadu.",
  applicationName: "EduConnect",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "EduConnect",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icon.png" },
      { url: "/img/logo_raw.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/img/logo_raw.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/icon.png"],
  },
  openGraph: {
    type: "website",
    siteName: "EduConnect",
    title: "EduConnect — BNI Closed-Loop Education Ecosystem",
    description: "BNI Closed-Loop Education Ecosystem for Schools & Universities",
    images: [
      {
        url: "/img/logo.png",
        width: 800,
        height: 240,
        alt: "EduConnect Logo",
      },
    ],
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
      <body
        suppressHydrationWarning
        className={`${inter.variable} font-sans antialiased min-h-screen bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
