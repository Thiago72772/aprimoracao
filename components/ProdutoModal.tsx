'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface ProdutoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ProdutoModal({
  isOpen,
  onClose,
  onSuccess,
}: ProdutoModalProps) {
  const [nome, setNome] = useState('');
  const [preco, setPreco] = useState('');
  const [categoriaId, setCategoriaId] = useState('1');
  const [unidade, setUnidade] = useState<'un' | 'kg' | 'fatia'>('un');
  const [emoji, setEmoji] = useState('🥖');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return;

    const nomeNormalizado = nome.trim();
    const precoNumerico = Number(preco);
    const categoriaIdNumerico = Number(categoriaId);
    const emojiNormalizado = emoji.trim();

    if (!nomeNormalizado) {
      alert('Informe o nome do produto.');
      return;
    }

    if (!Number.isFinite(precoNumerico) || precoNumerico < 0) {
      alert('Informe um preço válido maior ou igual a zero.');
      return;
    }

    if (
      !Number.isInteger(categoriaIdNumerico) ||
      categoriaIdNumerico <= 0
    ) {
      alert('Informe uma categoria válida.');
      return;
    }

    if (!emojiNormalizado) {
      alert('Informe um emoji para o produto.');
      return;
    }

    setLoading(true);

    try {
      // 1. Cadastra o produto
      const { data: produtoInserido, error: produtoError } = await supabase
        .from('produtos')
        .insert([
          {
            nome: nomeNormalizado,
            preco: precoNumerico,
            categoria_id: categoriaIdNumerico,
            unidade,
            emoji: emojiNormalizado,
          },
        ])
        .select('id')
        .single();

      if (produtoError) {
        alert('Erro ao cadastrar produto: ' + produtoError.message);
        return;
      }

      // 2. Sincroniza o produto com o estoque
      const { error: estoqueError } = await supabase
        .from('estoque_itens')
        .insert([
          {
            nome: nomeNormalizado,
            unidade,
            preco_custo: precoNumerico,
            saldo_atual: 0,
            tipo: 'PRODUTO_FINAL',
            ativo: true,
          },
        ]);

      if (estoqueError) {
        // Tenta desfazer o cadastro do produto para evitar
        // inconsistência entre as duas tabelas.
        if (produtoInserido?.id) {
          await supabase
            .from('produtos')
            .delete()
            .eq('id', produtoInserido.id);
        }

        alert(
          'O produto não pôde ser sincronizado com o estoque: ' +
            estoqueError.message
        );
        return;
      }

      // 3. Limpa o formulário após sucesso
      setNome('');
      setPreco('');
      setCategoriaId('1');
      setUnidade('un');
      setEmoji('🥖');

      onSuccess();
      onClose();
    } catch (error) {
      const mensagem =
        error instanceof Error
          ? error.message
          : 'Ocorreu um erro inesperado ao cadastrar o produto.';

      alert('Erro ao cadastrar produto: ' + mensagem);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="produto-modal-title"
        className="w-full max-w-md rounded-xl border border-gray-100 bg-white p-6 shadow-2xl"
      >
        <h2
          id="produto-modal-title"
          className="mb-4 text-xl font-bold text-gray-800"
        >
          Adicionar Produto
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="produto-nome"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Nome do Produto
            </label>

            <input
              id="produto-nome"
              type="text"
              required
              maxLength={150}
              placeholder="Ex: Pão Francês"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="produto-preco"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Preço (R$)
              </label>

              <input
                id="produto-preco"
                type="number"
                min="0"
                step="0.01"
                required
                placeholder="0.00"
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label
                htmlFor="produto-unidade"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Unidade
              </label>

              <select
                id="produto-unidade"
                value={unidade}
                onChange={(e) =>
                  setUnidade(e.target.value as 'un' | 'kg' | 'fatia')
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="un">Unidade</option>
                <option value="kg">Quilo (kg)</option>
                <option value="fatia">Fatia</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="produto-categoria"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Categoria ID
              </label>

              <input
                id="produto-categoria"
                type="number"
                min="1"
                step="1"
                required
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label
                htmlFor="produto-emoji"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Emoji
              </label>

              <input
                id="produto-emoji"
                type="text"
                required
                maxLength={10}
                placeholder="🥖"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-md hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Salvar Produto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}