"use client";

import { ReceitasScreen } from '@/components/receitas-screen';
import React, { useState, useEffect, useCallback } from "react";
import { useEstoque } from '@/hooks/use-estoque';
import { useRegistrarProducao } from "@/hooks/use-erp";
import { EstoqueScreen } from '@/components/estoque-screen';
import { PdvScreen } from '@/components/pdv-screen';
import { KardexScreen } from '@/components/kardex-screen';
import { CaixaScreen } from '@/components/caixa-screen';
import ProdutoModal from '@/components/ProdutoModal';
import InsumoModal from '@/components/InsumoModal';
import { supabase } from '@/lib/supabase';
import { 
  ShoppingCart, Store, Package, DollarSign, Plus, Trash2, Edit2, 
  CheckCircle, AlertTriangle, Menu, X, ArrowUpRight, ArrowDownLeft, 
  RefreshCw, Lock, Unlock, ChevronRight, Search, Check, ChefHat, FileText, Download, Play
} from "lucide-react";

// ==========================================
// 1. CONTRATOS E TIPOS EXPORTADOS (STRICT)
// ==========================================

export type TabType = "pdv" | "caixa" | "produtos" | "estoque" | "receitas" | "kardex";

export interface IngredientRequirement {
  ingredientId: string;
  ingredientName: string;
  quantityNeeded: number;
  unit: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  icon?: string;
  recipe?: IngredientRequirement[];
  quantity?: number;
}

export interface StockItem {
  id: string;
  name: string;
  category?: string;
  quantity: number;
  minQuantity: number;
  unit: string;
  costPrice: number;
}

export interface RecipeIngredient {
  ingredientId: string;
  ingredientName: string;
  quantityNeeded: number;
  unit: string;
}

export interface Recipe {
  id: string;
  title: string;
  category: string;
  descriptionText?: string;
  yieldQuantity: number;
  yieldUnit: string;
  ingredients: RecipeIngredient[];
}

export interface ProductionLog {
  id: string;
  recipeId: string;
  recipeTitle: string;
  quantityProduced: number;
  timestamp: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Sale {
  id: string;
  timestamp: string;
  items: CartItem[];
  total: number;
  paymentMethod: "Pix" | "Cartão" | "Dinheiro" | string;
  cashReceived?: number;
  change?: number;
}

export interface CashMovement {
  id: string;
  type: "entrada" | "saida" | "venda" | "sangria" | "aporte" | "despesa";
  description: string;
  amount: number;
  paymentMethod?: string;
  timestamp: string;
}

export interface CashRegisterState {
  isOpen: boolean;
  openedAt: string | null;
  initialBalance: number;
  movements: CashMovement[];
  closedAt: string | null;
  finalBalance: number | null;
  reportedCash?: number;
  reportedCard?: number;
  reportedPix?: number;
  countedDrawerCash?: number;
  discrepancy?: number | null;
}

export type KardexMovementType = 
  | "PRODUÇÃO_ENTRADA" 
  | "PRODUÇÃO_SAÍDA_INSUMO" 
  | "VENDA_BALCÃO" 
  | "AJUSTE_MANUAL";

export interface KardexEntry {
  id: string;
  timestamp: string;
  itemId: string;
  itemName: string;
  type: KardexMovementType;
  quantityChange: number;
  balanceAfter: number;
  unit: string;
  referenceId?: string;
}

export interface SimulationSaleInput {
  items: { productId: string; quantity: number }[];
  paymentMethod: string;
}

export interface SimulationResult {
  success: boolean;
  saleId?: string;
  total?: number;
  message: string;
  timestamp: string;
}

// ==========================================
// 2. FUNÇÕES AUXILIARES E NORMALIZAÇÃO
// ==========================================

export function normalizarNome(nome: string): string {
  if (!nome) return '';
  return nome
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const normStr = (str: any): string =>
  String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

export const isSameItem = (nameA: string, nameB: string): boolean => {
  if (!nameA || !nameB) return false;
  const normA = normalizarNome(nameA);
  const normB = normalizarNome(nameB);
  if (!normA || !normB) return false;
  return normA === normB;
};

export function isItemMatch(
  targetId: string,
  targetName: string,
  stockItem: { id: string; name: string }
): boolean {
  if (!stockItem) return false;
  const tid = String(targetId || '').trim().toLowerCase();
  const sid = String(stockItem.id || '').trim().toLowerCase();

  if (tid && sid && tid === sid) return true;

  const tNorm = normalizarNome(targetName || targetId);
  const sNorm = normalizarNome(stockItem.name);

  if (!tNorm || !sNorm) return false;

  return tNorm === sNorm || tNorm.includes(sNorm) || sNorm.includes(tNorm);
}

export const normalizeIngredients = (rawList: any[]): RecipeIngredient[] => {
  if (!Array.isArray(rawList)) return [];
  return rawList.map((ing: any) => ({
    ingredientId: String(ing.ingredientId || ing.insumoId || ing.insumo_id || ing.id || ""),
    ingredientName: String(ing.ingredientName || ing.nome || ing.insumo || ing.name || "Insumo Sem Nome"),
    quantityNeeded: Number(ing.quantityNeeded ?? ing.quantidade ?? ing.quantidade_necessaria ?? ing.qtd ?? 0),
    unit: String(ing.unit || ing.unidade || "kg")
  }));
};

// ==========================================
// 3. COMPONENTE PRINCIPAL (CONTAINER SYSTEM)
// ==========================================

export default function Home() {
  const { stock: stockBanco = [] } = useEstoque();
  const { mutateAsync: registrarProducaoNoBanco } = useRegistrarProducao();
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("pdv");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Estado local sincronizado automaticamente com o banco via React Query
  const [stock, setStock] = useState<StockItem[]>([]);

  useEffect(() => {
    if (stockBanco && stockBanco.length > 0) {
      setStock(stockBanco as any);
    }
  }, [stockBanco]);

  const [products, setProducts] = useState<Product[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem("pl_products");
    return saved ? JSON.parse(saved) : [];
  });

  const [recipes, setRecipes] = useState<Recipe[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem("pl_recipes");
    return saved ? JSON.parse(saved) : [];
  });

  const [productionLogs, setProductionLogs] = useState<ProductionLog[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem("pl_production");
    return saved ? JSON.parse(saved) : [];
  });

  const [sales, setSales] = useState<Sale[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem("pl_sales");
    return saved ? JSON.parse(saved) : [];
  });

  const [kardex, setKardex] = useState<KardexEntry[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem("pl_kardex");
    return saved ? JSON.parse(saved) : [];
  });

  const [cashRegister, setCashRegister] = useState<CashRegisterState>(() => {
    const initial: CashRegisterState = { 
      isOpen: false, 
      openedAt: null, 
      initialBalance: 0, 
      movements: [], 
      closedAt: null, 
      finalBalance: null 
    };
    if (typeof window === "undefined") return initial;
    const saved = localStorage.getItem("pl_cash");
    return saved ? JSON.parse(saved) : initial;
  });

  const [cart, setCart] = useState<CartItem[]>([]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Sincronização LocalStorage
  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("pl_stock", JSON.stringify(stock));
      localStorage.setItem("pl_products", JSON.stringify(products));
      localStorage.setItem("pl_recipes", JSON.stringify(recipes));
      localStorage.setItem("pl_production", JSON.stringify(productionLogs));
      localStorage.setItem("pl_sales", JSON.stringify(sales));
      localStorage.setItem("pl_cash", JSON.stringify(cashRegister));
      localStorage.setItem("pl_kardex", JSON.stringify(kardex));
    }
  }, [stock, products, recipes, productionLogs, sales, cashRegister, kardex, isMounted]);

  // Carga e Normalização Inicial via Supabase com Fallback
  useEffect(() => {
    const fetchDadosBanco = async () => {
      try {
        if (typeof supabase === 'undefined' || !supabase) return;

        const [prodRes, recipeRes] = await Promise.all([
          supabase.from("produtos").select("*"),
          supabase.from("receitas").select("*")
        ]);

        if (prodRes.data && prodRes.data.length > 0) {
          setProducts(prodRes.data.map((p: any) => ({
            id: String(p.id),
            name: p.name || p.nome || "",
            category: p.category || p.categoria || "Geral",
            price: Number(p.price || p.preco || 0),
            unit: p.unit || p.unidade || "un",
            icon: p.icon || "🥖",
            quantity: Number(p.quantity ?? p.quantidade ?? 0),
            recipe: normalizeIngredients(p.recipe || p.receita || p.ficha_tecnica || [])
          })));
        }

        if (recipeRes.data && recipeRes.data.length > 0) {
          setRecipes(recipeRes.data.map((r: any) => ({
            id: String(r.id),
            title: r.title || r.titulo || r.nome || "",
            category: r.category || r.categoria || "Padaria",
            descriptionText: r.descriptionText || r.descricao || r.modo_preparo || "",
            yieldQuantity: Number(r.yieldQuantity ?? r.rendimento ?? 100),
            yieldUnit: r.yieldUnit || r.unidade_rendimento || "un",
            ingredients: normalizeIngredients(r.ingredients || r.ingredientes || [])
          })));
        }
      } catch (err) {
        console.warn("Aviso: Falha ao sincronizar com Supabase. Operando em modo offline.", err);
      }
    };

    fetchDadosBanco();
  }, []);

  // MÓDULO C: GERENCIADOR AUDITÁVEL DE KARDEX & ESTOQUE
  const registrarKardex = useCallback((
    itemId: string, 
    itemName: string, 
    type: KardexMovementType, 
    quantityChange: number, 
    balanceAfter: number, 
    unit: string, 
    referenceId?: string
  ) => {
    const entry: KardexEntry = {
      id: "kdx-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toLocaleString("pt-BR"),
      itemId,
      itemName,
      type,
      quantityChange,
      balanceAfter,
      unit,
      referenceId
    };
    setKardex(prev => [entry, ...prev]);
  }, []);

  // MÓDULO B & C: EXECUÇÃO ATÔMICA DA ORDEM DE PRODUÇÃO (BOM)
  const executarOrdemProducao = useCallback((recipe: Recipe, produceQty: number) => {
    if (produceQty <= 0) return;

    const ratio = produceQty / (recipe.yieldQuantity || 1);
    const nomeProdutoFinal = recipe.title.replace(/\(.*?\)/g, '').trim();
    const batchId = "OP-" + Date.now();

    const insumosDebitar = (recipe.ingredients || []).map(ing => ({
      id: ing.ingredientId,
      nome: ing.ingredientName,
      quantidade: Number((ing.quantityNeeded * ratio).toFixed(3))
    }));

    setStock((prevStock) => {
      let produtoFinalEncontrado = false;

      const novoEstoque = prevStock.map((item) => {
        let currentQty = item.quantity;
        let alterado = false;

        // 1. Débito das matérias-primas
        const debito = insumosDebitar.find(i => isItemMatch(i.id, i.nome, item));
        if (debito) {
          const newQty = Math.max(0, Number((currentQty - debito.quantidade).toFixed(3)));
          registrarKardex(item.id, item.name, "PRODUÇÃO_SAÍDA_INSUMO", -debito.quantidade, newQty, item.unit, batchId);
          currentQty = newQty;
          alterado = true;
        }

        // 2. Crédito do produto final
        const isFinal = isItemMatch(recipe.id, recipe.title, item) || isItemMatch(recipe.id, nomeProdutoFinal, item);
        if (isFinal) {
          produtoFinalEncontrado = true;
          const newQty = Number((currentQty + produceQty).toFixed(3));
          registrarKardex(item.id, item.name, "PRODUÇÃO_ENTRADA", produceQty, newQty, item.unit, batchId);
          currentQty = newQty;
          alterado = true;
        }

        // Atualiza a tabela no Supabase caso o item tenha sofrido alteração de saldo
        if (alterado) {
          supabase
            .from('estoque_itens')
            .update({ quantity: currentQty, saldo_atual: currentQty })
            .eq('id', item.id)
            .then(({ error }) => {
              if (error) console.error(`Erro ao atualizar banco para o item ${item.name}:`, error);
            });
        }

        return { ...item, quantity: currentQty };
      });

      // Se produto acabado não constava no estoque, efetua inserção
      if (!produtoFinalEncontrado) {
        const novoItem: StockItem = {
          id: recipe.id || `prod-${Date.now()}`,
          name: nomeProdutoFinal,
          category: recipe.category || "Produção",
          quantity: produceQty,
          minQuantity: 0,
          unit: recipe.yieldUnit || "un",
          costPrice: 0
        };
        novoEstoque.push(novoItem);
        registrarKardex(novoItem.id, novoItem.name, "PRODUÇÃO_ENTRADA", produceQty, produceQty, novoItem.unit, batchId);

        // Insere o novo produto acabado no Supabase
        supabase
  .from('estoque_itens')
  .insert({
    id: novoItem.id,
    nome: novoItem.name,
    tipo: "PRODUTO_FINAL",
    categoria: novoItem.category,
    quantity: produceQty,
    saldo_atual: produceQty,
    saldo_minimo: 0,
    unidade: novoItem.unit,
    ativo: true
  })
          .then(({ error }) => {
            if (error) console.error("Erro ao inserir novo produto acabado no banco:", error);
          });
      }

      return novoEstoque;
    });

    // Registra Log de Produção
    const newLog: ProductionLog = {
      id: batchId,
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      quantityProduced: produceQty,
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    };
    setProductionLogs(prev => [newLog, ...prev]);
    showToast(`Ordem de Produção ${batchId} executada com sucesso!`);
  }, [registrarKardex]);

  // MÓDULO A & C: PROCESSAMENTO DE VENDA NO PDV
  const processarVendaPDV = useCallback((sale: Sale) => {
    // 1. Grava histórico de vendas
    setSales(prev => [sale, ...prev]);

    // 2. Baixa atômica de produtos acabados / insumos no estoque
    setStock(prevStock => {
      return prevStock.map(stockItem => {
        let finalQty = stockItem.quantity;

        sale.items.forEach(cartItem => {
          if (isItemMatch(cartItem.product.id, cartItem.product.name, stockItem)) {
            finalQty = Math.max(0, Number((finalQty - cartItem.quantity).toFixed(3)));
            registrarKardex(
              stockItem.id, 
              stockItem.name, 
              "VENDA_BALCÃO", 
              -cartItem.quantity, 
              finalQty, 
              stockItem.unit, 
              sale.id
            );
          }
        });

        return { ...stockItem, quantity: finalQty };
      });
    });

    // 3. Atualiza caixa ativo
    if (cashRegister.isOpen) {
      const movement: CashMovement = {
        id: "mov-" + Date.now(),
        type: "venda",
        description: `Venda #${sale.id.slice(-4)} (${sale.paymentMethod})`,
        amount: sale.total,
        paymentMethod: sale.paymentMethod,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      setCashRegister(prev => ({
        ...prev,
        movements: [movement, ...prev.movements]
      }));
    }

    showToast(`Venda #${sale.id.slice(-4)} (R$ ${sale.total.toFixed(2)}) concluída!`);
  }, [cashRegister.isOpen, registrarKardex]);

  // MÓDULO D: HOOK E MOTOR DE SIMULAÇÃO DE BALCÃO (TEST SUITE INTEGRATION)
  const simularVendaBalcao = useCallback((input: SimulationSaleInput): SimulationResult => {
    if (!input.items || input.items.length === 0) {
      return { success: false, message: "A comanda simulada está vazia.", timestamp: new Date().toISOString() };
    }

    // Validação estrita de disponibilidade de estoque
    for (const itemInput of input.items) {
      const prod = products.find(p => p.id === itemInput.productId);
      const stockItem = stock.find(s => isItemMatch(itemInput.productId, prod?.name || '', s));
      
      const availableQty = stockItem ? stockItem.quantity : (prod?.quantity || 0);
      if (availableQty < itemInput.quantity) {
        return {
          success: false,
          message: `Estoque insuficiente para o item '${prod?.name || itemInput.productId}'. Disponível: ${availableQty}, Solicitado: ${itemInput.quantity}`,
          timestamp: new Date().toISOString()
        };
      }
    }

    // Monta a venda sintética
    const cartItems: CartItem[] = input.items.map(itemInput => {
      const prod = products.find(p => p.id === itemInput.productId) || {
        id: itemInput.productId,
        name: "Item Simulação",
        category: "Geral",
        price: 10.0,
        unit: "un"
      };
      return { product: prod, quantity: itemInput.quantity };
    });

    const totalCalculado = cartItems.reduce((acc, i) => acc + (i.product.price * i.quantity), 0);
    const saleId = "SIM-" + Date.now();

    const saleObject: Sale = {
      id: saleId,
      timestamp: new Date().toISOString(),
      items: cartItems,
      total: totalCalculado,
      paymentMethod: input.paymentMethod || "Pix"
    };

    processarVendaPDV(saleObject);

    return {
      success: true,
      saleId,
      total: totalCalculado,
      message: "Venda simulada processada e liquidada no estoque e caixa.",
      timestamp: new Date().toISOString()
    };
  }, [products, stock, processarVendaPDV]);

  // MÓDULO C: EXPORTAÇÃO EXECUTIVA DE RELATÓRIOS (1-CLICK CSV)
  const exportarRelatorioExecutivoCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "=== RELATÓRIO EXECUTIVO DE ESTOQUE E KARDEX ===\n";
    csvContent += "ID,Item,Categoria,Quantidade Atual,Unidade,Preco Custo\n";
    
    stock.forEach(s => {
      csvContent += `"${s.id}","${s.name}","${s.category || 'Geral'}",${s.quantity},"${s.unit}",${s.costPrice}\n`;
    });

    csvContent += "\n=== HISTÓRICO AUDITÁVEL DE MOVIMENTAÇÕES (KARDEX) ===\n";
    csvContent += "ID Mov,Data/Hora,ID Item,Nome Item,Tipo,Variacao,Saldo Resultante,Referencia\n";

    kardex.forEach(k => {
      csvContent += `"${k.id}","${k.timestamp}","${k.itemId}","${k.itemName}","${k.type}",${k.quantityChange},${k.balanceAfter},"${k.referenceId || ''}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Relatorio_Executivo_ERP_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Relatório CSV gerado e baixado com sucesso!");
  };

  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-[#f6e9d1]/30 text-zinc-900 font-sans flex flex-col md:flex-row antialiased">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#7a1f2e] text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-[#e8c079]/30 animate-bounce">
          <CheckCircle className="w-5 h-5 text-[#e8c079]" />
          <span className="font-medium text-sm">{toastMessage}</span>
        </div>
      )}

      {/* SIDEBAR DESKTOP */}
      <aside className="hidden md:flex flex-col w-64 bg-[#7a1f2e] text-white border-r border-[#7a1f2e]/20 shrink-0">
        <div className="p-6 border-b border-white/10 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🥖</span>
            <h1 className="text-xl font-bold tracking-tight text-white">Pão e Leite</h1>
          </div>
          <p className="text-xs text-[#e8c079] font-medium tracking-wide">Sistema ERP / PDV / BOM</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <SidebarButton 
            active={activeTab === "pdv"} 
            onClick={() => setActiveTab("pdv")} 
            icon={<ShoppingCart className="w-5 h-5" />} 
            label="Frente de Caixa (PDV)" 
          />
          <SidebarButton 
            active={activeTab === "estoque"} 
            onClick={() => setActiveTab("estoque")} 
            icon={<Package className="w-5 h-5" />} 
            label="Estoque Unificado" 
            badge={stock.some(s => s.quantity <= s.minQuantity) ? "Atenção" : undefined}
            badgeColor="bg-amber-500/20 text-amber-300"
          />
          <SidebarButton 
            active={activeTab === "receitas"} 
            onClick={() => setActiveTab("receitas")} 
            icon={<ChefHat className="w-5 h-5" />} 
            label="Receitas & Produção" 
          />
          <SidebarButton 
            active={activeTab === "caixa"} 
            onClick={() => setActiveTab("caixa")} 
            icon={<DollarSign className="w-5 h-5" />} 
            label="Fechamento de Caixa" 
            badge={cashRegister.isOpen ? "Aberto" : "Fechado"}
            badgeColor={cashRegister.isOpen ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}
          />
          <SidebarButton 
            active={activeTab === "kardex"} 
            onClick={() => setActiveTab("kardex")} 
            icon={<FileText className="w-5 h-5" />} 
            label="Auditoria Kardex" 
          />
        </nav>

        <div className="p-4 border-t border-white/10 text-xs text-white/60 text-center space-y-2">
          <button 
            onClick={exportarRelatorioExecutivoCSV}
            className="w-full py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </button>
          <p>Engine Core v3.0 · Pleno/Sênior</p>
        </div>
      </aside>

      {/* HEADER MOBILE */}
      <header className="md:hidden bg-[#7a1f2e] text-white p-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-xl">🥖</span>
          <div>
            <h1 className="font-bold text-lg leading-none">Pão e Leite</h1>
            <span className="text-[10px] text-[#e8c079]">ERP · PDV · Produção</span>
          </div>
        </div>
        <button type="button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 rounded-lg bg-white/10">
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* MENU MOBILE EXPANSÍVEL */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#7a1f2e] text-white px-4 pb-4 space-y-2 border-b border-white/10">
          <MobileNavButton active={activeTab === "pdv"} onClick={() => { setActiveTab("pdv"); setMobileMenuOpen(false); }} icon={<ShoppingCart className="w-5 h-5" />} label="PDV Vendas" />
          <MobileNavButton active={activeTab === "estoque"} onClick={() => { setActiveTab("estoque"); setMobileMenuOpen(false); }} icon={<Package className="w-5 h-5" />} label="Estoque" />
          <MobileNavButton active={activeTab === "receitas"} onClick={() => { setActiveTab("receitas"); setMobileMenuOpen(false); }} icon={<ChefHat className="w-5 h-5" />} label="Receitas & OP" />
          <MobileNavButton active={activeTab === "caixa"} onClick={() => { setActiveTab("caixa"); setMobileMenuOpen(false); }} icon={<DollarSign className="w-5 h-5" />} label="Caixa" />
          <MobileNavButton active={activeTab === "kardex"} onClick={() => { setActiveTab("kardex"); setMobileMenuOpen(false); }} icon={<FileText className="w-5 h-5" />} label="Kardex" />
        </div>
      )}

      {/* CONTEÚDO PRINCIPAL ROUTER */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-7xl mx-auto w-full">
        {activeTab === "pdv" && (
          <PdvScreen 
            products={products} 
            stock={stock} 
            cart={cart} 
            setCart={setCart} 
            cashRegister={cashRegister}
            onCompleteSale={processarVendaPDV}
          />
        )}

        {activeTab === "caixa" && (
          <CaixaScreen 
            cashRegister={cashRegister} 
            setCashRegister={setCashRegister} 
            sales={sales}
            showToast={showToast}
          />
        )}

        {activeTab === "estoque" && (
          <EstoqueScreen showToast={showToast} />
        )}

        {activeTab === "receitas" && (
          <ReceitasScreen 
            recipes={recipes} 
            setRecipes={setRecipes} 
            stock={stock}
            onExecutarOP={async (recipe: Recipe, produceQty: number) => {
              try {
                await registrarProducaoNoBanco({ 
                  produtoId: recipe.id, 
                  quantidade: produceQty 
                });
                showToast(`Ordem de Produção executada com sucesso!`);
              } catch (error: any) {
                alert(error.message); 
              }
            }}
            showToast={showToast}
          />
        )}

        {activeTab === "kardex" && (
          <KardexScreen 
            kardex={kardex} 
            onExport={exportarRelatorioExecutivoCSV}
            onSimularVenda={simularVendaBalcao}
            products={products}
          />
        )}
      </main>

    </div>
  );
}

// ==========================================
// 4. COMPONENTES AUXILIARES E NAVEGAÇÃO
// ==========================================

function SidebarButton({ active, onClick, icon, label, badge, badgeColor }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: string; badgeColor?: string;
}) {
  return (
    <button 
      type="button"
      onClick={onClick} 
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-medium text-sm ${
        active ? "bg-white text-[#7a1f2e] shadow-lg font-semibold" : "text-white/80 hover:bg-white/10 hover:text-white"
      }`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span>{label}</span>
      </div>
      {badge && (
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${badgeColor || "bg-white/20 text-white"}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function MobileNavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
        active ? "bg-white/20 text-white font-bold" : "text-white/80 hover:bg-white/10"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}