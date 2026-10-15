import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { COOKIE_TEMA, lerTema } from "@/lib/tema";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Concursos",
  description: "Estudo para concursos guiado pelo edital e pela banca",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // data-tema vem do cookie para o HTML já sair no tema certo; "sistema" segue o prefers-color-scheme.
  // suppressHydrationWarning: o seletor de tema muda o atributo no cliente antes da próxima renderização.
  const tema = lerTema((await cookies()).get(COOKIE_TEMA)?.value);
  return (
    <html lang="pt-BR" data-tema={tema} className={inter.variable} suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
