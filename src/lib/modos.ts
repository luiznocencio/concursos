import type { ConfigSessao } from "@/estudo/tipos";

export function nomeDaSessao(config: ConfigSessao): string {
  switch (config.tipo) {
    case "estudar_agora":
      return "Estudar agora";
    case "topico":
      return config.canonicos.length === 1 ? "Treino de tópico" : `Treino de ${config.canonicos.length} tópicos`;
    case "revisao":
      return "Revisão de erros";
    case "completo":
      return "Simulado completo";
  }
}

export function rotaDaSessao(id: string, config: ConfigSessao): string {
  return config.tipo === "completo" ? `/simulado/${id}` : `/sessao/${id}`;
}
