'use client';

import * as React from 'react';
import {
  ChefHat,
  RefreshCw,
  X,
  Plus,
  Upload,
  Pencil,
  Trash2,
  Save,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

const RECEITAS_TABELAS = ['receitas', 'fichas_tecnicas'] as const;

type ReceitaInsumo = {
  id?: string;
  ingredientId?: string;
  insumoId?: string;
  nome?: string;
  nomeInsumo?: string;
  ingredientName?: string;
  name?: string;
  quantidade?: number | string;
  quantityNeeded?: number | string;
  quantity?: number | string;
  qtd?: number | string;
  unidade?: string;
  unit?: string;
};

type Receita = {
  id?: string;
  nome?: string;
  title?: string;
  name?: string;
  categoria?: string;
  category?: string;
  rendimento?: string | number;
  yieldQuantity?: string | number;
  yieldUnit?: string;
  unidade?: string;
  modoPreparo?: string;
  descriptionText?: string;
  insumos?: ReceitaInsumo[];
  ingredientes?: ReceitaInsumo[];
  ingredients?: ReceitaInsumo[];
};

const normalizarTexto = (txt: unknown): string => {
  if (txt === null || txt === undefined) return '';

  return String(txt)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
};

const parseNum = (val: unknown): number => {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : 0;
  }

  if (val === null || val === undefined || val === '') {
    return 0;
  }

  const texto = String(val)
    .trim()
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  const parsed = Number.parseFloat(texto);

  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizarUnidade = (unidade: unknown): string => {
  const u = normalizarTexto(unidade);

  const mapa: Record<string, string> = {
    kg: 'kg',
    kilo: 'kg',
    kilos: 'kg',
    quilo: 'kg',
    quilos: 'kg',
    g: 'g',
    grama: 'g',
    gramas: 'g',

    l: 'l',
    litro: 'l',
    litros: 'l',

    ml: 'ml',
    mililitro: 'ml',
    mililitros: 'ml',

    un: 'un',
    und: 'un',
    unidade: 'un',
    unidades: 'un',
    pç: 'un',
    peca: 'un',
    pecas: 'un',
  };

  return mapa[u] || u;
};

const converterQuantidade = (
  quantidade: number,
  unidadeOrigem: unknown,
  unidadeDestino: unknown,
): number | null => {
  const origem = normalizarUnidade(unidadeOrigem);
  const destino = normalizarUnidade(unidadeDestino);

  if (!Number.isFinite(quantidade)) {
    return null;
  }

  if (!origem || !destino || origem === destino) {
    return quantidade;
  }

  const grupoPeso = new Set(['g', 'kg']);
  const grupoVolume = new Set(['ml', 'l']);

  if (grupoPeso.has(origem) && grupoPeso.has(destino)) {
    if (origem === 'g' && destino === 'kg') return quantidade / 1000;
    if (origem === 'kg' && destino === 'g') return quantidade * 1000;
  }

  if (grupoVolume.has(origem) && grupoVolume.has(destino)) {
    if (origem === 'ml' && destino === 'l') return quantidade / 1000;
    if (origem === 'l' && destino === 'ml') return quantidade * 1000;
  }

  return null;
};

const obterInsumos = (receita: Receita): ReceitaInsumo[] => {
  if (Array.isArray(receita.insumos)) return receita.insumos;
  if (Array.isArray(receita.ingredientes)) return receita.ingredientes;
  if (Array.isArray(receita.ingredients)) return receita.ingredients;

  return [];
};

const obterNomeReceita = (receita: Receita): string =>
  receita.nome || receita.title || receita.name || 'Produto Sem Nome';

const extrairRendimento = (
  receita: Receita,
): { quantidade: number; unidade: string } => {
  if (receita.yieldQuantity !== undefined) {
    return {
      quantidade: Math.max(0, parseNum(receita.yieldQuantity)),
      unidade: receita.yieldUnit || receita.unidade || 'UN',
    };
  }

  const rendimento = String(receita.rendimento || '');

  const quantidade = parseNum(rendimento);

  const unidadeEncontrada =
    normalizarUnidade(
      rendimento.match(
        /\b(kg|quilo|quilos|g|grama|gramas|l|litro|litros|ml|mililitro|mililitros|un|und|unidade|unidades)\b/i,
      )?.[1],
    ) || receita.unidade || 'un';

  return {
    quantidade: Math.max(0, quantidade),
    unidade: unidadeEncontrada.toUpperCase(),
  };
};

const obterUnidadeEstoque = (item: any, fallback: string): string =>
  item?.unidade ||
  item?.unit ||
  item?.medida ||
  item?.unidadeMedida ||
  fallback;

const obterSaldoEstoque = (item: any): number =>
  parseNum(
    item?.saldo_atual ??
      item?.quantidade ??
      item?.quantity ??
      item?.qtd ??
      0,
  );

const obterNomeEstoque = (item: any): string =>
  item?.nome || item?.name || item?.descricao || '';

const obterNomeInsumo = (ing: ReceitaInsumo): string =>
  ing?.ingredientName ||
  ing?.nomeInsumo ||
  ing?.nome ||
  ing?.name ||
  '';

/**
 * Parser CSV simples com suporte a:
 * - separador ;
 * - separador ,
 * - campos entre aspas
 * - aspas escapadas como ""
 */
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if ((char === ';' || char === ',') && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current.trim());

  return result;
};

export function ReceitasScreen({
  recipes,
  setRecipes,
  stock,
  setStock,
  productionLogs,
  setProductionLogs,
  showToast,
}: any) {
  const [modalProducaoOpen, setModalProducaoOpen] = React.useState(false);
  const [receitaSelecionada, setReceitaSelecionada] =
    React.useState<Receita | null>(null);
  const [multiplicador, setMultiplicador] = React.useState<number>(1);

  const [modalCrudOpen, setModalCrudOpen] = React.useState(false);

  const [formReceita, setFormReceita] = React.useState<Receita & {
    id: string;
    insumos: ReceitaInsumo[];
  }>({
    id: '',
    nome: '',
    categoria: 'Padaria',
    rendimento: '1 un',
    modoPreparo: '',
    insumos: [],
  });

  const [salvandoReceita, setSalvandoReceita] = React.useState(false);
  const [deletandoReceitaId, setDeletandoReceitaId] = React.useState<string | null>(
    null,
  );
  const [processandoProducao, setProcessandoProducao] =
    React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const listaReceitas: Receita[] = Array.isArray(recipes) ? recipes : [];
  const listaEstoqueAtual = Array.isArray(stock) ? stock : [];

  const dispararToast = React.useCallback(
    (mensagem: string) => {
      if (typeof showToast === 'function') {
        showToast(mensagem);
      }
    },
    [showToast],
  );

  const salvarEstoqueLocal = React.useCallback((novoEstoque: any[]) => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('stock', JSON.stringify(novoEstoque));
        localStorage.setItem('estoque', JSON.stringify(novoEstoque));
      }
    } catch (error) {
      console.error('Erro ao salvar estoque no localStorage:', error);
    }
  }, []);

  const abrirModalNovo = () => {
    setFormReceita({
      id: '',
      nome: '',
      categoria: 'Padaria',
      rendimento: '',
      modoPreparo: '',
      insumos: [],
    });

    setModalCrudOpen(true);
  };

  const abrirModalEditar = (receita: Receita) => {
    setFormReceita({
      ...JSON.parse(JSON.stringify(receita)),
      id: receita.id || '',
      nome: receita.nome || receita.title || receita.name || '',
      categoria:
        receita.categoria || receita.category || 'Padaria',
      rendimento: receita.rendimento || '',
      modoPreparo:
        receita.modoPreparo || receita.descriptionText || '',
      insumos: obterInsumos(receita),
    });

    setModalCrudOpen(true);
  };

  /**
   * Persiste a receita tentando primeiro "receitas"
   * e depois "fichas_tecnicas", conforme instrução.
   *
   * Premissa: ambas usam:
   * - id
   * - nome
   * - categoria
   * - rendimento
   * - modo_preparo
   * - insumos
   */
  const persistirReceitaSupabase = async (
    receita: Receita & { id: string },
  ): Promise<Receita | null> => {
    const payload = {
      nome: receita.nome?.trim(),
      categoria: receita.categoria?.trim() || 'Padaria',
      rendimento: String(receita.rendimento ?? '').trim(),
      modo_preparo: receita.modoPreparo || '',
      insumos: Array.isArray(receita.insumos) ? receita.insumos : [],
    };

    for (const tabela of RECEITAS_TABELAS) {
      try {
        if (receita.id) {
          const { data, error } = await supabase
            .from(tabela)
            .update(payload)
            .eq('id', receita.id)
            .select()
            .maybeSingle();

          if (!error && data) {
            return {
              ...data,
              modoPreparo: data.modo_preparo ?? data.modoPreparo ?? '',
              insumos: data.insumos ?? data.ingredientes ?? [],
            };
          }

          if (error) {
            console.warn(`Falha atualizando ${tabela}:`, error);
          }
        } else {
          const { data, error } = await supabase
            .from(tabela)
            .insert([payload])
            .select()
            .single();

          if (!error && data) {
            return {
              ...data,
              modoPreparo: data.modo_preparo ?? data.modoPreparo ?? '',
              insumos: data.insumos ?? data.ingredientes ?? [],
            };
          }

          if (error) {
            console.warn(`Falha inserindo em ${tabela}:`, error);
          }
        }
      } catch (error) {
        console.warn(`Erro ao persistir receita em ${tabela}:`, error);
      }
    }

    return null;
  };

  const salvarReceita = async (e: React.FormEvent) => {
    e.preventDefault();

    if (typeof setRecipes !== 'function') {
      dispararToast('Não foi possível atualizar a lista local de receitas.');
      return;
    }

    const nome = String(formReceita.nome || '').trim();
    const rendimento = String(formReceita.rendimento || '').trim();

    if (!nome) {
      dispararToast('Informe o nome da receita.');
      return;
    }

    if (!rendimento) {
      dispararToast('Informe o rendimento da receita.');
      return;
    }

    if (
      formReceita.insumos.some(
        (ing) =>
          !String(ing.nome || '').trim() ||
          parseNum(
            ing.quantidade ??
              ing.quantity ??
              ing.quantityNeeded ??
              ing.qtd,
          ) <= 0,
      )
    ) {
      dispararToast(
        'Todos os ingredientes precisam ter nome e quantidade maior que zero.',
      );
      return;
    }

    if (salvandoReceita) return;

    setSalvandoReceita(true);

    try {
      const receitaParaSalvar = {
        ...formReceita,
        nome,
        rendimento,
        modoPreparo: String(formReceita.modoPreparo || '').trim(),
        categoria:
          String(formReceita.categoria || 'Padaria').trim() || 'Padaria',
        insumos: formReceita.insumos.map((ing) => ({
          ...ing,
          nome: String(ing.nome || '').trim(),
          quantidade: parseNum(ing.quantidade),
          unidade: ing.unidade || 'kg',
        })),
      };

      const receitaPersistida = await persistirReceitaSupabase(
        receitaParaSalvar,
      );

      if (receitaPersistida) {
        const receitaFinal = {
          ...receitaParaSalvar,
          ...receitaPersistida,
          id: receitaPersistida.id || receitaParaSalvar.id,
          modoPreparo:
            receitaPersistida.modoPreparo ??
            receitaParaSalvar.modoPreparo,
          insumos:
            Array.isArray(receitaPersistida.insumos)
              ? receitaPersistida.insumos
              : receitaParaSalvar.insumos,
        };

        if (receitaParaSalvar.id) {
          setRecipes((prev: any[]) =>
            (Array.isArray(prev) ? prev : []).map((r) =>
              r.id === receitaParaSalvar.id ? receitaFinal : r,
            ),
          );
        } else {
          setRecipes((prev: any[]) => [
            ...(Array.isArray(prev) ? prev : []),
            receitaFinal,
          ]);
        }

        dispararToast(
          receitaParaSalvar.id
            ? 'Receita atualizada com sucesso!'
            : 'Nova receita cadastrada!',
        );

        setModalCrudOpen(false);
        return;
      }

      /**
       * Fallback offline/local:
       * preserva o comportamento anterior, porém informa que
       * o Supabase não foi sincronizado.
       */
      const idLocal =
        receitaParaSalvar.id ||
        (typeof crypto !== 'undefined' &&
        typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `local-${Date.now()}-${Math.random()}`);

      const receitaLocal = {
        ...receitaParaSalvar,
        id: idLocal,
        _syncPending: true,
      };

      setRecipes((prev: any[]) => {
        const base = Array.isArray(prev) ? prev : [];

        if (receitaParaSalvar.id) {
          return base.map((r) =>
            r.id === receitaParaSalvar.id ? receitaLocal : r,
          );
        }

        return [...base, receitaLocal];
      });

      dispararToast(
        'Receita salva localmente, mas não foi sincronizada com o Supabase.',
      );

      setModalCrudOpen(false);
    } catch (error) {
      console.error('Erro ao salvar receita:', error);
      dispararToast('Erro ao salvar receita.');
    } finally {
      setSalvandoReceita(false);
    }
  };

  const deletarReceita = async (id: string) => {
    if (!id) {
      dispararToast('Receita sem ID não pode ser excluída do banco.');
      return;
    }

    if (!window.confirm('Tem certeza que deseja excluir esta receita?')) {
      return;
    }

    if (deletandoReceitaId) return;

    setDeletandoReceitaId(id);

    try {
      let removidaDoBanco = false;

      for (const tabela of RECEITAS_TABELAS) {
        try {
          const { error } = await supabase
            .from(tabela)
            .delete()
            .eq('id', id);

          if (!error) {
            removidaDoBanco = true;
            break;
          }

          console.warn(`Falha excluindo em ${tabela}:`, error);
        } catch (error) {
          console.warn(`Erro excluindo em ${tabela}:`, error);
        }
      }

      if (typeof setRecipes === 'function') {
        setRecipes((prev: any[]) => {
          const base = Array.isArray(prev) ? prev : [];

          return base.filter((r) => r.id !== id);
        });
      }

      if (removidaDoBanco) {
        dispararToast('Receita excluída com sucesso.');
      } else {
        dispararToast(
          'Receita removida localmente, mas não foi possível confirmar a exclusão no Supabase.',
        );
      }
    } catch (error) {
      console.error('Erro ao excluir receita:', error);
      dispararToast('Erro ao excluir receita.');
    } finally {
      setDeletandoReceitaId(null);
    }
  };

  const handleImportCSV = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      dispararToast('Selecione um arquivo CSV válido.');
      return;
    }

    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;

        if (!text?.trim()) {
          dispararToast('O arquivo CSV está vazio.');
          return;
        }

        const lines = text
          .replace(/^\uFEFF/, '')
          .split(/\r?\n/);

        if (lines.length < 2) {
          dispararToast(
            'O CSV precisa ter cabeçalho e pelo menos uma linha.',
          );
          return;
        }

        const headers = parseCSVLine(lines[0]).map((h) =>
          normalizarTexto(h),
        );

        const findCol = (keywords: string[]) =>
          headers.findIndex((h) =>
            keywords.some((keyword) =>
              h.includes(normalizarTexto(keyword)),
            ),
          );

        const idxNome = findCol([
          'nome',
          'receita',
          'produto',
        ]);

        const idxCategoria = findCol([
          'categoria',
          'grupo',
        ]);

        const idxRendimento = findCol([
          'rendimento',
          'porcao',
          'porção',
        ]);

        const idxPreparo = findCol([
          'preparo',
          'instrucao',
          'instrução',
        ]);

        const idxInsumo = findCol([
          'insumo',
          'ingrediente',
          'componente',
          'item',
        ]);

        const idxQtd = findCol([
          'quantidade',
          'qtd',
          'peso',
        ]);

        const idxUn = findCol([
          'unidade',
          'unid',
          'medida',
          'un',
        ]);

        if (idxNome < 0) {
          dispararToast(
            'Não foi possível identificar a coluna de nome da receita.',
          );
          return;
        }

        const grouped: Record<string, Receita & {
          id: string;
          insumos: ReceitaInsumo[];
        }> = {};

        for (let i = 1; i < lines.length; i += 1) {
          if (!lines[i].trim()) continue;

          const cols = parseCSVLine(lines[i]);

          const nome = idxNome >= 0 ? cols[idxNome]?.trim() : '';

          if (!nome) continue;

          const chave = normalizarTexto(nome);

          const categoria =
            idxCategoria >= 0
              ? cols[idxCategoria]?.trim() || 'Geral'
              : 'Geral';

          const rendimento =
            idxRendimento >= 0
              ? cols[idxRendimento]?.trim() || '1 un'
              : '1 un';

          const preparo =
            idxPreparo >= 0
              ? cols[idxPreparo]?.trim() || ''
              : '';

          const insumoNome =
            idxInsumo >= 0
              ? cols[idxInsumo]?.trim() || ''
              : '';

          const qtdTexto =
            idxQtd >= 0
              ? cols[idxQtd]?.trim() || '0'
              : '0';

          const unidade =
            idxUn >= 0
              ? cols[idxUn]?.trim() || 'kg'
              : 'kg';

          if (!grouped[chave]) {
            const id =
              typeof crypto !== 'undefined' &&
              typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `csv-${Date.now()}-${i}`;

            grouped[chave] = {
              id,
              nome,
              categoria,
              rendimento,
              modoPreparo: preparo,
              insumos: [],
            };
          }

          if (insumoNome) {
            grouped[chave].insumos.push({
              nome: insumoNome,
              quantidade: parseNum(qtdTexto.replace(',', '.')),
              unidade: unidade || 'kg',
            });
          }
        }

        const novasReceitas = Object.values(grouped);

        if (!novasReceitas.length) {
          dispararToast(
            'Nenhuma receita válida foi encontrada no CSV.',
          );
          return;
        }

        if (typeof setRecipes === 'function') {
          setRecipes((prev: any[]) => [
            ...(Array.isArray(prev) ? prev : []),
            ...novasReceitas,
          ]);
        }

        dispararToast(
          `${novasReceitas.length} receitas importadas localmente. A persistência no Supabase poderá ser feita pelo fluxo de cadastro.`,
        );
      } catch (error) {
        console.error('Erro ao importar CSV:', error);
        dispararToast('Erro ao processar o arquivo CSV.');
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };

    reader.onerror = () => {
      dispararToast('Não foi possível ler o arquivo CSV.');

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file, 'UTF-8');
  };

  const encontrarInsumoCorrespondente = (
    itemEstoque: any,
    ing: ReceitaInsumo,
  ): boolean => {
    const idEstoque =
      itemEstoque?.id ||
      itemEstoque?.insumoId ||
      itemEstoque?.ingredientId;

    const idIng =
      ing?.ingredientId ||
      ing?.insumoId ||
      ing?.id;

    if (
      idEstoque &&
      idIng &&
      String(idEstoque).trim() === String(idIng).trim()
    ) {
      return true;
    }

    const nomeEstoque = normalizarTexto(
      obterNomeEstoque(itemEstoque),
    );

    const nomeIng = normalizarTexto(
      obterNomeInsumo(ing),
    );

    if (!nomeEstoque || !nomeIng) {
      return false;
    }

    // Exatamente igual é muito mais seguro.
    return nomeEstoque === nomeIng;
  };

  const calcularConsumos = (
    receita: Receita,
    fornadas: number,
    estoque: any[],
  ) => {
    const insumos = obterInsumos(receita);

    return insumos.map((ing) => {
      const itemEstoque = estoque.find((item) =>
        encontrarInsumoCorrespondente(item, ing),
      );

      if (!itemEstoque) {
        throw new Error(
          `Insumo "${obterNomeInsumo(ing)}" não encontrado no estoque.`,
        );
      }

      const qtdPorFornada = parseNum(
        ing.quantityNeeded ??
          ing.quantidade ??
          ing.quantity ??
          ing.qtd,
      );

      if (qtdPorFornada <= 0) {
        throw new Error(
          `Quantidade inválida para o insumo "${obterNomeInsumo(
            ing,
          )}".`,
        );
      }

      const unidadeReceita =
        ing.unidade ||
        ing.unit ||
        'kg';

      const unidadeEstoque = obterUnidadeEstoque(
        itemEstoque,
        unidadeReceita,
      );

      const consumoReceita =
        qtdPorFornada * fornadas;

      const consumoConvertido = converterQuantidade(
        consumoReceita,
        unidadeReceita,
        unidadeEstoque,
      );

      if (
        consumoConvertido === null ||
        !Number.isFinite(consumoConvertido)
      ) {
        throw new Error(
          `Unidades incompatíveis para "${obterNomeInsumo(
            ing,
          )}": receita=${unidadeReceita}, estoque=${unidadeEstoque}.`,
        );
      }

      const saldoAtual = obterSaldoEstoque(itemEstoque);

      if (saldoAtual < consumoConvertido) {
        throw new Error(
          `Estoque insuficiente para "${obterNomeInsumo(
            ing,
          )}". Disponível: ${saldoAtual} ${unidadeEstoque}; necessário: ${consumoConvertido} ${unidadeEstoque}.`,
        );
      }

      return {
        ing,
        itemEstoque,
        unidadeEstoque,
        consumoConvertido,
        saldoAtual,
        novaQtd: Number(
          (saldoAtual - consumoConvertido).toFixed(3),
        ),
      };
    });
  };

  async function handleConfirmarProducao(
    e?: React.FormEvent,
    receitaDirecta?: Receita,
  ) {
    e?.preventDefault?.();

    if (processandoProducao) return;

    const receitaAlvo =
      receitaDirecta || receitaSelecionada;

    if (!receitaAlvo) {
      dispararToast('Nenhuma receita selecionada.');
      return;
    }

    const multVal = parseNum(multiplicador);
    const fornadas = Math.max(1, Math.floor(multVal || 1));

    const nomeProdutoFinal =
      obterNomeReceita(receitaAlvo);

    const rendimento = extrairRendimento(
      receitaAlvo,
    );

    if (rendimento.quantidade <= 0) {
      dispararToast(
        'A receita possui rendimento inválido.',
      );
      return;
    }

    const qtdProduzidaTotal =
      rendimento.quantidade * fornadas;

    setProcessandoProducao(true);

    try {
      /**
       * Validação completa antes de qualquer baixa.
       * Isso evita descobrir um ingrediente faltando depois
       * de já ter alterado outro.
       */
      const consumos = calcularConsumos(
        receitaAlvo,
        fornadas,
        listaEstoqueAtual,
      );

      const produtoExistente =
        listaEstoqueAtual.find(
          (s: any) =>
            normalizarTexto(
              s?.nome || s?.name,
            ) ===
            normalizarTexto(nomeProdutoFinal),
        );

      let bancoSincronizado = true;
      const errosBanco: string[] = [];

      /*
       * 1. BAIXA DOS INSUMOS
       */
      for (const consumo of consumos) {
        const id = consumo.itemEstoque?.id;

        if (!id) {
          bancoSincronizado = false;
          errosBanco.push(
            `Insumo "${obterNomeInsumo(
              consumo.ing,
            )}" não possui ID.`,
          );
          continue;
        }

        const { error: updateError } =
          await supabase
            .from('estoque_itens')
            .update({
              quantidade: consumo.novaQtd,
              saldo_atual: consumo.novaQtd,
            })
            .eq('id', id);

        if (updateError) {
          bancoSincronizado = false;
          errosBanco.push(
            `Falha ao baixar "${obterNomeInsumo(
              consumo.ing,
            )}": ${updateError.message}`,
          );
          continue;
        }

        const { error: historicoError } =
          await supabase
            .from('historico_movimentacoes')
            .insert([
              {
                item_id: id,
                estoque_item_id: id,
                tipo_operacao:
                  'CONSUMO_PRODUCAO',
                quantidade:
                  -consumo.consumoConvertido,
                saldo_resultante:
                  consumo.novaQtd,
                origem: `Produção: ${nomeProdutoFinal}`,
              },
            ]);

        if (historicoError) {
          bancoSincronizado = false;
          errosBanco.push(
            `Falha ao registrar histórico de "${obterNomeInsumo(
              consumo.ing,
            )}": ${historicoError.message}`,
          );
        }
      }

      /*
       * 2. ENTRADA DO PRODUTO FINAL
       */
      if (produtoExistente?.id) {
        const qtdAtualProduto =
          obterSaldoEstoque(produtoExistente);

        const unidadeProduto =
          obterUnidadeEstoque(
            produtoExistente,
            rendimento.unidade,
          );

        const qtdConvertidaProduto =
          converterQuantidade(
            qtdProduzidaTotal,
            rendimento.unidade,
            unidadeProduto,
          );

        if (
          qtdConvertidaProduto === null
        ) {
          bancoSincronizado = false;

          errosBanco.push(
            `Unidade incompatível para o produto final "${nomeProdutoFinal}".`,
          );
        } else {
          const novaQtdProduto =
            Number(
              (
                qtdAtualProduto +
                qtdConvertidaProduto
              ).toFixed(3),
            );

          const { error: produtoError } =
            await supabase
              .from('estoque_itens')
              .update({
                quantidade:
                  novaQtdProduto,
                saldo_atual:
                  novaQtdProduto,
                tipo: 'PRODUTO_FINAL',
                ativo: true,
              })
              .eq('id', produtoExistente.id);

          if (produtoError) {
            bancoSincronizado = false;
            errosBanco.push(
              `Falha ao atualizar produto final: ${produtoError.message}`,
            );
          }
        }
      } else {
        const { error: insertError } =
          await supabase
            .from('estoque_itens')
            .insert([
              {
                nome: nomeProdutoFinal,
                tipo: 'PRODUTO_FINAL',
                ativo: true,
                quantidade:
                  qtdProduzidaTotal,
                saldo_atual:
                  qtdProduzidaTotal,
                unidade:
                  rendimento.unidade ||
                  'UN',
                quantidade_minima: 0,
                saldo_minimo: 0,
                preco_custo: 0,
                categoria:
                  receitaAlvo.categoria ||
                  receitaAlvo.category ||
                  'Produção',
              },
            ]);

        if (insertError) {
          bancoSincronizado = false;
          errosBanco.push(
            `Falha ao inserir produto final: ${insertError.message}`,
          );
        }
      }

      /*
       * 3. ATUALIZA ESTADO LOCAL
       *
       * O fallback local continua existindo para permitir
       * operação offline/sincronização entre abas.
       */
      if (typeof setStock === 'function') {
        const novoEstoque = (
          Array.isArray(listaEstoqueAtual)
            ? listaEstoqueAtual
            : []
        ).map((item: any) => {
          const consumo = consumos.find(
            (c) => c.itemEstoque?.id === item?.id,
          );

          if (!consumo) {
            return item;
          }

          return {
            ...item,
            quantity: consumo.novaQtd,
            quantidade: consumo.novaQtd,
            saldo_atual: consumo.novaQtd,
            qtd: consumo.novaQtd,
          };
        });

        const idxProduto =
          novoEstoque.findIndex(
            (s: any) =>
              normalizarTexto(
                s?.nome || s?.name,
              ) ===
              normalizarTexto(
                nomeProdutoFinal,
              ),
          );

        if (idxProduto >= 0) {
          const itemProduto =
            novoEstoque[idxProduto];

          const qtdAtualProduto =
            obterSaldoEstoque(
              itemProduto,
            );

          const unidadeProduto =
            obterUnidadeEstoque(
              itemProduto,
              rendimento.unidade,
            );

          const qtdProdutoConvertida =
            converterQuantidade(
              qtdProduzidaTotal,
              rendimento.unidade,
              unidadeProduto,
            );

          if (
            qtdProdutoConvertida !==
            null
          ) {
            const novaQtdProduto =
              Number(
                (
                  qtdAtualProduto +
                  qtdProdutoConvertida
                ).toFixed(3),
              );

            novoEstoque[idxProduto] = {
              ...itemProduto,
              tipo: 'PRODUTO_FINAL',
              ativo: true,
              quantidade:
                novaQtdProduto,
              saldo_atual:
                novaQtdProduto,
              quantity:
                novaQtdProduto,
            };
          }
        } else {
          novoEstoque.push({
            id:
              typeof crypto !== 'undefined' &&
              typeof crypto.randomUUID ===
                'function'
                ? crypto.randomUUID()
                : `prod-${Date.now()}`,
            nome: nomeProdutoFinal,
            tipo: 'PRODUTO_FINAL',
            ativo: true,
            quantidade:
              qtdProduzidaTotal,
            saldo_atual:
              qtdProduzidaTotal,
            quantity:
              qtdProduzidaTotal,
            unidade:
              rendimento.unidade || 'UN',
            minimo: 0,
            custoUnitario: 0,
          });
        }

        setStock(() => novoEstoque);

        salvarEstoqueLocal(
          novoEstoque,
        );
      }

      /*
       * 4. REGISTRA LOG LOCAL
       */
      if (
        typeof setProductionLogs ===
        'function'
      ) {
        const agora =
          new Date();

        const novoLog = {
          id:
            typeof crypto !==
              'undefined' &&
            typeof crypto.randomUUID ===
              'function'
              ? crypto.randomUUID()
              : `log-${Date.now()}`,

          receitaNome:
            nomeProdutoFinal,

          recipeTitle:
            nomeProdutoFinal,

          fornadas,

          quantidadeProduzida:
            qtdProduzidaTotal,

          timestampISO:
            agora.toISOString(),

          timestamp:
            agora.toLocaleTimeString(
              'pt-BR',
              {
                hour: '2-digit',
                minute: '2-digit',
              },
            ),

          data:
            agora.toLocaleDateString(
              'pt-BR',
            ),

          sincronizadoSupabase:
            bancoSincronizado,
        };

        setProductionLogs(
          (
            prev: any[],
          ) => [
            novoLog,
            ...(Array.isArray(prev)
              ? prev
              : []),
          ],
        );
      }

      if (bancoSincronizado) {
        dispararToast(
          `Produção de ${qtdProduzidaTotal} ${rendimento.unidade} de ${nomeProdutoFinal} registrada com sucesso.`,
        );
      } else {
        console.error(
          'Produção com sincronização parcial:',
          errosBanco,
        );

        dispararToast(
          `Produção atualizada localmente, mas houve falha na sincronização com o Supabase.`,
        );
      }

      setModalProducaoOpen(
        false,
      );
      setReceitaSelecionada(
        null,
      );
      setMultiplicador(1);
    } catch (error: any) {
      console.error(
        'Erro ao registrar produção:',
        error,
      );

      dispararToast(
        error?.message ||
          'Não foi possível registrar a produção.',
      );
    } finally {
      setProcessandoProducao(
        false,
      );
    }
  }

  return (
    <div className="space-y-6 p-2 sm:p-4 animate-fadeIn">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <ChefHat className="w-7 h-7 text-[#7a1f2e]" />
            Receitas & Produção
          </h2>

          <p className="text-sm text-zinc-500 mt-1">
            Cadastre receitas, importe planilhas e dê
            baixa no estoque.
          </p>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleImportCSV}
            className="hidden"
          />

          <button
            type="button"
            onClick={() =>
              fileInputRef.current?.click()
            }
            className="flex-1 md:flex-none bg-zinc-100 hover:bg-zinc-200 text-zinc-700 py-2.5 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Importar CSV
          </button>

          <button
            type="button"
            onClick={abrirModalNovo}
            className="flex-1 md:flex-none bg-[#7a1f2e] hover:bg-[#5c1823] text-white py-2.5 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nova Receita
          </button>
        </div>
      </div>

      {listaReceitas.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-zinc-300">
          <p className="text-zinc-500">
            Nenhuma receita cadastrada. Crie uma
            nova ou importe via CSV.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {listaReceitas.map(
          (receita: Receita) => {
            const listaInsumos =
              obterInsumos(receita);

            const nomeReceita =
              obterNomeReceita(
                receita,
              );

            const categoriaReceita =
              receita.categoria ||
              receita.category ||
              'Padaria';

            const rendimentoReceita =
              receita.rendimento ||
              (receita.yieldQuantity
                ? `${receita.yieldQuantity} ${
                    receita.yieldUnit ||
                    'un'
                  }`
                : 'Não informado');

            const modoPreparoReceita =
              receita.modoPreparo ||
              receita.descriptionText;

            return (
              <div
                key={
                  receita.id ||
                  nomeReceita
                }
                className="bg-white rounded-2xl p-4 shadow-sm border border-[#7a1f2e]/10 flex flex-col h-full"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="bg-amber-100 text-amber-900 font-semibold text-xs px-3 py-1 rounded-md mb-2 inline-block">
                      {categoriaReceita}
                    </span>

                    <h3 className="font-bold text-xl text-zinc-900">
                      {nomeReceita}
                    </h3>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        abrirModalEditar(
                          receita,
                        )
                      }
                      className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                      disabled={
                        !!deletandoReceitaId
                      }
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        receita.id &&
                        deletarReceita(
                          receita.id,
                        )
                      }
                      disabled={
                        !receita.id ||
                        !!deletandoReceitaId
                      }
                      className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-40"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <span className="text-xs text-zinc-500 font-medium">
                  Rendimento:{' '}
                  {rendimentoReceita}
                </span>

                {modoPreparoReceita && (
                  <div className="bg-zinc-50/80 rounded-xl p-4 border border-zinc-100 space-y-1">
                    <p className="text-xs font-bold text-zinc-700">
                      📄 Modo de Preparo:
                    </p>

                    <p className="text-xs text-zinc-600 leading-relaxed">
                      {
                        modoPreparoReceita
                      }
                    </p>
                  </div>
                )}

                <div className="space-y-2 pt-1">
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    INGREDIENTES POR RECEITA:
                  </p>

                  <div className="bg-zinc-50/50 rounded-xl p-2 space-y-1.5 border border-zinc-100">
                    {listaInsumos.map(
                      (
                        ing,
                        idx,
                      ) => (
                        <div
                          key={`${obterNomeInsumo(
                            ing,
                          )}-${idx}`}
                          className="flex justify-between items-center text-xs px-2 py-1 border-b border-zinc-100 last:border-0"
                        >
                          <span className="font-medium text-zinc-700">
                            •{' '}
                            {
                              obterNomeInsumo(
                                ing,
                              )
                            }
                          </span>

                          <span className="font-bold text-zinc-900">
                            {ing.quantidade ??
                              ing.quantityNeeded ??
                              ing.quantity ??
                              0}{' '}
                            {ing.unidade ||
                              ing.unit ||
                              'kg'}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setReceitaSelecionada(
                      receita,
                    );
                    setMultiplicador(
                      1,
                    );
                    setModalProducaoOpen(
                      true,
                    );
                  }}
                  className="w-full mt-auto bg-[#5c1823] hover:bg-[#4a131c] text-white py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  Disparar Produção
                </button>
              </div>
            );
          },
        )}
      </div>

      {modalProducaoOpen &&
        receitaSelecionada && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-zinc-100 animate-fadeIn">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-lg text-zinc-900 flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-amber-500" />
                  Disparar Produção
                </h3>

                <button
                  type="button"
                  onClick={() =>
                    setModalProducaoOpen(
                      false,
                    )
                  }
                  className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-500"
                  disabled={
                    processandoProducao
                  }
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={(e) =>
                  handleConfirmarProducao(
                    e,
                  )
                }
                className="space-y-4"
              >
                <div>
                  <p className="text-sm font-bold text-zinc-900">
                    {
                      receitaSelecionada.nome
                    }
                  </p>

                  <p className="text-xs text-zinc-500">
                    Rendimento base:{' '}
                    {
                      receitaSelecionada.rendimento
                    }
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Multiplicador de Receita
                    (Qtd)
                  </label>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={
                      multiplicador
                    }
                    onChange={(e) =>
                      setMultiplicador(
                        Number(
                          e.target
                            .value,
                        ),
                      )
                    }
                    disabled={
                      processandoProducao
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 font-bold text-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#5c1823]"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      setModalProducaoOpen(
                        false,
                      )
                    }
                    disabled={
                      processandoProducao
                    }
                    className="flex-1 py-2.5 rounded-xl border border-zinc-300 font-semibold text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={
                      processandoProducao
                    }
                    className="flex-1 py-2.5 rounded-xl bg-[#5c1823] hover:bg-[#4a131c] text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {processandoProducao ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      'Confirmar Baixa'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      {modalCrudOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-zinc-100 animate-fadeIn max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="font-bold text-lg text-zinc-900">
                {formReceita.id
                  ? 'Editar Receita'
                  : 'Nova Receita'}
              </h3>

              <button
                type="button"
                onClick={() =>
                  setModalCrudOpen(
                    false,
                  )
                }
                disabled={
                  salvandoReceita
                }
                className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-500 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={salvarReceita}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Nome da Receita
                  </label>

                  <input
                    required
                    value={
                      formReceita.nome ||
                      ''
                    }
                    onChange={(e) =>
                      setFormReceita({
                        ...formReceita,
                        nome:
                          e.target
                            .value,
                      })
                    }
                    disabled={
                      salvandoReceita
                    }
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm"
                    placeholder="Ex: Pão Doce"
                  />
                </div>

                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Rendimento
                  </label>

                  <input
                    required
                    value={
                      formReceita.rendimento ||
                      ''
                    }
                    onChange={(e) =>
                      setFormReceita({
                        ...formReceita,
                        rendimento:
                          e.target
                            .value,
                      })
                    }
                    disabled={
                      salvandoReceita
                    }
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm"
                    placeholder="Ex: 50 unidades, 2 Kg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Modo de Preparo
                </label>

                <textarea
                  rows={3}
                  value={
                    formReceita.modoPreparo ||
                    ''
                  }
                  onChange={(e) =>
                    setFormReceita({
                      ...formReceita,
                      modoPreparo:
                        e.target
                          .value,
                    })
                  }
                  disabled={
                    salvandoReceita
                  }
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm"
                  placeholder="Passo a passo da receita..."
                />
              </div>

              <div className="border-t border-zinc-100 pt-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-zinc-700">
                    Ingredientes
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      setFormReceita({
                        ...formReceita,
                        insumos: [
                          ...formReceita.insumos,
                          {
                            nome: '',
                            quantidade: 0,
                            unidade:
                              'kg',
                          },
                        ],
                      })
                    }
                    disabled={
                      salvandoReceita
                    }
                    className="text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-800 py-1 px-3 rounded-md font-semibold flex items-center gap-1 disabled:opacity-50"
                  >
                    <Plus className="w-3 h-3" />
                    Adicionar
                  </button>
                </div>

                {formReceita.insumos.map(
                  (
                    ing,
                    i,
                  ) => (
                    <div
                      key={`${i}-${obterNomeInsumo(
                        ing,
                      )}`}
                      className="flex gap-2 items-center mb-2"
                    >
                      <input
                        required
                        value={
                          ing.nome ||
                          ''
                        }
                        onChange={(
                          e,
                        ) => {
                          const nv =
                            [
                              ...formReceita.insumos,
                            ];

                          nv[i] = {
                            ...nv[i],
                            nome:
                              e
                                .target
                                .value,
                          };

                          setFormReceita({
                            ...formReceita,
                            insumos:
                              nv,
                          });
                        }}
                        disabled={
                          salvandoReceita
                        }
                        className="flex-1 px-3 py-2 rounded-lg border border-zinc-300 text-sm"
                        placeholder="Nome do insumo"
                      />

                      <input
                        required
                        min="0"
                        type="number"
                        step="0.01"
                        value={
                          ing.quantidade ??
                          0
                        }
                        onChange={(
                          e,
                        ) => {
                          const nv =
                            [
                              ...formReceita.insumos,
                            ];

                          nv[i] = {
                            ...nv[i],
                            quantidade:
                              Number(
                                e
                                  .target
                                  .value,
                              ),
                          };

                          setFormReceita({
                            ...formReceita,
                            insumos:
                              nv,
                          });
                        }}
                        disabled={
                          salvandoReceita
                        }
                        className="w-24 px-3 py-2 rounded-lg border border-zinc-300 text-sm"
                        placeholder="Qtd"
                      />

                      <select
                        value={
                          ing.unidade ||
                          'kg'
                        }
                        onChange={(
                          e,
                        ) => {
                          const nv =
                            [
                              ...formReceita.insumos,
                            ];

                          nv[i] = {
                            ...nv[i],
                            unidade:
                              e
                                .target
                                .value,
                          };

                          setFormReceita({
                            ...formReceita,
                            insumos:
                              nv,
                          });
                        }}
                        disabled={
                          salvandoReceita
                        }
                        className="w-20 px-2 py-2 rounded-lg border border-zinc-300 text-sm"
                      >
                        <option value="kg">
                          Kg
                        </option>
                        <option value="g">
                          g
                        </option>
                        <option value="l">
                          L
                        </option>
                        <option value="ml">
                          ml
                        </option>
                        <option value="un">
                          un
                        </option>
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          const nv =
                            [
                              ...formReceita.insumos,
                            ];

                          nv.splice(
                            i,
                            1,
                          );

                          setFormReceita({
                            ...formReceita,
                            insumos:
                              nv,
                          });
                        }}
                        disabled={
                          salvandoReceita
                        }
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ),
                )}

                {formReceita.insumos
                  .length === 0 && (
                  <p className="text-xs text-zinc-400 italic">
                    Nenhum ingrediente
                    adicionado.
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() =>
                    setModalCrudOpen(
                      false,
                    )
                  }
                  disabled={
                    salvandoReceita
                  }
                  className="flex-1 py-2.5 rounded-xl border border-zinc-300 font-semibold text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    salvandoReceita
                  }
                  className="flex-1 py-2.5 rounded-xl bg-[#2e7a3d] hover:bg-[#1d5c28] text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {salvandoReceita ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Salvar Receita
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}