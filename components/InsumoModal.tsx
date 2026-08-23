'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface InsumoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function InsumoModal({
  isOpen,
  onClose,
  onSuccess,
}: InsumoModalProps) {
  const [nome, setNome] = useState('');
  const [unidade, setUnidade] = useState<'kg' | 'L' | 'un'>('kg');
  const [quantidade, setQuantidade] = useState('');
  const [minimo, setMinimo] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (loading) return;

    const nomeNormalizado = nome.trim();
    const quantidadeNumerica = Number(quantidade);
    const minimoNumerico = Number(minimo);

    if (!nomeNormalizado) {
      alert('Informe o nome do insumo.');
      return;
    }

    if (!Number.isFinite(quantidadeNumerica) || quantidadeNumerica < 0) {
      alert('Informe uma quantidade inicial válida.');
      return;
    }

    if (!Number.isFinite(minimoNumerico) || minimoNumerico < 0) {
      alert('Informe um estoque mínimo válido.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('estoque_itens')
        .insert([
          {
            nome: nomeNormalizado,
            unidade,
            quantidade: quantidadeNumerica,
            saldo_atual: quantidadeNumerica,
            quantidade_minima: minimoNumerico,
            saldo_minimo: minimoNumerico,
            tipo: 'INSUMO',
            ativo: true,
          },
        ]);

      if (error) {
        alert('Erro ao cadastrar insumo: ' + error.message);
        return;
      }

      setNome('');
      setQuantidade('');
      setMinimo('');

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro inesperado ao cadastrar insumo:', error);
      alert('Ocorreu um erro inesperado ao cadastrar o insumo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          Cadastrar Novo Insumo
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome do Insumo
            </label>

            <input
              type="text"
              required
              placeholder="Ex: Farinha de Trigo"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unidade
              </label>

              <select
                value={unidade}
                onChange={(e) =>
                  setUnidade(e.target.value as 'kg' | 'L' | 'un')
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white"
              >
                <option value="kg">Quilo (kg)</option>
                <option value="L">Litro (L)</option>
                <option value="un">Unidade (un)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Qtd. Inicial
              </label>

              <input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estoque Mínimo (Alerta)
            </label>

            <input
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="0"
              value={minimo}
              onChange={(e) => setMinimo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium shadow-md disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Salvar Insumo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}