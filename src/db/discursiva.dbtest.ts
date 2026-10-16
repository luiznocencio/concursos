import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { parseEdital } from "../core/edital/parse";
import { comoUsuario, criarBancoDeTeste } from "./testing/banco";
import { sqlDoEdital } from "./seed/edital-sql";

const ANA = "00000000-0000-0000-0000-00000000000a";
const BRUNO = "00000000-0000-0000-0000-00000000000b";

let client: Client;
let destruir: () => Promise<void>;
let temaAprovado: string;

async function valor<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await client.query(sql, params);
  return Object.values(r.rows[0])[0] as T;
}

const padrao = { aspectos: [{ codigo: "1", descricao: "Tema", pontos: 30 }], expectativas: "x" };

// Cria uma redação direto como administrador (as gravações de comoUsuario são desfeitas no fim).
async function redacao(usuario: string, status = "rascunho", extra = ""): Promise<string> {
  return valor<string>(
    `insert into public.redacoes (usuario_id, tema_id, status, linhas${extra ? ", entregue_em" : ""})
     values ($1, $2, $3, '{"Texto da redação"}'${extra ? `, ${extra}` : ""}) returning id`,
    [usuario, temaAprovado, status],
  );
}

beforeAll(async () => {
  ({ client, destruir } = await criarBancoDeTeste());
  await client.query("insert into auth.users (id, email) values ($1, 'ana@x.com'), ($2, 'bruno@x.com')", [ANA, BRUNO]);
  await client.query(sqlDoEdital(parseEdital(readFileSync("editais/cbmal-2026/edital.yaml", "utf8"))));
  await client.query("set role service_role");
  await valor("select public.discursiva_importar_temas($1)", [
    { concurso: "cbmal-2026", prova_origem: "CBM-AL 2021", temas: [{ enunciado: "Tema real", padrao_resposta: padrao }] },
  ]);
  await client.query("reset role");
  temaAprovado = await valor<string>("select id from public.temas_discursiva where enunciado = 'Tema real'");
  await client.query(
    `insert into public.temas_discursiva (concurso_id, prova_id, origem, status, enunciado, padrao_resposta, hash)
     select concurso_id, prova_id, 'gerado', 'revisao', 'Tema em revisão', padrao_resposta, 'h-revisao'
     from public.temas_discursiva where id = $1`,
    [temaAprovado],
  );
});

afterAll(async () => {
  await destruir();
});

describe("edital", () => {
  it("guarda caracteres_por_linha na configuração da discursiva", async () => {
    const config = await valor<Record<string, number>>(
      "select config_discursiva from public.provas where slug = 'discursiva'",
    );
    expect(config).toEqual({ pontuacao_maxima: 30, linhas_max: 30, nota_minima: 15, caracteres_por_linha: 70 });
  });
});

describe("discursiva_importar_temas", () => {
  it("grava tema real e acusa duplicado pelo enunciado normalizado", async () => {
    await client.query("set role service_role");
    try {
      const r = await valor("select public.discursiva_importar_temas($1)", [
        {
          concurso: "cbmal-2026",
          prova_origem: "CBM-AL 2021",
          temas: [
            { enunciado: "  tema   REAL ", padrao_resposta: padrao },
            { enunciado: "Outro tema", padrao_resposta: padrao },
          ],
        },
      ]);
      expect(r).toEqual({ gravados: 1, duplicados: [0] });
    } finally {
      await client.query("reset role");
    }
  });

  it("exige prova de origem", async () => {
    await expect(
      valor("select public.discursiva_importar_temas($1)", [{ concurso: "cbmal-2026", temas: [] }]),
    ).rejects.toThrow(/prova de origem/);
  });

  it("usuário comum não pode importar", async () => {
    await expect(
      comoUsuario(client, ANA, () =>
        valor("select public.discursiva_importar_temas($1)", [{ concurso: "cbmal-2026", prova_origem: "x", temas: [] }]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("RLS", () => {
  it("usuário só vê temas aprovados", async () => {
    const temas = await comoUsuario(client, ANA, async () =>
      (await client.query("select enunciado from public.temas_discursiva order by enunciado")).rows.map((r) => r.enunciado),
    );
    expect(temas).toEqual(["Outro tema", "Tema real"]);
  });

  it("usuário cria rascunho só com tema aprovado", async () => {
    await comoUsuario(client, ANA, () =>
      client.query("insert into public.redacoes (usuario_id, tema_id) values ($1, $2)", [ANA, temaAprovado]),
    );
    const revisao = await valor<string>("select id from public.temas_discursiva where hash = 'h-revisao'");
    await expect(
      comoUsuario(client, ANA, () =>
        client.query("insert into public.redacoes (usuario_id, tema_id) values ($1, $2)", [ANA, revisao]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("usuário não grava estado nem nota", async () => {
    const id = await redacao(ANA);
    await expect(
      comoUsuario(client, ANA, () => client.query("update public.redacoes set npd = 30 where id = $1", [id])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      comoUsuario(client, ANA, () =>
        client.query("insert into public.redacoes (usuario_id, tema_id, status) values ($1, $2, 'corrigida')", [ANA, temaAprovado]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("dono edita as linhas só enquanto escreve; outro usuário não vê", async () => {
    const id = await redacao(ANA);
    const corrigida = await redacao(ANA, "corrigida");
    const alteradas = await comoUsuario(client, ANA, async () => {
      const a = await client.query("update public.redacoes set linhas = '{\"Novo\"}' where id = $1", [id]);
      const b = await client.query("update public.redacoes set linhas = '{\"Novo\"}' where id = $1", [corrigida]);
      return [a.rowCount, b.rowCount];
    });
    expect(alteradas).toEqual([1, 0]);
    const vistas = await comoUsuario(client, BRUNO, async () =>
      (await client.query("select count(*)::int as n from public.redacoes")).rows[0].n,
    );
    expect(vistas).toBe(0);
  });

  it("correções e erros só para o dono da redação", async () => {
    const id = await redacao(ANA, "corrigida");
    await client.query(
      `insert into public.correcoes_discursiva (redacao_id, papel, provedor, modelo, resposta)
       values ($1, 'lingua', 'anthropic', 'm', '{}')`,
      [id],
    );
    await client.query(
      `insert into public.erros_redacao (redacao_id, usuario_id, linha, trecho, tipo, categoria, correcao, explicacao, canonico)
       values ($1, $2, 1, 'Texto', 'grafia', 'ortografia', 'x', 'y', 'portugues/ortografia')`,
      [id, ANA],
    );
    const contar = (usuario: string) =>
      comoUsuario(client, usuario, async () => {
        const c = await client.query("select count(*)::int as n from public.correcoes_discursiva where redacao_id = $1", [id]);
        const e = await client.query("select count(*)::int as n from public.erros_redacao where redacao_id = $1", [id]);
        return [c.rows[0].n, e.rows[0].n];
      });
    expect(await contar(ANA)).toEqual([1, 1]);
    expect(await contar(BRUNO)).toEqual([0, 0]);
  });

  it("fotos: cada usuário envia só para a própria pasta do bucket", async () => {
    const enviar = (usuario: string, nome: string) =>
      comoUsuario(client, usuario, () =>
        client.query("insert into storage.objects (bucket_id, name) values ('redacoes-fotos', $1)", [nome]),
      );
    await enviar(ANA, `${ANA}/r1/1.jpg`);
    await expect(enviar(ANA, `${BRUNO}/r1/1.jpg`)).rejects.toThrow(/row-level security/);
  });
});

describe("discursiva_entregar", () => {
  it("põe na fila e cria o job de correção", async () => {
    const id = await redacao(BRUNO);
    await comoUsuario(client, BRUNO, async () => {
      await client.query("select public.discursiva_entregar($1)", [id]);
      const r = await client.query("select status, entregue_em is not null as entregue from public.redacoes where id = $1", [id]);
      expect(r.rows[0]).toEqual({ status: "na_fila", entregue: true });
    });
    // comoUsuario desfaz a transação: a verificação do job é feita dentro dela.
  });

  it("enfileira o job com a redação e quem pediu", async () => {
    const id = await redacao(BRUNO);
    const job = await comoUsuario(client, BRUNO, async () => {
      await client.query("select public.discursiva_entregar($1)", [id]);
      await client.query("reset role");
      return (await client.query("select tipo, payload from public.jobs where payload->>'redacao_id' = $1", [id])).rows[0];
    });
    expect(job).toEqual({ tipo: "corrigir_redacao", payload: { redacao_id: id, pedido_por: BRUNO } });
  });

  it("recusa redação de outro usuário e estado inválido", async () => {
    const daAna = await redacao(ANA);
    await expect(
      comoUsuario(client, BRUNO, () => client.query("select public.discursiva_entregar($1)", [daAna])),
    ).rejects.toThrow(/não encontrada/);
    const corrigida = await redacao(BRUNO, "corrigida");
    await expect(
      comoUsuario(client, BRUNO, () => client.query("select public.discursiva_entregar($1)", [corrigida])),
    ).rejects.toThrow(/estado corrigida/);
  });

  it("aceita entregar de novo uma redação que falhou", async () => {
    const id = await redacao(BRUNO, "falhou");
    await comoUsuario(client, BRUNO, () => client.query("select public.discursiva_entregar($1)", [id]));
  });

  it("limita a 2 redações em correção ao mesmo tempo", async () => {
    const CARLA = "00000000-0000-0000-0000-00000000000c";
    await client.query("insert into auth.users (id, email) values ($1, 'carla@x.com')", [CARLA]);
    await redacao(CARLA, "na_fila");
    await redacao(CARLA, "corrigindo");
    const id = await redacao(CARLA);
    await expect(
      comoUsuario(client, CARLA, () => client.query("select public.discursiva_entregar($1)", [id])),
    ).rejects.toThrow(/limite_simultaneas/);
  });

  it("limita a 10 entregas por dia", async () => {
    const DANI = "00000000-0000-0000-0000-00000000000d";
    await client.query("insert into auth.users (id, email) values ($1, 'dani@x.com')", [DANI]);
    for (let i = 0; i < 10; i++) await redacao(DANI, "corrigida", "now()");
    const id = await redacao(DANI);
    await expect(
      comoUsuario(client, DANI, () => client.query("select public.discursiva_entregar($1)", [id])),
    ).rejects.toThrow(/limite_diario/);
  });
});

describe("discursiva_enviar_fotos", () => {
  it("registra as fotos e enfileira a transcrição", async () => {
    const id = await redacao(ANA);
    const r = await comoUsuario(client, ANA, async () => {
      await client.query("select public.discursiva_enviar_fotos($1, $2)", [id, [`${ANA}/${id}/1.jpg`]]);
      return (await client.query("select status, entrada, fotos from public.redacoes where id = $1", [id])).rows[0];
    });
    expect(r).toEqual({ status: "transcrevendo", entrada: "foto", fotos: [`${ANA}/${id}/1.jpg`] });
  });

  it("recusa foto fora da pasta do usuário e quantidade inválida", async () => {
    const id = await redacao(ANA);
    await expect(
      comoUsuario(client, ANA, () => client.query("select public.discursiva_enviar_fotos($1, $2)", [id, [`${BRUNO}/x.jpg`]])),
    ).rejects.toThrow(/fora da pasta/);
    await expect(
      comoUsuario(client, ANA, () => client.query("select public.discursiva_enviar_fotos($1, $2)", [id, []])),
    ).rejects.toThrow(/1 ou 2 fotos/);
  });
});

describe("discursiva_pedir_tema", () => {
  it("enfileira um pedido por vez por usuário", async () => {
    const r = await comoUsuario(client, ANA, async () => {
      const a = await valor<boolean>("select public.discursiva_pedir_tema('cbmal-2026')");
      const b = await valor<boolean>("select public.discursiva_pedir_tema('cbmal-2026')");
      return [a, b];
    });
    expect(r).toEqual([true, false]);
  });

  it("recusa concurso desconhecido", async () => {
    await expect(
      comoUsuario(client, ANA, () => client.query("select public.discursiva_pedir_tema('nada')")),
    ).rejects.toThrow(/concurso desconhecido/);
  });
});
