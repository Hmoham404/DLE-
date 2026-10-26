import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
    title: "MYC Smart Factory — Production & Meeting",
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
