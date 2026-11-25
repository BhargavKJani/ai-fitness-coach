import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import "./globals.css";
import { AccountProvider } from "@/components/AccountProvider";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "PulseForm — AI Fitness Coach", template: "%s · PulseForm" },
  description:
    "AI fitness coach that counts your reps and fixes your form in real time with your webcam. Squats, push-ups and curls, streaks, history and AI weekly plans.",
};

export const viewport: Viewport = { themeColor: "#030712" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <AccountProvider>
          <Nav />
          <main className="flex-1">{children}</main>
          <Footer />
        </AccountProvider>
      </body>
    </html>
  );
}
