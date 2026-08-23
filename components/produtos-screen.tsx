'use client';

import * as React from 'react';
import { Plus, Pencil, Trash2, Package } from 'lucide-react';

import { produtos as produtosMock, formatarMoeda, type Produto, type Unidade, type Categoria } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CATEGORIAS: Categoria[] = ['Pães', 'Confeitaria', 'Almoço', 'Bebidas', 'Salgados'];
const UNIDADES: Unidade[] = ['un', 'kg', 'fatia'];

export function ProdutosScreen() {
  const [lista, setLista] = React.useState<Produto[]>(produtosMock);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [editando, setEditando] = React.useState<Produto | null>(null);

  function abrirNovo() {
    setEditando(null);
    setSheetOpen(true);
  }

  function abrirEditar(produto: Produto) {
    setEditando(produto);
    setSheetOpen(true);
  }

  function remover(id: string) {
    // TODO: lógica aqui — remover produto da base
    setLista((prev) => prev.filter((p) => p.id !== id));
  }

  function salvar(produto: Produto) {
    // TODO: lógica aqui — criar/atualizar produto na base
    setLista((prev) => {
      const existe = prev.some((p) => p.id === produto.id);
      if (existe) {
        return prev.map((p) => (p.id === produto.id ? produto : p));
      }
      return [...prev, produto];
    });
    setSheetOpen(false);
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">
          {lista.length} produto{lista.length === 1 ? '' : 's'}
        </h2>
        <Button onClick={abrirNovo}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Produto
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-right">Preço</TableHead>
              <TableHead className="w-[80px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">
                  <span className="mr-2">{p.emoji}</span>
                  {p.nome}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{p.categoria}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {p.unidade}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatarMoeda(p.preco)}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => abrirEditar(p)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => remover(p.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <ProdutoForm
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        produto={editando}
        onSalvar={salvar}
      />
    </div>
  );
}

function ProdutoForm({
  open,
  onOpenChange,
  produto,
  onSalvar,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  produto: Produto | null;
  onSalvar: (p: Produto) => void;
}) {
  const [nome, setNome] = React.useState('');
  const [preco, setPreco] = React.useState('');
  const [categoria, setCategoria] = React.useState<Categoria>('Pães');
  const [unidade, setUnidade] = React.useState<Unidade>('un');
  const [emoji, setEmoji] = React.useState('🥖');

  React.useEffect(() => {
    if (produto) {
      setNome(produto.nome);
      setPreco(String(produto.preco));
      setCategoria(produto.categoria);
      setUnidade(produto.unidade);
      setEmoji(produto.emoji);
    } else {
      setNome('');
      setPreco('');
      setCategoria('Pães');
      setUnidade('un');
      setEmoji('🥖');
    }
  }, [produto, open]);

  function submit() {
    // TODO: lógica aqui — validar e salvar
    onSalvar({
      id: produto?.id ?? `p${Date.now()}`,
      nome,
      preco: Number(preco) || 0,
      categoria,
      unidade,
      emoji,
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{produto ? 'Editar produto' : 'Novo produto'}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Pão Francês"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="preco">Preço (R$)</Label>
            <Input
              id="preco"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Categoria</Label>
            <Select
              value={categoria}
              onValueChange={(v) => setCategoria(v as Categoria)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Unidade</Label>
            <Select
              value={unidade}
              onValueChange={(v) => setUnidade(v as Unidade)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNIDADES.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emoji">Ícone (emoji)</Label>
            <Input
              id="emoji"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              maxLength={2}
            />
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!nome || !preco}>
            <Package className="mr-2 h-4 w-4" />
            Salvar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
