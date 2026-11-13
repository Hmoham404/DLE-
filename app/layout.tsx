import type { Metadata } from "next";
import "./globals.css";
import "./industrial.css";
import "./machine-scene.css";
import "./five-s-facility.css";
import "./production-entry.css";
export const metadata: Metadata = {
    title: "MYC — Usine intelligente, production et 5S",
    description: "Le centre de pilotage industriel de MYC Beauty Innovation Tunisia.",
    icons: {
        icon: "/favicon.svg",
        shortcut: "/favicon.svg",
    },
};
export default function RootLayout({ children, }: Readonly<{
    children: React.ReactNode;
}>) {
    return (<html lang="fr">
      <body className="antialiased">{children}</body>
    </html>);
}
