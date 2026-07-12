import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "БФЛ Аналитик — разбор кредитного отчёта",
  description:
    "Загрузите кредитный отчёт клиента и получите финансовую картину, сравнение сценариев и compliance-риски за секунды",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${manrope.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Тема до гидрации — иначе тёмная тема вспыхивает светлым на каждой загрузке */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('bfl-theme')==='noir')document.documentElement.dataset.theme='noir'}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
