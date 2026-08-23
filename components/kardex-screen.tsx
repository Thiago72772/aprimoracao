"use client";

import { useState } from "react";
import { Play, Download } from "lucide-react";
import type {
  KardexEntry,
  SimulationSaleInput,
  SimulationResult,
  Product,
} from "@/app/page";

// ==========================================
// 8. MÓDULO C & D: AUDITORIA KARDEX & TEST SUITE
// ==========================================

export function KardexScreen({ kardex, onExport, onSimularVenda, products }: {
  kardex: KardexEntry[];
  onExport: () => void;
  onSimularVenda: (input: SimulationSaleInput) => SimulationResult;
  products: Product[];
}) {
  const [selectedProdId, setSelectedProdId] = useState("");
  const [simQty, setSimQty] = useState(5);
  const [lastSimResult, setLastSimResult] = useState<SimulationResult | null>(null);

  const handleRunSimulation = () => {
    if (!selectedProdId) return alert("Selecione um produto para simular.");
    const res = onSimularVenda({
      items: [{ productId: selectedProdId, quantity: simQty }],
      paymentMethod: "Pix"
    });
    setLastSimResult(res);
  };

  return (
    <div className="space-y-6">
      {/* SIMULADOR DE TESTES (MODULE D HOOK) */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-zinc-900 flex items-center gap-2">
              <Play className="w-5 h-5 text-[#7a1f2e]" /> Simulador de Balcão (Suite de Teste PDV)
            </h3>
            <p className="text-xs text-zinc-500">Valida estoque ativo, executa baixa instantânea e gera log de auditoria Kardex.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <select 
            value={selectedProdId} 
            onChange={e => setSelectedProdId(e.target.value)}
            className="flex-1 px-3 py-2 bg-zinc-50 border rounded-xl text-xs font-semibold text-zinc-800"
          >
            <option value="">Selecione um produto do catálogo...</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name} (R$ {p.price.toFixed(2)})</option>
            ))}
          </select>
          <input 
            type="number" 
            value={simQty} 
            onChange={e => setSimQty(Number(e.target.value))}
            className="w-24 px-3 py-2 bg-zinc-50 border rounded-xl text-xs font-bold"
            placeholder="Qtd"
          />
          <button 
            onClick={handleRunSimulation}
            className="px-5 py-2 bg-[#7a1f2e] text-white rounded-xl font-semibold text-xs flex items-center gap-2 justify-center"
          >
            Disparar Simulação
          </button>
        </div>

        {lastSimResult && (
          <div className={`p-3 rounded-xl text-xs font-mono border ${lastSimResult.success ? "bg-emerald-50 text-emerald-900 border-emerald-200" : "bg-rose-50 text-rose-900 border-rose-200"}`}>
            <p className="font-bold">{lastSimResult.success ? "SUCCESS" : "ERROR"}: {lastSimResult.message}</p>
            {lastSimResult.saleId && <p>ID Venda: {lastSimResult.saleId} | Total: R$ {lastSimResult.total?.toFixed(2)}</p>}
          </div>
        )}
      </div>

      {/* KARDEX AUDIT TABLE */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-zinc-900 text-lg">Livro Kardex - Histórico Auditável</h3>
          <button onClick={onExport} className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> Baixar Kardex (CSV)
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b bg-zinc-50 text-zinc-500 uppercase font-bold">
                <th className="p-3">Data/Hora</th>
                <th className="p-3">Item</th>
                <th className="p-3">Tipo de Operação</th>
                <th className="p-3 text-right">Qtd Movimentada</th>
                <th className="p-3 text-right">Saldo Final</th>
                <th className="p-3">Ref ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {kardex.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-zinc-400">Nenhum evento Kardex registrado até o momento.</td>
                </tr>
              ) : (
                kardex.map(entry => (
                  <tr key={entry.id} className="hover:bg-zinc-50/50">
                    <td className="p-3 font-mono text-zinc-500">{entry.timestamp}</td>
                    <td className="p-3 font-semibold text-zinc-800">{entry.itemName}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        entry.type.includes("ENTRADA") ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {entry.type}
                      </span>
                    </td>
                    <td className={`p-3 text-right font-bold ${entry.quantityChange >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {entry.quantityChange > 0 ? `+${entry.quantityChange}` : entry.quantityChange} {entry.unit}
                    </td>
                    <td className="p-3 text-right font-bold text-zinc-900">{entry.balanceAfter} {entry.unit}</td>
                    <td className="p-3 font-mono text-zinc-400">{entry.referenceId || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
