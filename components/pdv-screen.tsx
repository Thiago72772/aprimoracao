'use client';

import { supabase } from '@/lib/supabase';
import * as React from 'react';
import { useQuery } from '@tanstack/react-query'; // ADICIONADO: Para buscar produtos do banco
import { 
  Minus, 
  Plus, 
  Trash2, 
  ShoppingCart, 
  X, 
  Search, 
  Barcode, 
  Tag, 
  User, 
  CreditCard, 
  Banknote, 
  QrCode, 
  CheckCircle2
} from 'lucide-react';

import { cn } from '@/lib/utils';
// REMOVIDO: produtos, CATEGORIAS do mock. Mantemos apenas os tipos e a formatação.
import {
  formatarMoeda,
  type Produto,
  type Categoria,
  type FormaPagamento,
} from '@/lib/mock-data';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';


function normalizarNome(nome: string): string {
  if (!nome) return '';
  return nome
    .toLowerCase()
    .replace(/\(.*?\)/g, '') // Remove textos entre parênteses como (Fornada de 100un)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]/g, ' ') // Remove caracteres especiais
    .replace(/\s+/g, ' ') // Limpa espaços duplicados
    .trim();
}

// ============================================================================
// 1. TIPAGENS DO CARRINHO (Alinhadas ao domínio)
// ============================================================================

export interface ItemCarrinho {
  id_item_carrinho: string; // ID único para a linha do carrinho
  produto: Produto;
  quantidade: number;
}

interface ResumoVenda {
  subtotal: number;
  total: number;
  valorRecebido: number;
  troco: number;
}

// ============================================================================
// 2. COMPONENTE PRINCIPAL (PDV)
// ============================================================================

export function PdvScreen({ products = [], stock, setStock, showToast, ...outrosProps }: any) {
  const isMobile = useIsMobile();

  

  // Estados Globais do PDV
  const [carrinho, setCarrinho] = React.useState<ItemCarrinho[]>([]);
  const [pagamento, setPagamento] = React.useState<FormaPagamento>('pix');
  const [sheetOpen, setSheetOpen] = React.useState(false);
  
  // Estados de Filtro e Busca
  const [termoBusca, setTermoBusca] = React.useState('');
  const [categoriaAtiva, setCategoriaAtiva] = React.useState<Categoria | 'Todos'>('Todos');

  // Estados Financeiros Adicionais
  const [valorRecebido, setValorRecebido] = React.useState<string>('');

  // ==========================================================================
  // CÁLCULOS FINANCEIROS DO CARRINHO
  // ==========================================================================
  const totalItens = carrinho.reduce((acc, i) => acc + i.quantidade, 0);
  
  const subtotal = carrinho.reduce(
    (acc, item) => acc + (item.produto.preco * item.quantidade), 
    0
  );

  const totalFinal = subtotal;
  
  const valorRecebidoNum = parseFloat(valorRecebido.replace(',', '.')) || 0;
  const troco = pagamento === 'dinheiro' && valorRecebidoNum > totalFinal 
    ? valorRecebidoNum - totalFinal 
    : 0;

  const resumo: ResumoVenda = {
    subtotal,
    total: totalFinal,
    valorRecebido: valorRecebidoNum,
    troco
  };

  // ==========================================================================
  // HANDLERS E AÇÕES
  // ==========================================================================
  
  function adicionar(produto: Produto) {
    setCarrinho((prev) => {
      const existenteIndex = prev.findIndex((i) => i.produto.id === produto.id);
      
      if (existenteIndex >= 0) {
        const novoCarrinho = [...prev];
        novoCarrinho[existenteIndex] = { 
          ...novoCarrinho[existenteIndex], 
          quantidade: novoCarrinho[existenteIndex].quantidade + 1 
        };
        return novoCarrinho;
      }
      
      return [...prev, { 
        id_item_carrinho: `${produto.id}-${Date.now()}`,
        produto, 
        quantidade: 1 
      }];
    });
  }

  function alterarQuantidade(idItemCarrinho: string, delta: number) {
    setCarrinho((prev) =>
      prev
        .map((i) =>
          i.id_item_carrinho === idItemCarrinho
            ? { ...i, quantidade: i.quantidade + delta }
            : i
        )
        .filter((i) => i.quantidade > 0)
    );
  }

  function remover(idItemCarrinho: string) {
    setCarrinho((prev) => prev.filter((i) => i.id_item_carrinho !== idItemCarrinho));
  }

  function limparCarrinho() {
    if (window.confirm('Tem certeza que deseja cancelar esta venda e limpar o carrinho?')) {
      setCarrinho([]);
      setValorRecebido('');
      setSheetOpen(false);
    }
  }

  async function finalizar() {
    if (carrinho.length === 0) return;

    if (pagamento === 'dinheiro' && valorRecebidoNum < totalFinal) {
      alert(`Valor recebido (R$ ${valorRecebidoNum.toFixed(2)}) é menor que o total da venda (R$ ${totalFinal.toFixed(2)}).`);
      return;
    }

    try {
      // 1. Processa cada item do carrinho e dá baixa no estoque real
      for (const item of carrinho) {
        const nomeItemCarrinho = normalizarNome(item.produto.nome);

        // Procura no estoque global (tabela estoque_itens)
        const itemEstoque = stock?.find((s: any) => {
          const nomeEstoque = normalizarNome(s.nome);
          return s.nome === item.produto.nome || nomeEstoque === nomeItemCarrinho;
        });

        if (itemEstoque) {
          // Usa o saldo_atual que é o campo verdadeiro da sua tabela
          const novaQtd = Math.max(0, (itemEstoque.saldo_atual || 0) - item.quantidade);

          // Atualiza a tabela correta no Supabase
          await supabase
            .from('estoque_itens')
            .update({ saldo_atual: novaQtd })
            .eq('id', itemEstoque.id);

          // Atualiza estado local
          if (setStock) {
            setStock((prev: any[]) =>
              prev.map((s) => (s.id === itemEstoque.id ? { ...s, saldo_atual: novaQtd } : s))
            );
          }
        }
      }

      if (showToast) {
        showToast(`Venda de R$ ${totalFinal.toFixed(2)} finalizada e estoque atualizado!`);
      }
    } catch (error) {
      console.error('Erro ao dar baixa no estoque:', error);
    }

    // 2. Limpa a comanda/carrinho
    setCarrinho([]);
    setValorRecebido('');
    setSheetOpen(false);
  }

  // ==========================================================================
  // FILTRAGEM DE PRODUTOS
  // ==========================================================================
  
  // Adaptamos os produtos que vieram do page.tsx para o formato que esta tela espera
  const produtosReais = React.useMemo(() => {
    return products.map((p: any) => ({
      id: p.id,
      nome: p.name || p.nome,
      preco: p.price || p.preco,
      unidade: p.unit || p.unidade,
      categoria: p.category || p.categoria,
      emoji: p.icon || p.emoji || '📦',
      ativo: true
    }));
  }, [products]);

  // Extrai as categorias reais dinamicamente
  const categoriasDinamicas = React.useMemo(() => {
    const cats = new Set(produtosReais.map((p: any) => p.categoria).filter(Boolean));
    return Array.from(cats) as Categoria[];
  }, [produtosReais]);

  // Filtra usando a lista real
  const produtosFiltrados = React.useMemo(() => {
    return produtosReais.filter((p: any) => {
      if (!p.ativo) return false;
      const matchCategoria = categoriaAtiva === 'Todos' || p.categoria === categoriaAtiva;
      const matchBusca = p.nome.toLowerCase().includes(termoBusca.toLowerCase());
      return matchCategoria && matchBusca;
    });
  }, [termoBusca, categoriaAtiva, produtosReais]);

  // ==========================================================================
  // RENDERIZAÇÃO
  // ==========================================================================

  const painelCarrinhoProps = {
    carrinho,
    pagamento,
    setPagamento,
    resumo,
    valorRecebido,
    setValorRecebido,
    onAlterar: alterarQuantidade,
    onRemover: remover,
    onLimpar: limparCarrinho,
    onFinalizar: finalizar,
  };

  if (isMobile) {
    return (
      <div className="flex flex-col gap-4 p-4 min-h-[calc(100vh-80px)]">
        <div className="flex flex-col gap-3 sticky top-0 bg-background/95 backdrop-blur z-20 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar pão, café, bolo..." 
              className="pl-9 h-12 bg-card border-muted shadow-sm rounded-xl text-base"
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
            />
            {termoBusca && (
              <button onClick={() => setTermoBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <CategoriaSelector 
  categoriaAtiva={categoriaAtiva} 
  setCategoriaAtiva={setCategoriaAtiva} 
  categorias={categoriasDinamicas} 
/>
        </div>

        <ProductGrid produtos={produtosFiltrados} onAdicionar={adicionar} />
        
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button 
              className={cn(
                "fixed inset-x-4 bottom-20 z-30 h-14 justify-between shadow-xl transition-all duration-300 rounded-xl",
                carrinho.length === 0 ? "translate-y-24 opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <ShoppingCart className="h-5 w-5" />
                  <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground text-[10px] font-bold border-2 border-primary">
                    {totalItens}
                  </span>
                </div>
                <span className="font-semibold text-base">Ver Carrinho</span>
              </div>
              <span className="text-lg font-bold">{formatarMoeda(resumo.total)}</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[90vh] h-[90vh] flex flex-col p-0 rounded-t-2xl">
            <SheetHeader className="p-4 border-b shrink-0 text-left">
              <SheetTitle className="flex items-center gap-2 text-xl">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Carrinho de Venda
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-4">
              <CarrinhoPanel {...painelCarrinhoProps} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_450px] gap-6 h-full p-6">
      <div className="flex flex-col gap-4 h-full overflow-hidden">
        <Card className="flex items-center gap-4 p-4 shrink-0 shadow-sm border-muted/50 rounded-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Buscar produto por nome..." 
              className="pl-10 h-12 bg-muted/20 border-transparent focus-visible:bg-background text-base rounded-xl transition-colors"
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
            />
            {termoBusca && (
              <button onClick={() => setTermoBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </Card>

        <CategoriaSelector 
          categoriaAtiva={categoriaAtiva} 
          setCategoriaAtiva={setCategoriaAtiva} 
          categorias={categoriasDinamicas}
        />

        <div className="flex-1 overflow-y-auto pr-2 pb-6">
          {produtosFiltrados.length > 0 ? (
            <ProductGrid produtos={produtosFiltrados} onAdicionar={adicionar} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center border-2 border-dashed rounded-2xl">
              <Search className="h-12 w-12 mb-4 opacity-20" />
              <h3 className="text-lg font-semibold text-foreground">Nenhum produto encontrado</h3>
              <p className="max-w-xs mt-1 text-sm">Não encontramos itens correspondentes à sua busca.</p>
              <Button variant="link" onClick={() => setTermoBusca('')} className="mt-4">
                Limpar busca
              </Button>
            </div>
          )}
        </div>
      </div>

      <Card className="flex flex-col h-[calc(100vh-80px)] overflow-hidden shadow-lg border-muted rounded-2xl bg-card relative">
        <div className="flex items-center justify-between p-4 border-b bg-muted/10 shrink-0">
          <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Cupom em Aberto
          </h2>
          {carrinho.length > 0 && (
            <Badge variant="secondary" className="px-2 py-1 font-mono font-bold bg-primary/10 text-primary border-primary/20">
              {totalItens} {totalItens === 1 ? 'ITEM' : 'ITENS'}
            </Badge>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto p-0">
          <CarrinhoPanel {...painelCarrinhoProps} />
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// 3. SUBCOMPONENTES
// ============================================================================

function CategoriaSelector({ 
  categoriaAtiva, 
  setCategoriaAtiva,
  categorias 
}: { 
  categoriaAtiva: Categoria | 'Todos'; 
  setCategoriaAtiva: (c: Categoria | 'Todos') => void;
  categorias: Categoria[];
}) {
  // AQUI FOI CORRIGIDO O TIPO PARA O TYPESCRIPT PARAR DE RECLAMAR
  const listaCategorias: (Categoria | 'Todos')[] = ['Todos', ...categorias];

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 pt-1 px-1 shrink-0">
      {listaCategorias.map(cat => (
        <button
          key={cat}
          onClick={() => setCategoriaAtiva(cat)}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all shadow-sm border",
            categoriaAtiva === cat 
              ? "bg-primary text-primary-foreground border-primary shadow-md scale-105" 
              : "bg-card text-muted-foreground border-transparent hover:bg-accent/50 hover:text-foreground hover:border-border"
          )}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}

function ProductGrid({
  produtos,
  onAdicionar,
}: {
  produtos: Produto[];
  onAdicionar: (p: Produto) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
      {produtos.map((p) => (
        <button
          key={p.id}
          onClick={() => onAdicionar(p)}
          className="group relative flex flex-col items-center justify-between gap-3 rounded-2xl border bg-card p-4 text-center shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary overflow-hidden h-[160px]"
        >
          <div className="flex flex-col items-center gap-2 z-10 w-full">
            <span className="text-4xl drop-shadow-sm transition-transform duration-300 group-hover:scale-125 mt-1">
              {p.emoji}
            </span>
            <span className="text-sm font-semibold leading-tight line-clamp-2">
              {p.nome}
            </span>
          </div>

          <div className="w-full flex items-center justify-between z-10 mt-auto bg-muted/30 -mx-4 -mb-4 px-4 py-2 border-t">
            <span className="text-[10px] font-medium text-muted-foreground uppercase">
              /{p.unidade}
            </span>
            <span className="text-sm font-black text-primary">
              {formatarMoeda(p.preco)}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

function CarrinhoPanel({
  carrinho,
  pagamento,
  setPagamento,
  resumo,
  valorRecebido,
  setValorRecebido,
  onAlterar,
  onRemover,
  onLimpar,
  onFinalizar,
}: {
  carrinho: ItemCarrinho[];
  pagamento: FormaPagamento;
  setPagamento: (p: FormaPagamento) => void;
  resumo: ResumoVenda;
  valorRecebido: string;
  setValorRecebido: (v: string) => void;
  onAlterar: (id: string, delta: number) => void;
  onRemover: (id: string) => void;
  onLimpar: () => void;
  onFinalizar: () => void;
}) {
  if (carrinho.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 h-full p-8 text-center text-muted-foreground">
        <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-2">
          <ShoppingCart className="h-10 w-10 opacity-50" />
        </div>
        <div>
          <p className="text-lg font-bold text-foreground">Caixa Livre</p>
          <p className="text-sm mt-1 max-w-[200px] mx-auto text-balance">
            Toque nos produtos para iniciar uma nova venda.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {carrinho.map((item, index) => (
          <div
            key={item.id_item_carrinho}
            className="flex items-center gap-3 rounded-xl border bg-background p-3 shadow-sm"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted/30 text-2xl">
              {item.produto.emoji}
            </div>
            
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="text-sm font-semibold truncate">
                {item.produto.nome}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                {formatarMoeda(item.produto.preco)} · {item.produto.unidade}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-md border bg-muted/20">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 rounded-none"
                  onClick={() => {
                    if (item.quantidade === 1) onRemover(item.id_item_carrinho);
                    else onAlterar(item.id_item_carrinho, -1);
                  }}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-6 text-center text-xs font-bold">
                  {item.quantidade}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 rounded-none"
                  onClick={() => onAlterar(item.id_item_carrinho, 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => onRemover(item.id_item_carrinho)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-muted/10 border-t p-4 flex flex-col gap-4 shrink-0">
        <div className="flex items-center justify-between text-xl font-black">
          <span>Total</span>
          <span className="text-primary">{formatarMoeda(resumo.total)}</span>
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <Label className="text-xs font-bold text-muted-foreground uppercase">
            Forma de Pagamento
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {(['pix', 'cartao', 'dinheiro'] as FormaPagamento[]).map((m) => (
              <button
                key={m}
                onClick={() => setPagamento(m)}
                className={cn(
                  'rounded-xl border py-2 text-xs font-bold uppercase transition-all',
                  pagamento === m
                    ? 'border-primary bg-primary text-primary-foreground shadow'
                    : 'bg-background hover:bg-accent/40 text-muted-foreground'
                )}
              >
                {m}
              </button>
            ))}
          </div>

          {pagamento === 'dinheiro' && (
            <div className="flex items-center gap-3 bg-card border rounded-xl p-3 mt-1">
              <div className="flex-1">
                <Label className="text-[11px] text-muted-foreground mb-1 block">Valor Recebido</Label>
                <Input 
                  type="number" 
                  step="0.01"
                  placeholder="0.00"
                  className="h-9 text-base font-bold"
                  value={valorRecebido}
                  onChange={(e) => setValorRecebido(e.target.value)}
                />
              </div>
              <div className="flex-1 flex flex-col items-end justify-center pr-2">
                <Label className="text-[11px] text-muted-foreground mb-1">Troco</Label>
                <span className="text-base font-black text-primary">
                  {formatarMoeda(Math.max(0, resumo.troco))}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="lg"
            className="h-12 px-3 text-destructive hover:bg-destructive/10"
            onClick={onLimpar}
          >
            <Trash2 className="h-5 w-5" />
          </Button>
          <Button
            size="lg"
            className="h-12 flex-1 text-base font-bold"
            onClick={onFinalizar}
          >
            <CheckCircle2 className="h-5 w-5 mr-2" />
            Finalizar Venda
          </Button>
        </div>
      </div>
    </div>
  );
}