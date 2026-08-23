"use client";

import { useState, useMemo } from "react";
import {
  Lock, Unlock, ArrowUpRight, ArrowDownLeft, DollarSign,
  AlertTriangle, CheckCircle, RefreshCw, Plus,
} from "lucide-react";
import type { CashRegisterState, CashMovement, Sale } from "@/app/page";

interface CaixaScreenProps {
  cashRegister: CashRegisterState;
  setCashRegister: React.Dispatch<React.SetStateAction<CashRegisterState>>;
  sales: Sale[];
  showToast: (msg: string) => void;
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function CaixaScreen({ cashRegister, setCashRegister, sales, showToast }: CaixaScreenProps) {
  const [initialBalanceInput, setInitialBalanceInput] = useState("");
  const [movType, setMovType] = useState<"sangria" | "aporte">("sangria");
  const [movAmount, setMovAmount] = useState("");
  const [movDescription, setMovDescription] = useState("");
  const [showClosing, setShowClosing] = useState(false);
  const [countedDrawerCashInput, setCountedDrawerCashInput] = useState("");

  // ==========================================
  // CÁLCULOS DERIVADOS DAS MOVIMENTAÇÕES
  // ==========================================
  const totals = useMemo(() => {
    const movements = cashRegister.movements || [];

    const vendasDinheiro = movements
      .filter(m => m.type === "venda" && m.paymentMethod === "Dinheiro")
      .reduce((sum, m) => sum + m.amount, 0);

    const vendasCartao = movements
      .filter(m => m.type === "venda" && m.paymentMethod === "Cartão")
      .reduce((sum, m) => sum + m.amount, 0);

    const vendasPix = movements
      .filter(m => m.type === "venda" && m.paymentMethod === "Pix")
      .reduce((sum, m) => sum + m.amount, 0);

    const sangrias = movements
      .filter(m => m.type === "sangria")
      .reduce((sum, m) => sum + m.amount, 0);

    const aportes = movements
      .filter(m => m.type === "aporte")
      .reduce((sum, m) => sum + m.amount, 0);

    const outrasEntradas = movements
      .filter(m => m.type === "entrada")
      .reduce((sum, m) => sum + m.amount, 0);

    const outrasSaidas = movements
      .filter(m => m.type === "saida" || m.type === "despesa")
      .reduce((sum, m) => sum + m.amount, 0);

    // Saldo esperado em dinheiro na gaveta física (só considera operações em espécie)
    const saldoEsperadoDinheiro =
      cashRegister.initialBalance + vendasDinheiro + aportes + outrasEntradas - sangrias - outrasSaidas;

    const totalVendas = vendasDinheiro + vendasCartao + vendasPix;

    return {
      vendasDinheiro, vendasCartao, vendasPix,
      sangrias, aportes, outrasEntradas, outrasSaidas,
      saldoEsperadoDinheiro, totalVendas,
    };
  }, [cashRegister.movements, cashRegister.initialBalance]);

  // ==========================================
  // AÇÕES
  // ==========================================
  const abrirCaixa = () => {
    const valor = Number(initialBalanceInput.replace(",", "."));
    if (isNaN(valor) || valor < 0) return showToast("Informe um saldo inicial válido.");

    setCashRegister({
      isOpen: true,
      openedAt: new Date().toLocaleString("pt-BR"),
      initialBalance: valor,
      movements: [],
      closedAt: null,
      finalBalance: null,
      reportedCash: undefined,
      reportedCard: undefined,
      reportedPix: undefined,
      countedDrawerCash: undefined,
      discrepancy: null,
    });
    setInitialBalanceInput("");
    showToast("Caixa aberto com sucesso!");
  };

  const lancarMovimento = () => {
    const valor = Number(movAmount.replace(",", "."));
    if (isNaN(valor) || valor <= 0) return showToast("Informe um valor válido.");
    if (!movDescription.trim()) return showToast("Descreva o motivo do lançamento.");

    const movement: CashMovement = {
      id: "mov-" + Date.now(),
      type: movType,
      description: movDescription.trim(),
      amount: valor,
      paymentMethod: "Dinheiro",
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };

    setCashRegister(prev => ({ ...prev, movements: [movement, ...prev.movements] }));
    setMovAmount("");
    setMovDescription("");
    showToast(`${movType === "sangria" ? "Sangria" : "Aporte"} de R$ ${fmt(valor)} lançado(a).`);
  };

  const confirmarFechamento = () => {
    const contado = Number(countedDrawerCashInput.replace(",", "."));
    if (isNaN(contado) || contado < 0) return showToast("Informe o valor contado na gaveta.");

    const discrepancy = Number((contado - totals.saldoEsperadoDinheiro).toFixed(2));

    setCashRegister(prev => ({
      ...prev,
      isOpen: false,
      closedAt: new Date().toLocaleString("pt-BR"),
      finalBalance: contado,
      reportedCash: totals.vendasDinheiro,
      reportedCard: totals.vendasCartao,
      reportedPix: totals.vendasPix,
      countedDrawerCash: contado,
      discrepancy,
    }));

    setShowClosing(false);
    setCountedDrawerCashInput("");
    showToast(
      discrepancy === 0
        ? "Caixa fechado sem divergências!"
        : `Caixa fechado com divergência de R$ ${fmt(Math.abs(discrepancy))} (${discrepancy > 0 ? "sobra" : "falta"}).`
    );
  };

  // ==========================================
  // TELA: CAIXA FECHADO (SEM ABERTURA ATIVA)
  // ==========================================
  if (!cashRegister.isOpen) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-zinc-100 flex items-center justify-center">
            <Lock className="w-6 h-6 text-zinc-500" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900 text-lg">Caixa Fechado</h3>
            <p className="text-xs text-zinc-500 mt-1">Informe o saldo inicial (fundo de troco) para abrir o turno.</p>
          </div>

          <input
            type="text"
            inputMode="decimal"
            value={initialBalanceInput}
            onChange={e => setInitialBalanceInput(e.target.value)}
            placeholder="0,00"
            className="w-full px-4 py-3 bg-zinc-50 border rounded-xl text-center text-lg font-bold text-zinc-800"
          />

          <button
            onClick={abrirCaixa}
            className="w-full px-5 py-3 bg-[#7a1f2e] text-white rounded-xl font-semibold text-sm flex items-center gap-2 justify-center"
          >
            <Unlock className="w-4 h-4" /> Abrir Caixa
          </button>
        </div>

        {cashRegister.closedAt && (
          <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm space-y-2">
            <h4 className="font-bold text-zinc-900 text-sm">Último Fechamento</h4>
            <p className="text-xs text-zinc-500">{cashRegister.closedAt}</p>
            <div className="grid grid-cols-2 gap-2 text-xs pt-2">
              <div className="bg-zinc-50 rounded-lg p-2">
                <p className="text-zinc-400">Contado</p>
                <p className="font-bold text-zinc-800">R$ {fmt(cashRegister.finalBalance || 0)}</p>
              </div>
              <div className={`rounded-lg p-2 ${cashRegister.discrepancy === 0 ? "bg-emerald-50" : "bg-rose-50"}`}>
                <p className={cashRegister.discrepancy === 0 ? "text-emerald-600" : "text-rose-600"}>Divergência</p>
                <p className={`font-bold ${cashRegister.discrepancy === 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  R$ {fmt(cashRegister.discrepancy || 0)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // TELA: CAIXA ABERTO
  // ==========================================
  return (
    <div className="space-y-6">
      {/* HEADER STATUS */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center">
            <Unlock className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-bold text-zinc-900 text-sm">Caixa Aberto</p>
            <p className="text-xs text-zinc-500">Desde {cashRegister.openedAt}</p>
          </div>
        </div>
        <button
          onClick={() => setShowClosing(true)}
          className="px-4 py-2 bg-zinc-900 text-white rounded-xl font-semibold text-xs flex items-center gap-2"
        >
          <Lock className="w-3.5 h-3.5" /> Fechar Caixa
        </button>
      </div>

      {/* PAINEL DE FECHAMENTO */}
      {showClosing && (
        <div className="bg-white p-6 rounded-2xl border-2 border-zinc-900 shadow-sm space-y-4">
          <h3 className="font-bold text-zinc-900">Conferência de Fechamento</h3>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="bg-zinc-50 rounded-lg p-3">
              <p className="text-zinc-400">Dinheiro (sistema)</p>
              <p className="font-bold text-zinc-800 text-sm">R$ {fmt(totals.saldoEsperadoDinheiro)}</p>
            </div>
            <div className="bg-zinc-50 rounded-lg p-3">
              <p className="text-zinc-400">Cartão (sistema)</p>
              <p className="font-bold text-zinc-800 text-sm">R$ {fmt(totals.vendasCartao)}</p>
            </div>
            <div className="bg-zinc-50 rounded-lg p-3">
              <p className="text-zinc-400">Pix (sistema)</p>
              <p className="font-bold text-zinc-800 text-sm">R$ {fmt(totals.vendasPix)}</p>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-600">Valor contado na gaveta (dinheiro físico)</label>
            <input
              type="text"
              inputMode="decimal"
              value={countedDrawerCashInput}
              onChange={e => setCountedDrawerCashInput(e.target.value)}
              placeholder="0,00"
              className="w-full mt-1 px-4 py-2 bg-zinc-50 border rounded-xl font-bold"
            />
          </div>

          <div className="flex gap-2">
            <button onClick={confirmarFechamento} className="flex-1 px-4 py-2.5 bg-[#7a1f2e] text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4" /> Confirmar Fechamento
            </button>
            <button onClick={() => setShowClosing(false)} className="px-4 py-2.5 bg-zinc-100 rounded-xl font-semibold text-xs">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* RESUMO DE TOTAIS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
          <p className="text-[10px] text-zinc-400 uppercase font-bold">Saldo Inicial</p>
          <p className="font-bold text-zinc-900 text-lg">R$ {fmt(cashRegister.initialBalance)}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
          <p className="text-[10px] text-zinc-400 uppercase font-bold">Total Vendas</p>
          <p className="font-bold text-zinc-900 text-lg">R$ {fmt(totals.totalVendas)}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
          <p className="text-[10px] text-zinc-400 uppercase font-bold">Sangrias</p>
          <p className="font-bold text-rose-600 text-lg">- R$ {fmt(totals.sangrias)}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
          <p className="text-[10px] text-zinc-400 uppercase font-bold">Dinheiro Esperado</p>
          <p className="font-bold text-emerald-600 text-lg">R$ {fmt(totals.saldoEsperadoDinheiro)}</p>
        </div>
      </div>

      {/* LANÇAMENTO RÁPIDO: SANGRIA / APORTE */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm space-y-3">
        <h3 className="font-bold text-zinc-900 text-sm flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-[#7a1f2e]" /> Lançamento de Sangria / Aporte
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setMovType("sangria")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${movType === "sangria" ? "bg-rose-100 text-rose-700" : "bg-zinc-100 text-zinc-500"}`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" /> Sangria (retirada)
          </button>
          <button
            onClick={() => setMovType("aporte")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${movType === "aporte" ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" /> Aporte (reforço)
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={movAmount}
            onChange={e => setMovAmount(e.target.value)}
            placeholder="Valor (R$)"
            className="w-full sm:w-32 px-3 py-2 bg-zinc-50 border rounded-xl text-xs font-bold"
          />
          <input
            type="text"
            value={movDescription}
            onChange={e => setMovDescription(e.target.value)}
            placeholder="Motivo (ex: pagamento fornecedor, reforço de troco...)"
            className="flex-1 px-3 py-2 bg-zinc-50 border rounded-xl text-xs"
          />
          <button
            onClick={lancarMovimento}
            className="px-4 py-2 bg-zinc-900 text-white rounded-xl font-semibold text-xs flex items-center gap-1.5 justify-center"
          >
            <Plus className="w-3.5 h-3.5" /> Lançar
          </button>
        </div>
      </div>

      {/* HISTÓRICO DE MOVIMENTAÇÕES DO TURNO */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-3">
        <h3 className="font-bold text-zinc-900 text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Movimentações do Turno
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b bg-zinc-50 text-zinc-500 uppercase font-bold">
                <th className="p-3">Hora</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Descrição</th>
                <th className="p-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {cashRegister.movements.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-zinc-400">Nenhuma movimentação neste turno ainda.</td>
                </tr>
              ) : (
                cashRegister.movements.map(m => {
                  const isSaida = m.type === "sangria" || m.type === "saida" || m.type === "despesa";
                  return (
                    <tr key={m.id} className="hover:bg-zinc-50/50">
                      <td className="p-3 font-mono text-zinc-500">{m.timestamp}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${isSaida ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>
                          {m.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3 text-zinc-700">{m.description}{m.paymentMethod ? ` · ${m.paymentMethod}` : ""}</td>
                      <td className={`p-3 text-right font-bold ${isSaida ? "text-rose-600" : "text-emerald-600"}`}>
                        {isSaida ? "-" : "+"} R$ {fmt(m.amount)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(totals.saldoEsperadoDinheiro < 0) && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Saldo em dinheiro está negativo — confira se alguma sangria excedeu o valor disponível.
        </div>
      )}
    </div>
  );
}
