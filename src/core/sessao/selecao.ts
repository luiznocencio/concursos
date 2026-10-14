export interface ItemCandidato {
  id: string;
  textoBaseId: string | null;
  canonicos: string[];
  visto: boolean;
}

export function escolherDoTopico(
  canonico: string,
  itens: ItemCandidato[],
  usados: Set<string>,
  limite: number,
): string[] {
  const doTopico = itens.filter((i) => !usados.has(i.id) && i.canonicos.includes(canonico));
  const ordenados = [...doTopico.filter((i) => !i.visto), ...doTopico.filter((i) => i.visto)];
  return ordenados.slice(0, limite).map((i) => i.id);
}

export function agruparPorTextoBase(ids: string[], itens: ItemCandidato[]): string[] {
  const indice = new Map(itens.map((i) => [i.id, i]));
  const grupos = new Map<string, string[]>();
  for (const id of ids) {
    const chave = indice.get(id)?.textoBaseId ?? `__solo:${id}`;
    const grupo = grupos.get(chave) ?? [];
    grupo.push(id);
    grupos.set(chave, grupo);
  }
  return [...grupos.values()].flat();
}
