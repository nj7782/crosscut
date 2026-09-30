import type { Metadata } from "next";
import { DM_Sans, Outfit, Space_Mono } from "next/font/google";
import ErrorBoundary from "@/components/ErrorBoundary";
import "./globals.css";

const display = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const body = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = Space_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "CrossCut — Play with friends anywhere",
  description:
    "A tiny multiplayer game hub. Snakes & Ladders for up to six, Tic Tac Toe and Dice Duel for two. Share a room code and play.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full`}
    >
      <body className="min-h-full antialiased">
        <div className="atmosphere" aria-hidden="true">
          <span className="aurora aurora-a" />
          <span className="aurora aurora-b" />
          <span className="aurora aurora-c" />
        </div>
        <ErrorBoundary>{children}</ErrorBoundary>
        <p className="made-by-stamp" aria-label="Made by Jitin">
          made by Jitin
        </p>
      </body>
    </html>
  );
}
