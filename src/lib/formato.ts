const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
const porcento = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });
const dataCurta = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" });
const dataHora = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
});

export function nota(n: number): string {
  return numero.format(n);
}

export function percentual(fracao: number): string {
  return porcento.format(fracao);
}

// Aproveitamento líquido (−1 a 1) mostrado de −100% a 100%.
export function aproveitamento(l: number): string {
  return l > 0 ? `+${porcento.format(l)}` : porcento.format(l);
}

export function data(iso: string | Date): string {
  return dataCurta.format(new Date(iso));
}

export function dataEHora(iso: string | Date): string {
  return dataHora.format(new Date(iso));
}

export function dataDaProva(aaaaMmDd: string): string {
  return new Date(`${aaaaMmDd}T12:00:00-03:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

export function duracao(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const dois = (x: number) => String(x).padStart(2, "0");
  return h > 0 ? `${h}:${dois(m)}:${dois(s)}` : `${dois(m)}:${dois(s)}`;
}

export function plural(n: number, singular: string, pluralForma: string): string {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}
