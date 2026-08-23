import { supabase } from "@/lib/supabase";

export interface RawRow {
  nome: string;
  tipo: "INSUMO" | "PRODUTO_FINAL";
  unidade: string;
  saldo_atual: number;
  saldo_minimo?: number;
  codigo_barras?: string;
}

export interface ErrorReport {
  linha: number;
  motivo: string;
}

const UNIDADES_VALIDAS = ["kg", "g", "l", "ml", "un"];

// 1. Dry-run: Valida o arquivo em memória sem afetar o banco de dados
export function validarPlanilha(rows: RawRow[]): { validas: RawRow[]; erros: ErrorReport[] } {
  const erros: ErrorReport[] = [];
  const validas: RawRow[] = [];
  const nomesVistos = new Set<string>();

  rows.forEach((r, i) => {
    const numLinha = i + 2; // Linha 1 reservada para o cabeçalho
    const nomeTrim = r.nome?.trim();

    if (!nomeTrim) {
      erros.push({ linha: numLinha, motivo: "Nome do item está vazio" });
      return;
    }

    if (!r.unidade || !UNIDADES_VALIDAS.includes(r.unidade.toLowerCase())) {
      erros.push({
        linha: numLinha,
        motivo: `Unidade '${r.unidade}' inválida. Use: ${UNIDADES_VALIDAS.join(", ")}`,
      });
      return;
    }

    if (Number(r.saldo_atual) < 0) {
      erros.push({ linha: numLinha, motivo: "Quantidade/Saldo inicial não pode ser negativo" });
      return;
    }

    const chaveNormalizada = nomeTrim.toLowerCase();
    if (nomesVistos.has(chaveNormalizada)) {
      erros.push({ linha: numLinha, motivo: "Nome duplicado na própria planilha" });
      return;
    }
    nomesVistos.add(chaveNormalizada);

    validas.push({ ...r, nome: nomeTrim, unidade: r.unidade.toLowerCase() });
  });

  return { validas, erros };
}

// 2. Gravador Atômico: Aplica Upsert baseado no índice 'nome_normalizado'
export async function processarImportacao(itens: RawRow[]) {
  const payload = itens.map((item) => ({
    nome: item.nome,
    tipo: item.tipo || "INSUMO",
    unidade: item.unidade,
    saldo_atual: Number(item.saldo_atual) || 0,
    saldo_minimo: Number(item.saldo_minimo) || 0,
    codigo_barras: item.codigo_barras || null,
    ativo: true,
  }));

  // Reutiliza e atualiza o item caso o nome já exista no banco (onConflict)
  const { data, error } = await supabase
    .from("estoque_itens")
    .upsert(payload, { onConflict: "nome_normalizado" })
    .select();

  if (error) throw new Error(`Erro na gravação em lote: ${error.message}`);
  return data;
}