'use client';
import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportModal({ isOpen, onClose, onSuccess }: ImportModalProps) {
  const [csvText, setCsvText] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleImport = async () => {
    if (!csvText.trim()) return alert('Cole os dados da planilha antes de importar.');

    setLoading(true);
    const lines = csvText.trim().split('\n');

    // Formato esperado por linha: Nome; Preço; Unidade (un ou kg); CategoriaID; Emoji
    // Exemplo: Pão Francês; 12.90; kg; 1; 🥖
    const itemsToInsert = lines.map((line) => {
      const [nome, preco, unidade, categoriaId, emoji] = line.split(/;|,|\t/).map((s) => s.trim());
      
      const isKg = (unidade || '').toLowerCase().includes('kg');
      
      return {
        nome: nome || 'Produto sem nome',
        preco: parseFloat((preco || '0').replace(',', '.')) || 0,
        unidade: isKg ? 'kg' : 'un',
        categoria_id: parseInt(categoriaId || '1', 10),
        emoji: emoji || (isKg ? '⚖️' : '📦'),
      };
    });

    const { error } = await supabase.from('produtos').insert(itemsToInsert);

    setLoading(false);

    if (error) {
      alert('Erro na importação: ' + error.message);
    } else {
      alert(`${itemsToInsert.length} produtos importados com sucesso!`);
      setCsvText('');
      onSuccess();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-zinc-100 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-zinc-800">Importar Produtos em Massa (CSV)</h3>
          <p className="text-xs text-zinc-500 mt-1">
            Cole as linhas da sua planilha (Excel/Sheets) no formato abaixo:
          </p>
          <code className="block my-2 p-2 bg-zinc-100 rounded text-xs text-zinc-700">
            Nome; Preço; Unidade(un/kg); CategoriaID; Emoji
          </code>
        </div>

        <textarea
          rows={8}
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder={`Pão Francês; 12.50; kg; 1; 🥖\nCoxinha Frango; 6.50; un; 2; 🍗\nTorta Holandesa; 45.00; kg; 1; 🍰`}
          className="w-full p-3 border border-zinc-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#7a1f2e]"
        />

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-sm font-semibold"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={loading}
            className="px-4 py-2 bg-[#7a1f2e] text-white rounded-xl text-sm font-semibold shadow-md disabled:opacity-50"
          >
            {loading ? 'Processando...' : 'Importar Planilha'}
          </button>
        </div>
      </div>
    </div>
  );
}