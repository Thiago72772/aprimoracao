'use client';

import * as React from 'react';
import {
  ShoppingCart,
  Wallet,
  Package,
  Boxes,
  Bell,
  UserCircle,
  Clock as ClockIcon,
  LogOut,
  Settings,
  ShieldCheck,
  AlertCircle,
  Menu,
  X,
  ChevronRight,
  CircleDot
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { brandConfig } from '@/lib/brand-config';
import { useIsMobile } from '@/hooks/use-mobile';
import { PdvScreen } from '@/components/pdv-screen';
import { CaixaScreen } from '@/components/caixa-screen';
import { ProdutosScreen } from '@/components/produtos-screen';
import { EstoqueScreen } from '@/components/estoque-screen';

// ============================================================================
// 1. TIPAGENS E INTERFACES
// ============================================================================

export type ScreenId = 'pdv' | 'caixa' | 'produtos' | 'estoque' | 'configuracoes';

interface NavItem {
  id: ScreenId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut: string;
  description: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'warning' | 'info' | 'error';
  read: boolean;
  timestamp: Date;
}

// ============================================================================
// 2. CONFIGURAÇÕES ESTÁTICAS E DADOS MOCKADOS
// ============================================================================

const NAV_ITEMS: NavItem[] = [
  { id: 'pdv', label: 'Frente de Caixa (PDV)', icon: ShoppingCart, shortcut: 'Alt+1', description: 'Vendas rápidas e carrinho' },
  { id: 'caixa', label: 'Gestão do Caixa', icon: Wallet, shortcut: 'Alt+2', description: 'Abertura, fechamento e sangria' },
  { id: 'produtos', label: 'Produtos', icon: Package, shortcut: 'Alt+3', description: 'Catálogo e precificação' },
  { id: 'estoque', label: 'Estoque', icon: Boxes, shortcut: 'Alt+4', description: 'Insumos e controle de perdas' },
];

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    title: 'Estoque Baixo',
    message: 'Leite Integral (Caixa) atingiu o nível mínimo configurado.',
    type: 'warning',
    read: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 min atrás
  },
  {
    id: 'n2',
    title: 'Caixa Aberto',
    message: 'Turno da manhã iniciado com sucesso. Fundo de troco: R$ 50,00.',
    type: 'info',
    read: true,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 horas atrás
  }
];

// ============================================================================
// 3. HOOKS CUSTOMIZADOS (UTILITÁRIOS DO LAYOUT)
// ============================================================================

/**
 * Hook para manter um relógio atualizado na tela do PDV
 */
function useCurrentTime() {
  const [time, setTime] = React.useState<Date>(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return time;
}

/**
 * Hook para detectar cliques fora de um elemento (usado em menus dropdown)
 */
function useOnClickOutside(ref: React.RefObject<HTMLElement>, handler: () => void) {
  React.useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return;
      handler();
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

/**
 * Hook para atalhos globais de teclado no PDV
 */
function useGlobalShortcuts(setActive: (id: ScreenId) => void) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar atalhos se o usuário estiver digitando em um input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

      if (e.altKey) {
        switch (e.key) {
          case '1': e.preventDefault(); setActive('pdv'); break;
          case '2': e.preventDefault(); setActive('caixa'); break;
          case '3': e.preventDefault(); setActive('produtos'); break;
          case '4': e.preventDefault(); setActive('estoque'); break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActive]);
}

// ============================================================================
// 4. SUBCOMPONENTES DE INTERFACE
// ============================================================================

/**
 * Componente da Marca Pão e Leite (Extensível para Mobile e Desktop)
 */
function BrandMark({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-primary-foreground shadow-md ring-1 ring-black/5">
        <span className="text-xl font-black tracking-tighter">PL</span>
      </div>
      {!compact && (
        <div className="flex flex-col leading-none">
          <p className="text-base font-bold text-foreground tracking-tight">
            {brandConfig.name || 'Pão e Leite'}
          </p>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-1">
            {brandConfig.tagline || 'Gestão e PDV'}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Relógio no Header Superior
 */
function HeaderClock() {
  const time = useCurrentTime();
  
  const formattedTime = time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const formattedDate = time.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });

  return (
    <div className="hidden md:flex flex-col items-end text-right">
      <span className="text-sm font-bold text-foreground tabular-nums flex items-center gap-1.5">
        <ClockIcon className="w-3.5 h-3.5 text-brand" />
        {formattedTime}
      </span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
        {formattedDate}
      </span>
    </div>
  );
}

/**
 * Indicador de Status do Caixa (Aberto/Fechado)
 */
function ShiftStatusBadge() {
  // TODO: Conectar ao Contexto global de Caixa futuramente
  const isShiftOpen = true; 

  return (
    <div className={cn(
      "hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold shadow-sm",
      isShiftOpen 
        ? "bg-success/10 border-success/20 text-success" 
        : "bg-destructive/10 border-destructive/20 text-destructive"
    )}>
      <CircleDot className={cn("w-3 h-3", isShiftOpen ? "animate-pulse" : "")} />
      {isShiftOpen ? 'Caixa Aberto' : 'Caixa Fechado'}
    </div>
  );
}

/**
 * Dropdown de Notificações do Sistema
 */
function NotificationCenter() {
  const [isOpen, setIsOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  
  useOnClickOutside(ref, () => setIsOpen(false));
  
  const unreadCount = MOCK_NOTIFICATIONS.filter(n => !n.read).length;

  return (
    <div className="relative" ref={ref}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-accent/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Notificações do sistema"
      >
        <Bell className="w-5 h-5 text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white ring-2 ring-background">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl border bg-card p-2 shadow-xl z-50 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b">
            <span className="font-semibold text-sm">Notificações</span>
            <span className="text-xs text-muted-foreground">{unreadCount} não lidas</span>
          </div>
          <div className="max-h-[300px] overflow-y-auto flex flex-col gap-1">
            {MOCK_NOTIFICATIONS.map(note => (
              <div key={note.id} className={cn(
                "p-3 rounded-lg text-sm flex gap-3 items-start",
                !note.read ? "bg-muted/50" : "opacity-75"
              )}>
                {note.type === 'warning' ? <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" /> : <ShieldCheck className="w-4 h-4 text-success shrink-0 mt-0.5" />}
                <div className="flex flex-col gap-1">
                  <span className="font-medium leading-none">{note.title}</span>
                  <span className="text-xs text-muted-foreground leading-snug">{note.message}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Dropdown de Perfil do Operador
 */
function UserMenu() {
  const [isOpen, setIsOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  
  useOnClickOutside(ref, () => setIsOpen(false));

  return (
    <div className="relative" ref={ref}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 pr-2 rounded-full border bg-card hover:bg-accent/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="w-8 h-8 rounded-full bg-brand text-primary-foreground flex items-center justify-center">
          <UserCircle className="w-5 h-5" />
        </div>
        <span className="text-sm font-medium hidden md:block">Operador</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border bg-card py-1 shadow-xl z-50 animate-in fade-in slide-in-from-top-2">
          <div className="px-3 py-2 border-b mb-1">
            <p className="text-sm font-semibold">Operador Padrão</p>
            <p className="text-xs text-muted-foreground">Caixa 01</p>
          </div>
          <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left">
            <Settings className="w-4 h-4 text-muted-foreground" />
            Configurações do Sistema
          </button>
          <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-destructive/10 text-destructive transition-colors text-left mt-1 border-t">
            <LogOut className="w-4 h-4" />
            Encerrar Turno e Sair
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 5. COMPONENTE PRINCIPAL (ORQUESTRADOR DE LAYOUT)
// ============================================================================

export function AppSidebar() {
  const isMobile = useIsMobile();
  const [active, setActive] = React.useState<ScreenId>('pdv');
  const [collapsed, setCollapsed] = React.useState(false);

  // Ativa os atalhos de teclado globais
  useGlobalShortcuts(setActive);

  const activeItem = NAV_ITEMS.find((n) => n.id === active) || NAV_ITEMS[0];

  // ==========================================================================
  // RENDERIZAÇÃO MOBILE
  // ==========================================================================
  if (isMobile) {
    return (
      <div className="flex h-[100dvh] flex-col bg-background overflow-hidden touch-fast">
        {/* Header Mobile */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card px-4 shadow-sm z-30 pt-safe">
          <BrandMark compact className="scale-90 transform origin-left" />
          <div className="flex items-center gap-3">
            <ShiftStatusBadge />
            <NotificationCenter />
          </div>
        </header>

        {/* Área de Conteúdo Principal (Scrollável) */}
        <main className="flex-1 overflow-y-auto pb-safe bg-muted/20 relative">
          <React.Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div></div>}>
            {renderScreen(active)}
          </React.Suspense>
        </main>

        {/* Bottom Navigation (Barra inferior PWA-style) */}
        <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t bg-card pb-safe shadow-[0_-5px_15px_-10px_rgba(0,0,0,0.1)]">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActive(item.id)}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-1 py-3 text-[10px] font-bold transition-all duration-200 ease-in-out',
                  isActive
                    ? 'text-brand -translate-y-1'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <div className={cn(
                  "p-1.5 rounded-full transition-colors",
                  isActive ? "bg-brand/10" : "bg-transparent"
                )}>
                  <Icon className={cn("h-5 w-5", isActive ? "fill-brand/20" : "")} />
                </div>
                {item.label.split(' ')[0]} {/* Pega apenas a primeira palavra no mobile */}
              </button>
            );
          })}
        </nav>
      </div>
    );
  }

  // ==========================================================================
  // RENDERIZAÇÃO DESKTOP
  // ==========================================================================
  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
      
      {/* SIDEBAR LATERAL ESQUERDA */}
      <aside
        className={cn(
          'flex flex-col border-r bg-card transition-all duration-300 ease-in-out z-20 shadow-sm',
          collapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        {/* Logo / Botão de Colapso */}
        <div className="h-20 flex items-center justify-between px-4 border-b">
          <BrandMark compact={collapsed} />
          {!collapsed && (
            <button 
              onClick={() => setCollapsed(true)}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
              aria-label="Recolher menu lateral"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
        </div>

        {collapsed && (
           <button 
           onClick={() => setCollapsed(false)}
           className="p-3 mx-auto mt-2 rounded-md hover:bg-muted text-muted-foreground flex items-center justify-center w-full"
           aria-label="Expandir menu lateral"
         >
           <ChevronRight className="w-5 h-5" />
         </button>
        )}

        {/* Links de Navegação */}
        <nav className="flex flex-1 flex-col gap-2 p-3 mt-4 overflow-y-auto custom-scrollbar">
          {!collapsed && (
            <span className="text-xs font-bold text-muted-foreground px-3 mb-2 uppercase tracking-wider">
              Menu Principal
            </span>
          )}
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActive(item.id)}
                title={collapsed ? `${item.label} (${item.shortcut})` : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-all duration-200 group relative',
                  isActive
                    ? 'bg-brand text-primary-foreground shadow-md'
                    : 'text-muted-foreground hover:bg-brand/10 hover:text-brand'
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0 transition-transform group-hover:scale-110", isActive && "fill-primary-foreground/20")} />
                {!collapsed && (
                  <div className="flex flex-1 items-center justify-between">
                    <span>{item.label}</span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded border opacity-0 group-hover:opacity-100 transition-opacity",
                      isActive ? "border-primary-foreground/30" : "border-border"
                    )}>
                      {item.shortcut}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Rodapé da Sidebar (Suporte / Info do Sistema) */}
        <div className="p-4 border-t bg-muted/10 text-center">
           {!collapsed ? (
             <p className="text-[10px] text-muted-foreground">Pão e Leite OS v1.0.0</p>
           ) : (
             <p className="text-[10px] font-bold text-muted-foreground">v1.0</p>
           )}
        </div>
      </aside>

      {/* ÁREA CENTRAL DO SISTEMA (CABEÇALHO + TELA ATIVA) */}
      <div className="flex flex-1 flex-col overflow-hidden relative bg-muted/10">
        
        {/* Cabeçalho Superior Desktop */}
        <header className="flex h-20 shrink-0 items-center justify-between border-b bg-card px-8 shadow-sm z-10">
          
          {/* Breadcrumbs e Título da Tela */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                {activeItem.label}
              </h1>
              <span className="text-sm text-muted-foreground">
                {activeItem.description}
              </span>
            </div>
            <div className="ml-4 pl-4 border-l h-8 flex items-center">
              <ShiftStatusBadge />
            </div>
          </div>

          {/* Ferramentas e Perfil (Lado Direito) */}
          <div className="flex items-center gap-6">
            <HeaderClock />
            <div className="w-px h-8 bg-border"></div> {/* Divisor vertical */}
            <div className="flex items-center gap-4">
              <NotificationCenter />
              <UserMenu />
            </div>
          </div>
        </header>

        {/* Renderização Dinâmica da Tela (Conteúdo) */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 relative">
          <React.Suspense fallback={
            <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
              <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-muted-foreground animate-pulse">Carregando módulo...</p>
            </div>
          }>
            <div className="w-full max-w-[1600px] mx-auto h-full animate-in fade-in duration-500">
              {renderScreen(active)}
            </div>
          </React.Suspense>
        </main>

      </div>
    </div>
  );
}

// ============================================================================
// 6. RENDERIZADOR DE TELAS
// ============================================================================

/**
 * Função responsável por injetar a tela correspondente no Layout.
 * No futuro, isso pode ser substituído por rotas do Next.js (app/pdv/page.tsx),
 * mas manter como abas garante que o estado de outras telas não seja perdido
 * durante trocas rápidas de navegação.
 */
function renderScreen(id: ScreenId) {
  switch (id) {
    case 'pdv':
      return <PdvScreen />;
    case 'caixa':
      return <CaixaScreen />;
    case 'produtos':
      return <ProdutosScreen />;
    case 'estoque':
      return <EstoqueScreen />;
    default:
      // Tela de fallback de segurança
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-card rounded-2xl border shadow-sm">
          <Settings className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
          <h2 className="text-2xl font-bold text-foreground">Módulo em Desenvolvimento</h2>
          <p className="text-muted-foreground mt-2 max-w-md">
            Esta área do sistema ainda está sendo construída. Use a barra lateral para voltar aos módulos ativos.
          </p>
        </div>
      );
  }
}