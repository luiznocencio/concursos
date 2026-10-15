import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cookieDoTema, lerTema } from "./tema";

describe("lerTema", () => {
  it("aceita os três temas", () => {
    expect(lerTema("claro")).toBe("claro");
    expect(lerTema("escuro")).toBe("escuro");
    expect(lerTema("sistema")).toBe("sistema");
  });

  it("cai em sistema para ausente ou inválido", () => {
    expect(lerTema(undefined)).toBe("sistema");
    expect(lerTema(null)).toBe("sistema");
    expect(lerTema("roxo")).toBe("sistema");
  });
});

describe("cookieDoTema", () => {
  it("vale para o site todo por um ano", () => {
    expect(cookieDoTema("escuro")).toBe("tema=escuro; path=/; max-age=31536000; samesite=lax");
  });
});

describe("globals.css", () => {
  const css = readFileSync(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8");
  const declaracoes = (bloco: string) => [...bloco.matchAll(/(--t-[\w-]+):\s*([^;]+);/g)].map((m) => `${m[1]}=${m[2]}`);
  const escuro = css.slice(css.indexOf("/* tema-escuro:inicio */"), css.indexOf("/* tema-escuro:fim */"));
  const [explicito, sistema] = escuro.split("@media (prefers-color-scheme: dark)");
  const claro = css.slice(css.indexOf(":root {"), css.indexOf(':root[data-tema="claro"]'));

  it("repete os mesmos tokens escuros na escolha explícita e no modo sistema", () => {
    expect(declaracoes(explicito).length).toBeGreaterThan(0);
    expect(declaracoes(sistema)).toEqual(declaracoes(explicito));
  });

  it("define no escuro todos os tokens do claro", () => {
    const nomes = (lista: string[]) => lista.map((d) => d.split("=")[0]).sort();
    expect(nomes(declaracoes(explicito))).toEqual(nomes(declaracoes(claro)));
  });
});
