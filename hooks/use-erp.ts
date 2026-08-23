import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface EstoqueItem {
  id: string;
  tipo: "INSUMO" | "PRODUTO_FINAL";
  nome: string;
  codigo_barras: string | null;
  unidade: string;
  saldo_atual: number;
  saldo_minimo: number;
  ativo: boolean;
}

export function useEstoque() {
  return useQuery<EstoqueItem[]>({
    queryKey: ["estoque"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_itens")
        .select("*")
        .eq("ativo", true)
        .order("nome", { ascending: true });

      if (error) throw new Error(error.message);
      return data || [];
    },
  });
}

export function useRegistrarProducao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ produtoId, quantidade }: { produtoId: string; quantidade: number }) => {
      // --- 1. VALIDAÇÃO PESADA NO FRONTEND (O "GUARDIÃO") ---
      
      // A. Busca a receita ativa do produto
      const { data: receita, error: errReceita } = await supabase
        .from("receitas")
        .select("*")
        .eq("produto_id", produtoId)
        .eq("ativa", true)
        .single();

      if (errReceita || !receita) throw new Error("Não foi possível encontrar uma receita ativa para este produto.");

      // B. Busca os itens necessários na ficha técnica
      const { data: recInsumos } = await supabase
        .from("receitas_insumos")
        .select("*")
        .eq("receita_id", receita.id);

      // C. Busca os nomes e unidades originais cadastrados
      const { data: cadastroInsumos } = await supabase.from("insumos").select("id, nome, unidade");
      
      // D. Busca o estoque real unificado para validar
      const { data: estoque } = await supabase.from("estoque_itens").select("*").eq("ativo", true);

      // Função Auxiliar: Normaliza textos (ignora maiúsculas/espaços) e Converte Medidas (kg -> g, L -> ml)
      const normalizar = (nome: string, qtd: number, uni: string) => {
        const nomeNorm = nome.trim().toLowerCase();
        const uniNorm = uni.trim().toLowerCase();
        
        if (uniNorm === 'kg') return { nome: nomeNorm, valor: qtd * 1000, uniBase: 'g' };
        if (uniNorm === 'l' || uniNorm === 'litro') return { nome: nomeNorm, valor: qtd * 1000, uniBase: 'ml' };
        
        return { nome: nomeNorm, valor: qtd, uniBase: uniNorm }; // Mantém 'g', 'ml', 'un', 'fatia'
      };

      const fatorProducao = quantidade / (receita.rendimento || 1);
      const erros: string[] = [];

      // E. Cruzamento de Dados e Verificação de Saldo
      for (const req of (recInsumos || [])) {
        const insumoCadastrado = cadastroInsumos?.find(i => i.id === req.insumo_id);
        if (!insumoCadastrado) continue;

        // Calcula quanto precisa baseado no fator da OP e converte
        const reqNorm = normalizar(insumoCadastrado.nome, req.quantidade * fatorProducao, insumoCadastrado.unidade);

        // Busca Flexível no Estoque (ignora case e espaços pontuais)
        const itemEstoque = estoque?.find(e => e.nome.trim().toLowerCase() === reqNorm.nome);

        if (!itemEstoque) {
          erros.push(`❌ Insumo ausente no estoque: "${insumoCadastrado.nome}".`);
          continue;
        }

        const estNorm = normalizar(itemEstoque.nome, itemEstoque.saldo_atual, itemEstoque.unidade);

        // Bloqueio se as unidades forem incompatíveis (ex: pedir 'unidade' e ter 'litro')
        if (reqNorm.uniBase !== estNorm.uniBase) {
          erros.push(`⚠️ Incompatibilidade em "${insumoCadastrado.nome}": Receita pede ${reqNorm.uniBase}, estoque tem ${estNorm.uniBase}.`);
          continue;
        }

        // Verifica se o saldo matematicamente cobre a produção
        if (estNorm.valor < reqNorm.valor) {
          const falta = reqNorm.valor - estNorm.valor;
          erros.push(`📉 Saldo insuficiente de "${insumoCadastrado.nome}": Faltam ${falta.toFixed(2)}${reqNorm.uniBase}.`);
        }
      }

      // Se houver qualquer erro, aborta antes de chamar o banco e lança pro Toast exibir na tela
      if (erros.length > 0) {
        throw new Error("PRODUÇÃO BLOQUEADA:\n\n" + erros.join("\n"));
      }

      // --- 2. TRANSAÇÃO ATÔMICA NO BANCO ---
      // Como passou na validação flexível, podemos acionar a sua RPC que já faz o Débito e o Crédito no BD.
      const idempotencyKey = crypto.randomUUID();

      const { data, error } = await supabase.rpc("registrar_producao", {
        p_produto_id: produtoId,
        p_quantidade_produzida: quantidade,
        p_idempotency_key: idempotencyKey,
        p_origem: "painel_web",
      });

      if (error) throw new Error("Erro no banco de dados: " + error.message);
      return data;
    },
    onSuccess: () => {
      // Atualiza as telas instantaneamente
      queryClient.invalidateQueries({ queryKey: ["estoque"] });
      queryClient.invalidateQueries({ queryKey: ["historico"] });
    },
  });
}

export interface HistoricoMovimentacao {
  id: number;
  tipo_operacao: "PRODUCAO" | "VENDA_EXTERNA" | "IMPORTACAO_PLANILHA" | "PERDA_AVARIA" | "EDICAO_CADASTRO" | "ESTORNO";
  quantidade: number;
  saldo_resultante: number;
  origem: string | null;
  criado_por: string | null;
  criado_em: string;
  estoque_itens?: { nome: string; unidade: string };
}

export function useHistorico() {
  return useQuery<HistoricoMovimentacao[]>({
    queryKey: ["historico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historico_movimentacoes")
        .select(`
          id,
          tipo_operacao,
          quantidade,
          saldo_resultante,
          origem,
          criado_por,
          criado_em,
          estoque_itens ( nome, unidade )
        `)
        .order("criado_em", { ascending: false })
        .limit(100);

      if (error) throw new Error(error.message);
      return data as unknown as HistoricoMovimentacao[];
    },
  });
}