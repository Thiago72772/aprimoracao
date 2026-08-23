export type Unidade = 'un' | 'kg' | 'fatia';
export type CategoriaNome = 'Pães' | 'Confeitaria' | 'Almoço' | 'Bebidas' | 'Salgados';
export type FormaPagamento = 'pix' | 'cartao' | 'dinheiro';

export interface Categoria {
  id: number;
  nome: CategoriaNome;
}

export interface Produto {
  id: number;
  nome: string;
  preco: number;
  categoria_id: number;
  unidade: Unidade;
  emoji: string;
  ativo: boolean;
}

export interface Insumo {
  id: number;
  nome: string;
  unidade: 'kg' | 'L' | 'un';
  quantidade: number;
  minimo: number;
}

export interface VendaResumo {
  id: number;
  created_at?: string;
  total_vendas: number;
  por_peso: number;
  por_unidade: number;
  pix: number;
  cartao: number;
  dinheiro: number;
  saldo_inicial: number;
  esperado: number;
  contado: number;
}