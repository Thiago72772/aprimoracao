Arquitetura do Projeto: Pão e Leite (ERP & PDV)

O Pão e Leite é um sistema de gestão para padaria/confeitaria que combina um PDV (Ponto de Venda) com módulos de ERP — controle de estoque, receitas/produção, caixa e auditoria. É construído em Next.js (App Router) + React + TypeScript, estilizado com Tailwind CSS e componentes shadcn/ui, com Supabase como backend (banco de dados e autenticação de dados) e TanStack React Query para cache e sincronização de dados assíncronos. O projeto nasceu de um template Bolt (nextjs-shadcn) e é implantado na Netlify.

📁 Estrutura de Pastas e Arquivos
Raiz do Projeto
package.json / package-lock.json: Gerenciamento de dependências (React Query, Radix UI, react-hook-form, Supabase JS, Tailwind, etc.) e scripts (dev, build, start, lint, typecheck).
tsconfig.json / tsconfig.tsbuildinfo: Configuração de compilação TypeScript e cache incremental de build.
tailwind.config.ts: Define o tema Tailwind (dark mode por classe, tokens de cor via CSS variables) e os caminhos de conteúdo (app/, components/, pages/) que devem ser varridos para geração de classes.
postcss.config.js: Pipeline de pós-processamento CSS (tailwindcss + autoprefixer).
next.config.js: Ignora erros de ESLint durante o build e desativa a otimização de imagens (images.unoptimized: true), típico de deploy estático/Netlify.
next-env.d.ts: Arquivo de tipos gerado automaticamente pelo Next.js (não deve ser editado manualmente).
components.json: Configuração do shadcn/ui — define o alias @/components, @/lib/utils, cor base neutral e uso de CSS variables para tematização.
netlify.toml: Configuração de deploy contínuo na Netlify (next build, publish em .next, plugin @netlify/plugin-nextjs).
.eslintrc.json: Estende next/core-web-vitals para regras de lint.
.env.local: Variáveis de ambiente com a URL e a chave pública (publishable key) do projeto Supabase, consumidas por lib/supabase.ts.
.bolt/
config.json: Indica que o projeto foi criado a partir do template nextjs-shadcn da plataforma Bolt.
ignore: Exclui components/ui/* e hooks/use-toast.ts de reescritas automáticas — sinaliza que esses arquivos são "vendorizados" (gerados pelo shadcn/ui) e não devem ser tocados por ferramentas de IA/geração.
prompt: Diretrizes de estilo de geração de código (usar "use client" em componentes com hooks, evitar libs de ícone/tema fora de lucide-react, evitar warnings de hidratação).
skills/pao-e-leite-frontend/SKILL.md: Guia de convenções visuais do projeto — cores da marca (vinho 
#7a1f2e como primária) definidas em app/globals.css e tipadas em lib/brand-config.ts; reforça que a lógica de negócio é implementada por etapas, com telas nascendo com dados mock e marcadores // TODO: lógica aqui.
app/
globals.css: Define os tokens de design do Tailwind via CSS custom properties (--primary, --accent, --background, etc.), com a cor "vinho" da marca aplicada em HSL.
layout.tsx: Layout raiz da aplicação. Importa a fonte Plus_Jakarta_Sans, envolve a árvore com Providers (React Query) e GlobalErrorBoundary, e injeta o Toaster global para notificações.
page.tsx: Página principal ("use client") — atua como orquestrador central do app, importando praticamente todas as telas (ReceitasScreen, EstoqueScreen, PdvScreen, KardexScreen, CaixaScreen) e modais (ProdutoModal, InsumoModal), além dos hooks useEstoque e useRegistrarProducao e do cliente supabase. Concentra grande parte do estado global da aplicação (tipos CashRegisterState, Sale, Product, KardexEntry são exportados a partir daqui e reutilizados por outros componentes).
providers.tsx: Configura o QueryClientProvider do TanStack React Query (staleTime de 10s, refetch ao focar a janela, 2 tentativas de retry), centralizando a política de cache de dados do app.
app/api/v1/venda-externa/
route.ts: Endpoint de API REST (POST) que recebe vendas de sistemas externos (ex.: um PDV físico) autenticadas por uma chave x-api-key. A chave é convertida em hash SHA-256 e validada contra credenciais armazenadas no Supabase — um ponto de integração de sistema externo com o ERP.
components/
app-sidebar.tsx: Barra de navegação lateral da aplicação, com ícones (lucide-react) para as seções PDV, Caixa, Estoque, Auditoria etc.
auditoria-screen.tsx: Tela de auditoria/histórico de operações. Usa o hook useHistorico (de hooks/use-erp) e permite filtrar por tipo de operação.
caixa-screen.tsx: Tela de controle de caixa (abertura/fechamento, movimentações). Recebe cashRegister, sales e showToast como props vindas de app/page.tsx, reutilizando os tipos CashRegisterState e Sale definidos ali.
error-boundary.tsx: GlobalErrorBoundary, componente de classe React que captura erros de renderização em qualquer ponto da árvore — crítico para um sistema de caixa, evitando que uma falha derrube a tela inteira durante uma venda.
estoque-screen.tsx: Tela de gestão de estoque (insumos e produtos), com ações de importação/exportação (ícones FileSpreadsheet, Download, Upload) e alertas de estoque baixo.
ImportModal.tsx: Modal para importação de dados via CSV, com chamada direta ao supabase (sem passar pelos hooks de hooks/use-erp ou lib/importacao.ts).
InsumoModal.tsx: Modal de cadastro/edição de insumos (nome, unidade kg | L | un, quantidade, mínimo), também com acesso direto ao supabase.
kardex-screen.tsx: Módulo de "Auditoria Kardex & Test Suite" — tela que simula vendas (SimulationSaleInput, SimulationResult) sobre os tipos KardexEntry e Product importados de app/page.tsx, funcionando como uma ferramenta de validação de regras de negócio de estoque.
pdv-screen.tsx: Tela do Ponto de Venda propriamente dito. Usa useQuery do React Query para buscar produtos diretamente do Supabase (comentário no código indica que essa busca foi "ADICIONADA" recentemente) e ícones de carrinho, busca e código de barras.
ProdutoModal.tsx: Modal de cadastro/edição de produtos (nome, preço, categoria, unidade un | kg | fatia), com escrita direta no Supabase.
produtos-screen.tsx: Tela de listagem de produtos, atualmente consumindo dados mock de lib/mock-data.ts (produtos, formatarMoeda, tipos Produto/Unidade/Categoria) via componentes shadcn/ui (Table, Card, Badge, Button).
receitas-screen.tsx: Tela de gestão de receitas/produção. Recebe recipes, stock e productionLogs como props (tipadas como any, sugerindo tipagem ainda não finalizada) e usa supabase para persistência.
components/ui/

Coleção padrão de primitivos shadcn/ui (baseados em Radix UI), gerados pelo template e listados no .bolt/ignore como não editáveis diretamente. Inclui blocos de interface reutilizados por praticamente todas as telas acima: accordion, alert-dialog, alert, aspect-ratio, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input-otp, input, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, skeleton, slider, sonner, switch, table, tabs, textarea, toast, toaster, toggle-group, toggle e tooltip. Todos consomem os tokens de cor definidos em app/globals.css via lib/utils.ts (cn).

hooks/
use-erp.ts: Exporta useEstoque() (baseado em useQuery/useMutation do React Query sobre a interface EstoqueItem) e é a fonte do hook useHistorico usado por auditoria-screen.tsx. Conecta-se diretamente ao lib/supabase.ts.
use-estoque.ts: Também exporta uma função useEstoque(), porém sobre uma interface Insumo diferente (com custoUnitario), integrada ao Supabase via React Query. Há sobreposição de nome/responsabilidade com use-erp.ts — dois hooks distintos disputando o mesmo nome de exportação (ver seção de Atualizações Recentes).
use-mobile.ts: Hook utilitário useIsMobile() que observa window.matchMedia para detectar viewports abaixo de 768px, usado para comportamento responsivo (ex.: colapsar a sidebar).
use-toast.ts: Implementação padrão do sistema de toast do shadcn/ui, consumida por components/ui/toaster.tsx e disparada pelas telas (showToast). O código traz um comentário explícito de correção de bug: o tempo de remoção do toast foi ajustado de 1.000.000ms (~16 min, valor padrão problemático do shadcn) para 4.000ms.
lib/
brand-config.ts: Define a interface BrandConfig (nome, tagline, logo, contato, settings com símbolo de moeda, limite de estoque baixo e taxa de imposto) — a fonte tipada da identidade visual/comercial referenciada no SKILL.md do .bolt.
importacao.ts: Define os contratos de importação de dados em massa: RawRow (linha bruta com tipo: "INSUMO" | "PRODUTO_FINAL", saldo atual/mínimo, código de barras) e ErrorReport (linha + motivo de erro), usados como base para uma futura rotina de importação validada via supabase.
mock-data.ts: Fonte de dados estáticos (mock) para desenvolvimento — tipos Unidade, Categoria, FormaPagamento e interfaces Produto/Insumo, ainda consumidos por produtos-screen.tsx enquanto a integração real com o Supabase não é finalizada nessa tela.
supabase.ts: Instancia e exporta o cliente supabase (createClient) usado por praticamente todo o app (telas, modais e hooks) para leitura/escrita no banco.
types.ts: Definições de tipos "oficiais" do domínio (Categoria, Produto, Unidade, CategoriaNome, FormaPagamento) — parcialmente redundantes com os tipos equivalentes em mock-data.ts, indicando uma migração em andamento de dados mock para tipos alinhados ao schema do Supabase.
utils.ts: Utilitários compartilhados — cn() (merge de classes Tailwind via clsx + tailwind-merge, usado por todos os componentes ui/) e formatCurrency() (formatação monetária em pt-BR/BRL via Intl.NumberFormat).
🔄 Atualizações Recentes (Agosto 2026)
Integração real com o backend em andamento: pdv-screen.tsx foi atualizado para buscar produtos diretamente do Supabase via useQuery (comentário no próprio código marca isso como adição recente), migrando a tela para longe dos dados mock ainda usados em produtos-screen.tsx.
Correção de bug de UX no sistema de toast: hooks/use-toast.ts documenta explicitamente a redução do tempo de exibição de notificações de ~16 minutos (valor padrão herdado do shadcn/ui) para 4 segundos — uma correção de usabilidade relevante para um sistema de caixa em uso contínuo.
Isolamento de responsabilidades (resiliência): introdução de components/error-boundary.tsx (GlobalErrorBoundary) no app/layout.tsx, isolando falhas de renderização para não derrubar o PDV inteiro durante uma operação de venda.
Novo endpoint de integração externa: app/api/v1/venda-externa/route.ts expõe uma rota de API autenticada por chave (hash SHA-256), permitindo que sistemas de PDV externos registrem vendas no ERP — funcionalidade de integração ativa e validada no código.
Sobreposição de hooks ainda não refatorada: existem dois hooks chamados useEstoque() (hooks/use-erp.ts e hooks/use-estoque.ts) com interfaces (EstoqueItem vs. Insumo) diferentes entre si — um sinal de refatoração pendente que deveria ser consolidada em uma única fonte de verdade.
Escrita direta ao Supabase nos modais: ImportModal.tsx, InsumoModal.tsx e ProdutoModal.tsx acessam lib/supabase.ts diretamente em vez de passar pelos hooks de hooks/use-erp.ts/use-estoque.ts, indicando que a camada de dados ainda não foi totalmente centralizada nos hooks do React Query.
Padrão de design consolidado: a identidade visual (cor "vinho" 
#7a1f2e, tokens em app/globals.css, tipos em lib/brand-config.ts) está aplicada de forma consistente e documentada como convenção obrigatória no SKILL.md do projeto, reforçando o uso de tokens em vez de cores hardcoded.
Funcionalidades ativas e validadas: PDV com busca de produtos ao vivo, Caixa (abertura/fechamento/movimentações), Estoque com alertas de saldo baixo, Auditoria com histórico filtrável e o módulo Kardex de simulação de vendas para testes de regras de negócio.