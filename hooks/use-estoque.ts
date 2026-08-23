'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface Insumo {
  id: string;
  nome: string;
  unidade: string;
  quantidade: number;
  minimo: number;
  custoUnitario?: number;
}

export function useEstoque() {
  const queryClient = useQueryClient();
  // Nome da sua tabela no banco de dados
  const TABLE_NAME = 'estoque';

  const { data: stock = [], isLoading, error } = useQuery({
    queryKey: ['estoque'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('ativo', true) // <-- ADICIONADO: Filtra apenas os itens ativos (Soft Delete)
        .order('nome', { ascending: true });

      if (error) throw error;

      return (data || []).map((item) => ({
        id: item.id,
        nome: item.nome,
        unidade: item.unidade,
        quantidade: Number(item.quantidade || 0),
        minimo: Number(item.quantidade_minima || 0),
        custoUnitario: Number(item.preco_custo || 0),
        tipo: item.tipo || 'INSUMO', // <-- ADICIONADO: Garante que o tipo retorne do banco para a UI separar as abas
      }));
    },
  });

  // 2. Adicionar Novo Item
  // 2. Adicionar Novo Item
  const addInsumoMutation = useMutation({
    mutationFn: async (novoItem: Omit<Insumo, 'id'>) => {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .insert([
          {
            tipo: (novoItem as any).tipo || 'INSUMO',
            nome: novoItem.nome,
            unidade: novoItem.unidade,
            quantidade: novoItem.quantidade,
            saldo_atual: novoItem.quantidade,
            quantidade_minima: novoItem.minimo,
            saldo_minimo: novoItem.minimo,
            preco_custo: novoItem.custoUnitario || 0,
            categoria: 'Insumos',
            ativo: true,
          },
        ])
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque'] });
    },
  });

  // 3. Atualizar Item Existente
  const updateInsumoMutation = useMutation({
    mutationFn: async ({ id, ...dados }: Partial<Insumo> & { id: string }) => {
      const payload: Record<string, any> = {};
      if ((dados as any).tipo !== undefined) payload.tipo = (dados as any).tipo;
      if (dados.nome !== undefined) payload.nome = dados.nome;
      if (dados.unidade !== undefined) payload.unidade = dados.unidade;
      if (dados.quantidade !== undefined) {
        payload.quantidade = dados.quantidade;
        payload.saldo_atual = dados.quantidade;
      }
      if (dados.minimo !== undefined) {
        payload.quantidade_minima = dados.minimo;
        payload.saldo_minimo = dados.minimo;
      }
      if (dados.custoUnitario !== undefined) payload.preco_custo = dados.custoUnitario;

      const { error } = await supabase
        .from(TABLE_NAME)
        .update(payload)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque'] });
    },
  });

  // 4. Remover Item (Agora é Soft Delete / Arquivamento)
  const deleteInsumoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from(TABLE_NAME)
        .update({ ativo: false }) // <-- MODIFICADO: Não apaga mais, apenas oculta
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque'] });
    },
  });

  // 5. Movimentar Estoque (Entrada ou Saída)
  const movimentarEstoqueMutation = useMutation({
    mutationFn: async ({
      id,
      quantidade,
      tipo,
    }: {
      id: string;
      quantidade: number;
      tipo: 'entrada' | 'saida';
    }) => {
      const itemAtual = stock.find((i) => i.id === id);
      if (!itemAtual) throw new Error('Item não encontrado.');

      const novaQtd =
        tipo === 'entrada'
          ? itemAtual.quantidade + quantidade
          : Math.max(0, itemAtual.quantidade - quantidade);

      const { error: updateError } = await supabase
        .from(TABLE_NAME)
        .update({ quantidade: novaQtd })
        .eq('id', id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque'] });
    },
  });

  // 6. Importar Insumos em Lote
  const importarInsumosMutation = useMutation({
    mutationFn: async (itens: Omit<Insumo, 'id'>[]) => {
      const payload = itens.map((item) => ({
        nome: item.nome,
        unidade: item.unidade,
        quantidade: item.quantidade,
        saldo_atual: item.quantidade,
        quantidade_minima: item.minimo,
        saldo_minimo: item.minimo,
        preco_custo: item.custoUnitario || 0,
        categoria: 'Insumos',
        ativo: true, // <-- ADICIONADO
        tipo: (item as any).tipo || 'INSUMO' // <-- ADICIONADO: Respeita a aba onde a importação foi feita
      }));

      const { error } = await supabase.from(TABLE_NAME).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque'] });
    },
  });

  return {
    stock,
    isLoading,
    error,
    addInsumo: (novo: Omit<Insumo, 'id'>) => addInsumoMutation.mutateAsync(novo),
    updateInsumo: (id: string, dados: Partial<Insumo>) => updateInsumoMutation.mutateAsync({ id, ...dados }),
    deleteInsumo: (id: string) => deleteInsumoMutation.mutateAsync(id),
    movimentarEstoque: (id: string, quantidade: number, tipo: 'entrada' | 'saida') =>
      movimentarEstoqueMutation.mutateAsync({ id, quantidade, tipo }),
    importarInsumos: (itens: Omit<Insumo, 'id'>[]) => importarInsumosMutation.mutateAsync(itens),
  };
}