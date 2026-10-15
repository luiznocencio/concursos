// Classes dos componentes do DESIGN.md. Raio: cartões 12px (rounded-xl), botões e campos 8px
// (rounded-lg), etiquetas em pílula (rounded-full). Um só botão azul cheio por tela.

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-[background-color,transform] duration-200 active:translate-y-px disabled:pointer-events-none disabled:opacity-50";

export const botao = {
  primario: `${base} bg-azul text-white hover:bg-azul-escuro`,
  secundario: `${base} bg-azul-claro text-azul hover:bg-[#d6ebfd]`,
  texto: `${base} text-black/90 hover:bg-black/5`,
  contorno: `${base} border border-borda-forte bg-white text-black/90 hover:bg-black/[0.03]`,
};

// min-w-0: dentro de grid ou flex, o cartão encolhe com a tela em vez de crescer até caber o texto truncado.
export const cartao = "min-w-0 rounded-xl border border-borda bg-white p-6";

export const pilula = {
  azul: "inline-flex items-center gap-1 rounded-full bg-azul-claro px-3 py-1 text-xs font-medium text-azul",
  neutra: "inline-flex items-center gap-1 rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-black/70",
  alerta: "inline-flex items-center gap-1 rounded-full bg-marigold-claro px-3 py-1 text-xs font-medium text-[#8a5a00]",
  erro: "inline-flex items-center gap-1 rounded-full bg-vermelho-claro px-3 py-1 text-xs font-medium text-vermelho",
};

export const titulo = {
  pagina: "text-[32px] font-semibold leading-tight tracking-[-0.03em] md:text-[40px]",
  secao: "text-[22px] font-bold leading-[1.27] tracking-[-0.011em]",
};

export const textoApoio = "text-[15px] leading-relaxed text-grafite";
