export interface Dispositivo {
  referencia: string;
  texto: string;
}

// "Art. 1º", "Art. 12.", "Art. 31-A" no início de uma linha abrem um novo artigo.
const INICIO_ARTIGO = /^\s*Art\.?\s*(\d+)\s*[º°o]?\s*(-\s*[A-Z])?/i;

export function dividirEmArtigos(texto: string): Dispositivo[] {
  const artigos: Dispositivo[] = [];
  let atual: { referencia: string; linhas: string[] } | null = null;
  for (const linha of texto.split(/\r?\n/)) {
    const m = linha.match(INICIO_ARTIGO);
    if (m) {
      if (atual) artigos.push({ referencia: atual.referencia, texto: atual.linhas.join("\n").trim() });
      const sufixo = m[2] ? `-${m[2].replace(/[\s-]/g, "").toUpperCase()}` : "";
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
