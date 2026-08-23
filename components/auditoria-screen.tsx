"use client";

import React, { useState } from "react";
import { useHistorico } from "@/hooks/use-erp";
import { RefreshCw, ShieldCheck, ArrowDownRight, ArrowUpRight } from "lucide-react";

export function AuditoriaScreen() {
  const { data: historico = [], isLoading, refetch } = useHistorico();
  const [filtroTipo, setFiltroTipo] = useState<string>("TODOS");

  const filtrados = filtroTipo === "TODOS"
    ? historico
    : historico.filter(item => item.tipo_operacao === filtroTipo);

  const getBadgestyle = (tipo: string) => {
    switch (tipo) {
      case "PRODUCAO":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "VENDA_EXTERNA":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "IMPORTACAO_PLANILHA":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "PERDA_AVARIA":
        return "bg-rose-100 text-rose-800 border-rose-200";
      default:
        return "bg-zinc-100 text-zinc-700 border-zinc-200";
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#7a1f2e]" />
            <h1 className="text-2xl font-bold text-zinc-900">Trilha de Auditoria</h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Histórico imutável de movimentações registrado diretamente via triggers e RPCs do Postgres.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar Logs
        </button>
      </div>

      {/* FILTROS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {["TODOS", "PRODUCAO", "VENDA_EXTERNA", "IMPORTACAO_PLANILHA", "PERDA_AVARIA"].map((tipo) => (
          <button
            key={tipo}
            onClick={() => setFiltroTipo(tipo)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              filtroTipo === tipo
                ? "bg-[#7a1f2e] text-white"
                : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            {tipo.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* TABELA DE AUDITORIA */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-zinc-500">Carregando logs de auditoria...</div>
        ) : filtrados.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">Nenhum registro encontrado no histórico.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-100 text-xs font-semibold text-zinc-500 uppercase">
                <tr>
                  <th className="px-6 py-4">Data / Hora</th>
                  <th className="px-6 py-4">Item</th>
                  <th className="px-6 py-4">Operação</th>
                  <th className="px-6 py-4 text-right">Quantidade</th>
                  <th className="px-6 py-4 text-right">Saldo Resultante</th>
                  <th className="px-6 py-4">Origem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtrados.map((log) => {
                  const isEntrada = Number(log.quantidade) > 0;
                  return (
                    <tr key={log.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-6 py-4 text-xs font-mono text-zinc-500">
                        {new Date(log.criado_em).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-6 py-4 font-semibold text-zinc-800">
                        {log.estoque_itens?.nome || "Item Removido"}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold border ${getBadgestyle(log.tipo_operacao)}`}>
                          {log.tipo_operacao}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-right font-mono font-bold ${isEntrada ? "text-emerald-600" : "text-rose-600"}`}>
                        <span className="inline-flex items-center gap-1">
                          {isEntrada ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                          {isEntrada ? `+${log.quantidade}` : log.quantidade} {log.estoque_itens?.unidade}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-zinc-700 font-semibold">
                        {log.saldo_resultante} {log.estoque_itens?.unidade}
                      </td>
                      <td className="px-6 py-4 text-xs text-zinc-400 font-mono">
                        {log.origem || "sistema"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}