export type Unidade = 'un' | 'kg' | 'fatia';
export type Categoria = 'Pães' | 'Confeitaria' | 'Almoço' | 'Bebidas' | 'Salgados';
export type FormaPagamento = 'pix' | 'cartao' | 'dinheiro';

export interface Produto {
  id: string;
  nome: string;
  preco: number;
  categoria: Categoria;
  unidade: Unidade;
  emoji: string;
  ativo: boolean;
}

export interface Insumo {
  id: string;
  nome: string;
  unidade: 'kg' | 'L' | 'un';
  quantidade: number;
  minimo: number;
}

export interface VendaResumo {
  totalVendas: number;
  porPeso: number;
  porUnidade: number;
  pix: number;
  cartao: number;
  dinheiro: number;
  saldoInicial: number;
  esperado: number;
  contado: number;
}

export const CATEGORIAS: Categoria[] = ['Pães', 'Confeitaria', 'Almoço', 'Bebidas', 'Salgados'];

export const produtos: Produto[] = [];

export const insumos: Insumo[] = [];

export const vendaResumoMock: VendaResumo = {
  totalVendas: 487.6,
  porPeso: 132.4,
  porUnidade: 355.2,
  pix: 210.0,
  cartao: 150.3,
  dinheiro: 127.3,
  saldoInicial: 50.0,
  esperado: 177.3,
  contado: 175.0,
};

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
