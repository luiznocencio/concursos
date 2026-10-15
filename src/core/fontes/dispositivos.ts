export interface Dispositivo {
  referencia: string;
  texto: string;
}

// "Art. 1º", "Art. 2º-A", "Art. 12." e "Art. 31-A." no início de uma linha abrem um novo artigo.
// Exige "Art" maiúsculo e ordinal ou ponto depois do número: uma linha que só continua o texto
// com uma remissão ("art. 47, será...") não pode ser lida como início de artigo.
const INICIO_ARTIGO = /^\s*Art\.?\s*(\d+)(?:\s*[º°o](\s*-\s*[A-Z])?|(\s*-\s*[A-Z])?\s*\.)/;

export function dividirEmArtigos(texto: string): Dispositivo[] {
  const artigos: Dispositivo[] = [];
  let atual: { referencia: string; linhas: string[] } | null = null;
  for (const linha of texto.split(/\r?\n/)) {
    const m = linha.match(INICIO_ARTIGO);
    if (m) {
      if (atual) artigos.push({ referencia: atual.referencia, texto: atual.linhas.join("\n").trim() });
      const letra = m[2] ?? m[3];
      const sufixo = letra ? `-${letra.replace(/[\s-]/g, "").toUpperCase()}` : "";
      atual = { referencia: `art. ${Number(m[1])}${sufixo}`, linhas: [linha.trim()] };
    } else if (atual && linha.trim()) {
      atual.linhas.push(linha.trim());
    }
  }
  if (atual) artigos.push({ referencia: atual.referencia, texto: atual.linhas.join("\n").trim() });

  const vistos = new Set<string>();
  return artigos.filter((a) => (vistos.has(a.referencia) ? false : (vistos.add(a.referencia), true)));
}

// Janela circular de artigos consecutivos; a rodada desloca a janela para variar o conteúdo coberto.
export function janelaDeDispositivos(dispositivos: Dispositivo[], rodada: number, tamanho: number): Dispositivo[] {
  if (dispositivos.length <= tamanho) return dispositivos;
  const inicio = (rodada * tamanho) % dispositivos.length;
  return Array.from({ length: tamanho }, (_, i) => dispositivos[(inicio + i) % dispositivos.length]);
}
