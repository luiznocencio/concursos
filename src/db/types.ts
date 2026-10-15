// Gerado pelo Supabase (generate_typescript_types) a partir do projeto concursos.
// Regenere após cada migração; não edite à mão.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_usage: {
        Row: {
          criado_em: string
          custo_usd: number
          finalidade: string
          id: string
          job_id: string | null
          modelo: string
          provedor: string
          tokens_entrada: number
          tokens_saida: number
        }
        Insert: {
          criado_em?: string
          custo_usd?: number
          finalidade: string
          id?: string
          job_id?: string | null
          modelo: string
          provedor: string
          tokens_entrada?: number
          tokens_saida?: number
        }
        Update: {
          criado_em?: string
          custo_usd?: number
          finalidade?: string
          id?: string
          job_id?: string | null
          modelo?: string
          provedor?: string
          tokens_entrada?: number
          tokens_saida?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      bancas: {
        Row: {
          criado_em: string
          formatos: string[]
          guia_estilo: string
          id: string
          nome: string
          slug: string
        }
        Insert: {
          criado_em?: string
          formatos?: string[]
          guia_estilo?: string
          id?: string
          nome: string
          slug: string
        }
        Update: {
          criado_em?: string
          formatos?: string[]
          guia_estilo?: string
          id?: string
          nome?: string
          slug?: string
        }
        Relationships: []
      }
      cargo_provas: {
        Row: {
          cargo_id: string
          ordem: number
          prova_id: string
        }
        Insert: {
          cargo_id: string
          ordem: number
          prova_id: string
        }
        Update: {
          cargo_id?: string
          ordem?: number
          prova_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cargo_provas_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargo_provas_prova_id_fkey"
            columns: ["prova_id"]
            isOneToOne: false
            referencedRelation: "provas"
            referencedColumns: ["id"]
          },
        ]
      }
      cargos: {
        Row: {
          concurso_id: string
          corte_conjunto: Json | null
          duracao_min: number
          id: string
          nome: string
          qualificacoes: string[]
          slug: string
        }
        Insert: {
          concurso_id: string
          corte_conjunto?: Json | null
          duracao_min: number
          id?: string
          nome: string
          qualificacoes?: string[]
          slug: string
        }
        Update: {
          concurso_id?: string
          corte_conjunto?: Json | null
          duracao_min?: number
          id?: string
          nome?: string
          qualificacoes?: string[]
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "cargos_concurso_id_fkey"
            columns: ["concurso_id"]
            isOneToOne: false
            referencedRelation: "concursos"
            referencedColumns: ["id"]
          },
        ]
      }
      concursos: {
        Row: {
          atualizado_em: string
          banca_id: string
          criado_em: string
          data_prova: string
          editais_fonte: string[]
          id: string
          nome: string
          ressalvas: string[]
          slug: string
        }
        Insert: {
          atualizado_em?: string
          banca_id: string
          criado_em?: string
          data_prova: string
          editais_fonte?: string[]
          id?: string
          nome: string
          ressalvas?: string[]
          slug: string
        }
        Update: {
          atualizado_em?: string
          banca_id?: string
          criado_em?: string
          data_prova?: string
          editais_fonte?: string[]
          id?: string
          nome?: string
          ressalvas?: string[]
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "concursos_banca_id_fkey"
            columns: ["banca_id"]
            isOneToOne: false
            referencedRelation: "bancas"
            referencedColumns: ["id"]
          },
        ]
      }
      disciplinas: {
        Row: {
          concurso_id: string
          id: string
          nome: string
          slug: string
        }
        Insert: {
          concurso_id: string
          id?: string
          nome: string
          slug: string
        }
        Update: {
          concurso_id?: string
          id?: string
          nome?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "disciplinas_concurso_id_fkey"
            columns: ["concurso_id"]
            isOneToOne: false
            referencedRelation: "concursos"
            referencedColumns: ["id"]
          },
        ]
      }
      fonte_dispositivos: {
        Row: {
          fonte_id: string
          id: string
          ordem: number
          referencia: string
          texto: string
        }
        Insert: {
          fonte_id: string
          id?: string
          ordem: number
          referencia: string
          texto: string
        }
        Update: {
          fonte_id?: string
          id?: string
          ordem?: number
          referencia?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "fonte_dispositivos_fonte_id_fkey"
            columns: ["fonte_id"]
            isOneToOne: false
            referencedRelation: "fontes"
            referencedColumns: ["id"]
          },
        ]
      }
      fontes: {
        Row: {
          canonicos: string[]
          criado_em: string
          id: string
          slug: string
          tipo: string
          titulo: string
          url_oficial: string | null
        }
        Insert: {
          canonicos?: string[]
          criado_em?: string
          id?: string
          slug: string
          tipo: string
          titulo: string
          url_oficial?: string | null
        }
        Update: {
          canonicos?: string[]
          criado_em?: string
          id?: string
          slug?: string
          tipo?: string
          titulo?: string
          url_oficial?: string | null
        }
        Relationships: []
      }
      item_topicos: {
        Row: {
          item_id: string
          topico_canonico_id: string
        }
        Insert: {
          item_id: string
          topico_canonico_id: string
        }
        Update: {
          item_id?: string
          topico_canonico_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_topicos_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_topicos_topico_canonico_id_fkey"
            columns: ["topico_canonico_id"]
            isOneToOne: false
            referencedRelation: "topicos_canonicos"
            referencedColumns: ["id"]
          },
        ]
      }
      itens: {
        Row: {
          alternativas: Json | null
          atualizado_em: string
          banca_id: string
          citacao: string | null
          criado_em: string
          dificuldade: number | null
          enunciado: string
          fonte_id: string | null
          formato: string
          gabarito: string
          hash_normalizado: string
          id: string
          justificativa: string
          origem: string
          prova_origem: string | null
          status: string
          texto_base_id: string | null
          validacao: Json
        }
        Insert: {
          alternativas?: Json | null
          atualizado_em?: string
          banca_id: string
          citacao?: string | null
          criado_em?: string
          dificuldade?: number | null
          enunciado: string
          fonte_id?: string | null
          formato: string
          gabarito: string
          hash_normalizado: string
          id?: string
          justificativa?: string
          origem: string
          prova_origem?: string | null
          status?: string
          texto_base_id?: string | null
          validacao?: Json
        }
        Update: {
          alternativas?: Json | null
          atualizado_em?: string
          banca_id?: string
          citacao?: string | null
          criado_em?: string
          dificuldade?: number | null
          enunciado?: string
          fonte_id?: string | null
          formato?: string
          gabarito?: string
          hash_normalizado?: string
          id?: string
          justificativa?: string
          origem?: string
          prova_origem?: string | null
          status?: string
          texto_base_id?: string | null
          validacao?: Json
        }
        Relationships: [
          {
            foreignKeyName: "itens_banca_id_fkey"
            columns: ["banca_id"]
            isOneToOne: false
            referencedRelation: "bancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_fonte_id_fkey"
            columns: ["fonte_id"]
            isOneToOne: false
            referencedRelation: "fontes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_texto_base_id_fkey"
            columns: ["texto_base_id"]
            isOneToOne: false
            referencedRelation: "textos_base"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          atualizado_em: string
          criado_em: string
          erro: string | null
          executar_apos: string
          id: string
          payload: Json
          status: string
          tentativas: number
          tipo: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          erro?: string | null
          executar_apos?: string
          id?: string
          payload?: Json
          status?: string
          tentativas?: number
          tipo: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          erro?: string | null
          executar_apos?: string
          id?: string
          payload?: Json
          status?: string
          tentativas?: number
          tipo?: string
        }
        Relationships: []
      }
      prova_disciplinas: {
        Row: {
          disciplina_id: string
          ordem: number
          prova_id: string
        }
        Insert: {
          disciplina_id: string
          ordem: number
          prova_id: string
        }
        Update: {
          disciplina_id?: string
          ordem?: number
          prova_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prova_disciplinas_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prova_disciplinas_prova_id_fkey"
            columns: ["prova_id"]
            isOneToOne: false
            referencedRelation: "provas"
            referencedColumns: ["id"]
          },
        ]
      }
      provas: {
        Row: {
          alternativas: number | null
          concurso_id: string
          config_discursiva: Json | null
          distribuicao: Json | null
          formato: string | null
          id: string
          n_itens: number | null
          nome: string
          regra_corte: Json | null
          regra_pontuacao: Json | null
          slug: string
          tipo: string
        }
        Insert: {
          alternativas?: number | null
          concurso_id: string
          config_discursiva?: Json | null
          distribuicao?: Json | null
          formato?: string | null
          id?: string
          n_itens?: number | null
          nome: string
          regra_corte?: Json | null
          regra_pontuacao?: Json | null
          slug: string
          tipo: string
        }
        Update: {
          alternativas?: number | null
          concurso_id?: string
          config_discursiva?: Json | null
          distribuicao?: Json | null
          formato?: string | null
          id?: string
          n_itens?: number | null
          nome?: string
          regra_corte?: Json | null
          regra_pontuacao?: Json | null
          slug?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "provas_concurso_id_fkey"
            columns: ["concurso_id"]
            isOneToOne: false
            referencedRelation: "concursos"
            referencedColumns: ["id"]
          },
        ]
      }
      respostas: {
        Row: {
          duvida: boolean
          id: string
          item_id: string
          respondida_em: string
          resposta: string
          simulado_id: string
          tempo_ms: number | null
          user_id: string
        }
        Insert: {
          duvida?: boolean
          id?: string
          item_id: string
          respondida_em?: string
          resposta: string
          simulado_id: string
          tempo_ms?: number | null
          user_id?: string
        }
        Update: {
          duvida?: boolean
          id?: string
          item_id?: string
          respondida_em?: string
          resposta?: string
          simulado_id?: string
          tempo_ms?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "respostas_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      revisao_espacada: {
        Row: {
          etapa: number
          item_id: string
          proxima_em: string
          user_id: string
        }
        Insert: {
          etapa: number
          item_id: string
          proxima_em: string
          user_id?: string
        }
        Update: {
          etapa?: number
          item_id?: string
          proxima_em?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revisao_espacada_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
        ]
      }
      seed_partes: {
        Row: {
          conteudo: string
          criado_em: string
          lote: string
          parte: number
        }
        Insert: {
          conteudo: string
          criado_em?: string
          lote: string
          parte: number
        }
        Update: {
          conteudo?: string
          criado_em?: string
          lote?: string
          parte?: number
        }
        Relationships: []
      }
      simulado_itens: {
        Row: {
          item_id: string
          ordem: number
          simulado_id: string
          user_id: string
        }
        Insert: {
          item_id: string
          ordem: number
          simulado_id: string
          user_id?: string
        }
        Update: {
          item_id?: string
          ordem?: number
          simulado_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulado_itens_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulado_itens_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados"
            referencedColumns: ["id"]
          },
        ]
      }
      simulados: {
        Row: {
          cargo_id: string
          config: Json
          finalizado_em: string | null
          id: string
          iniciado_em: string
          modo: string
          resultado: Json | null
          user_id: string
        }
        Insert: {
          cargo_id: string
          config?: Json
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          modo: string
          resultado?: Json | null
          user_id?: string
        }
        Update: {
          cargo_id?: string
          config?: Json
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          modo?: string
          resultado?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulados_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
        ]
      }
      textos_base: {
        Row: {
          conteudo: string
          criado_em: string
          id: string
          origem: string
        }
        Insert: {
          conteudo: string
          criado_em?: string
          id?: string
          origem: string
        }
        Update: {
          conteudo?: string
          criado_em?: string
          id?: string
          origem?: string
        }
        Relationships: []
      }
      topicos: {
        Row: {
          canonico_id: string | null
          codigo: string
          disciplina_id: string
          id: string
          ordem: number
          parent_id: string | null
          titulo: string
        }
        Insert: {
          canonico_id?: string | null
          codigo: string
          disciplina_id: string
          id?: string
          ordem: number
          parent_id?: string | null
          titulo: string
        }
        Update: {
          canonico_id?: string | null
          codigo?: string
          disciplina_id?: string
          id?: string
          ordem?: number
          parent_id?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "topicos_canonico_id_fkey"
            columns: ["canonico_id"]
            isOneToOne: false
            referencedRelation: "topicos_canonicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topicos_disciplina_id_fkey"
            columns: ["disciplina_id"]
            isOneToOne: false
            referencedRelation: "disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topicos_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "topicos"
            referencedColumns: ["id"]
          },
        ]
      }
      topicos_canonicos: {
        Row: {
          area: string | null
          id: string
          slug: string
          titulo: string
        }
        Insert: {
          area?: string | null
          id?: string
          slug: string
          titulo: string
        }
        Update: {
          area?: string | null
          id?: string
          slug?: string
          titulo?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      carregar_edital: { Args: { e: Json }; Returns: undefined }
      edital_gravar_estrutura: { Args: { e: Json }; Returns: string }
      edital_gravar_topicos: {
        Args: { e: Json; v_concurso: string }
        Returns: undefined
      }
      edital_ligar_cargos: {
        Args: { e: Json; v_concurso: string }
        Returns: undefined
      }
      edital_ligar_disciplinas: {
        Args: { e: Json; v_concurso: string }
        Returns: undefined
      }
      edital_remover_topicos: {
        Args: { e: Json; v_concurso: string }
        Returns: undefined
      }
      estudo_candidatos: { Args: { p_cargo: string }; Returns: Json }
      estudo_canonicos_do_cargo: { Args: { p_cargo: string }; Returns: string[] }
      estudo_historico: { Args: { p_cargo: string }; Returns: Json }
      estudo_pedir_geracao: {
        Args: { p_canonicos: string[]; p_concurso: string }
        Returns: number
      }
      ia_registrar_uso: { Args: { p_uso: Json }; Returns: undefined }
      itens_importar_reais: { Args: { p_prova: Json }; Returns: Json }
      itens_marcar_suspeito: {
        Args: { p_item: string; p_motivo: string }
        Returns: undefined
      }
      itens_registrar_lote: { Args: { p_lote: Json }; Returns: number }
      jobs_concluir: { Args: { p_id: string }; Returns: undefined }
      jobs_enfileirar_geracao: {
        Args: { p_canonico: string; p_concurso: string; p_quantidade: number }
        Returns: string
      }
      jobs_falhar: {
        Args: { p_erro: string; p_id: string; p_max_tentativas: number }
        Returns: undefined
      }
      jobs_reservar: {
        Args: never
        Returns: {
          atualizado_em: string
          criado_em: string
          erro: string | null
          executar_apos: string
          id: string
          payload: Json
          status: string
          tentativas: number
          tipo: string
        }[]
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      nos_do_edital: {
        Args: { e: Json }
        Returns: {
          canonico: string
          codigo: string
          disciplina: string
          ordem: number
          pai: string
          titulo: string
        }[]
      }
      simulado_criar: {
        Args: { p_cargo: string; p_config: Json; p_itens: string[]; p_modo: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
