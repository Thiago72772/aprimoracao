'use client';

import * as React from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Package,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2
} from 'lucide-react';
import { useEstoque } from '@/hooks/use-estoque';

type TipoEstoque = 'INSUMO' | 'PRODUTO_FINAL';
type TipoMovimento = 'entrada' | 'saida';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_IMPORT_ITEMS = 5000;

const UNIDADES = ['KG', 'L', 'UN', 'G', 'ML', 'PCT'] as const;
type Unidade = (typeof UNIDADES)[number] | string;

interface Insumo {
  id: string;
  nome: string;
  unidade: Unidade;
  quantidade: number;
  minimo: number;
  custoUnitario: number;
  tipo: TipoEstoque;
}

interface InsumoInput {
  nome: string;
  unidade: Unidade;
  quantidade: number;
  minimo: number;
  custoUnitario: number;
  tipo: TipoEstoque;
}

interface EstoqueScreenProps {
  showToast?: (message: string) => void;
}

function toFiniteNumber(
  value: unknown,
  fallback = 0
): number {
  const numberValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.replace(',', '.'))
        : Number(value);

  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function parseRequiredNonNegativeNumber(value: unknown): number | null {
  const text = String(value ?? '').trim();

  if (!text) {
    return null;
  }

  const numberValue = Number(text.replace(',', '.'));

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return null;
  }

  return numberValue;
}

function parseOptionalNonNegativeNumber(value: unknown): number | null {
  const text = String(value ?? '').trim();

  if (!text) {
    return 0;
  }

  const numberValue = Number(text.replace(',', '.'));

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return null;
  }

  return numberValue;
}

function parseCsvLine(line: string, separator: ',' | ';'): string[] {
  const columns: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }

      continue;
    }

    if (char === separator && !insideQuotes) {
      columns.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (insideQuotes) {
    throw new Error('Aspas não fechadas no CSV.');
  }

  columns.push(current.trim());

  return columns;
}

function normalizeCsvHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase();
}

export function EstoqueScreen({
  showToast
}: EstoqueScreenProps) {
  const {
    stock = [],
    addInsumo,
    updateInsumo,
    deleteInsumo,
    movimentarEstoque,
    importarInsumos
  } = useEstoque();

  const [abaAtiva, setAbaAtiva] =
    React.useState<TipoEstoque>('INSUMO');

  const lista = React.useMemo<Insumo[]>(() => {
    if (!Array.isArray(stock)) {
      return [];
    }

    return stock
      .map((raw: unknown): Insumo | null => {
        if (!raw || typeof raw !== 'object') {
          return null;
        }

        const s = raw as Record<string, unknown>;

        const id = String(s.id ?? '').trim();
        const nome = String(
          s.nome ??
          s.name ??
          'Item sem nome'
        ).trim();

        const unidade = String(
          s.unidade ??
          s.unit ??
          'UN'
        )
          .trim()
          .toUpperCase();

        const quantidade = toFiniteNumber(
          s.quantidade ?? s.quantity,
          0
        );

        const minimo = toFiniteNumber(
          s.minimo ?? s.minQuantity,
          0
        );

        const custoUnitario = toFiniteNumber(
          s.custoUnitario ?? s.costPrice,
          0
        );

        const tipoValue = String(
          s.tipo ?? 'INSUMO'
        ).toUpperCase();

        const tipo: TipoEstoque =
          tipoValue === 'PRODUTO_FINAL'
            ? 'PRODUTO_FINAL'
            : 'INSUMO';

        if (!id) {
          return null;
        }

        return {
          id,
          nome,
          unidade,
          quantidade,
          minimo,
          custoUnitario,
          tipo
        };
      })
      .filter(
        (item): item is Insumo =>
          item !== null && item.tipo === abaAtiva
      );
  }, [stock, abaAtiva]);

  const alertas = React.useMemo(
    () =>
      lista.filter(
        item => item.quantidade <= item.minimo
      ).length,
    [lista]
  );

  const [modalItemOpen, setModalItemOpen] =
    React.useState(false);

  const [itemEditando, setItemEditando] =
    React.useState<Insumo | null>(null);

  const [modalMovimentoOpen, setModalMovimentoOpen] =
    React.useState(false);

  const [itemMovimento, setItemMovimento] =
    React.useState<Insumo | null>(null);

  const [tipoMovimento, setTipoMovimento] =
    React.useState<TipoMovimento>('entrada');

  const [qtdMovimento, setQtdMovimento] =
    React.useState('');

  const [motivoSaida, setMotivoSaida] =
    React.useState('Perda / Validade');

  const [modalImportOpen, setModalImportOpen] =
    React.useState(false);

  const [itensPreview, setItensPreview] =
    React.useState<InsumoInput[]>([]);

  const [erroImportacao, setErroImportacao] =
    React.useState<string | null>(null);

  function handleDownloadModelo() {
    const cabecalho =
      'Nome do Item;Unidade;Quantidade;Custo;Estoque Mínimo\n';

    const exemplos =
      'Farinha de Trigo Especial;KG;50.0;5.50;10.0\n' +
      'Açúcar Refinado;KG;30.0;4.20;8.0\n' +
      'Manteiga Sem Sal;KG;15.0;35.00;4.0\n' +
      'Caixa de Leite 1L;UN;60.0;4.80;12.0\n';

    const blob = new Blob(
      ['\uFEFF', cabecalho, exemplos],
      {
        type: 'text/csv;charset=utf-8;'
      }
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = 'modelo_importacao_estoque.csv';

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  }

  function handleFileUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const input = e.currentTarget;
    const file = input.files?.[0];

    setErroImportacao(null);
    setItensPreview([]);

    if (!file) {
      return;
    }

    input.value = '';

    if (file.size > MAX_FILE_SIZE) {
      setErroImportacao(
        'O arquivo excede o limite de 5 MB.'
      );
      return;
    }

    if (
      !file.name.toLowerCase().endsWith('.csv')
    ) {
      setErroImportacao(
        'Selecione um arquivo CSV válido.'
      );
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => {
      setErroImportacao(
        'Não foi possível ler o arquivo selecionado.'
      );
    };

    reader.onload = event => {
      try {
        const text = event.target?.result;

        if (typeof text !== 'string' || !text.trim()) {
          setErroImportacao(
            'O arquivo selecionado está vazio.'
          );
          return;
        }

        const linhas = text
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n')
          .split('\n')
          .filter(line => line.trim() !== '');

        if (linhas.length < 2) {
          setErroImportacao(
            'O arquivo deve possuir cabeçalho e pelo menos um item.'
          );
          return;
        }

        if (linhas.length - 1 > MAX_IMPORT_ITEMS) {
          setErroImportacao(
            `O arquivo excede o limite de ${MAX_IMPORT_ITEMS} itens.`
          );
          return;
        }

        const firstLine = linhas[0];
        const separator: ',' | ';' =
          firstLine.includes(';') ? ';' : ',';

        const header = parseCsvLine(
          firstLine,
          separator
        ).map(normalizeCsvHeader);

        const expectedHeaders = [
          'nome do item',
          'unidade',
          'quantidade',
          'custo',
          'estoque mínimo'
        ];

        const validHeader =
          expectedHeaders.every(
            (expectedHeader, index) =>
              header[index] === expectedHeader
          );

        if (!validHeader) {
          setErroImportacao(
            'Cabeçalho inválido. Utilize o modelo disponibilizado pelo sistema.'
          );
          return;
        }

        const parsedItens: InsumoInput[] = [];
        const errors: string[] = [];

        for (let i = 1; i < linhas.length; i += 1) {
          const lineNumber = i + 1;

          let columns: string[];

          try {
            columns = parseCsvLine(
              linhas[i],
              separator
            );
          } catch (error) {
            errors.push(
              `Linha ${lineNumber}: CSV malformado.`
            );
            continue;
          }

          if (
            columns.length < 4 ||
            !columns[0].trim()
          ) {
            errors.push(
              `Linha ${lineNumber}: nome do item é obrigatório.`
            );
            continue;
          }

          const nome = columns[0].trim();

          if (nome.length > 200) {
            errors.push(
              `Linha ${lineNumber}: nome do item excede 200 caracteres.`
            );
            continue;
          }

          const unidade = (
            columns[1] || 'UN'
          )
            .trim()
            .toUpperCase();

          if (!unidade) {
            errors.push(
              `Linha ${lineNumber}: unidade inválida.`
            );
            continue;
          }

          const quantidade =
            parseRequiredNonNegativeNumber(
              columns[2]
            );

          if (quantidade === null) {
            errors.push(
              `Linha ${lineNumber}: quantidade inválida.`
            );
            continue;
          }

          const custoUnitario =
            parseRequiredNonNegativeNumber(
              columns[3]
            );

          if (custoUnitario === null) {
            errors.push(
              `Linha ${lineNumber}: custo inválido.`
            );
            continue;
          }

          const minimo =
            parseOptionalNonNegativeNumber(
              columns[4]
            );

          if (minimo === null) {
            errors.push(
              `Linha ${lineNumber}: estoque mínimo inválido.`
            );
            continue;
          }

          parsedItens.push({
            nome,
            unidade,
            quantidade,
            custoUnitario,
            minimo,
            tipo: abaAtiva
          });
        }

        if (errors.length > 0) {
          setErroImportacao(
            `Foram encontrados erros no arquivo:\n${errors
              .slice(0, 10)
              .join('\n')}${
              errors.length > 10
                ? '\n... e outros erros.'
                : ''
            }`
          );
          return;
        }

        if (parsedItens.length === 0) {
          setErroImportacao(
            'Nenhum item válido foi encontrado no arquivo.'
          );
          return;
        }

        setItensPreview(parsedItens);
      } catch {
        setErroImportacao(
          'Erro ao processar o arquivo CSV. Verifique a formatação.'
        );
      }
    };

    reader.readAsText(file, 'UTF-8');
  }

  function handleConfirmarImportacao() {
    if (itensPreview.length === 0) {
      return;
    }

    if (typeof importarInsumos !== 'function') {
      showToast?.(
        'A importação não está disponível no estoque.'
      );
      return;
    }

    try {
      const result = importarInsumos(itensPreview);

      if (
        result &&
        typeof (
          result as Promise<unknown>
        ).then === 'function'
      ) {
        void (result as Promise<unknown>)
          .then(() => {
            showToast?.(
              `${itensPreview.length} item(ns) importado(s) com sucesso!`
            );
            setModalImportOpen(false);
            setItensPreview([]);
          })
          .catch(() => {
            showToast?.(
              'Não foi possível concluir a importação.'
            );
          });

        return;
      }

      showToast?.(
        `${itensPreview.length} item(ns) importado(s) com sucesso!`
      );

      setModalImportOpen(false);
      setItensPreview([]);
    } catch {
      showToast?.(
        'Não foi possível concluir a importação.'
      );
    }
  }

  function handleAbrirNovoItem() {
    setItemEditando(null);
    setModalItemOpen(true);
  }

  function handleAbrirEditarItem(
    item: Insumo
  ) {
    setItemEditando(item);
    setModalItemOpen(true);
  }

  function handleExcluirItem(id: string) {
    if (
      typeof deleteInsumo !== 'function'
    ) {
      showToast?.(
        'A exclusão de itens não está disponível.'
      );
      return;
    }

    const confirmed = window.confirm(
      'Tem certeza que deseja remover este item do estoque?'
    );

    if (!confirmed) {
      return;
    }

    try {
      const result = deleteInsumo(id);

      if (
        result &&
        typeof (
          result as Promise<unknown>
        ).then === 'function'
      ) {
        void (result as Promise<unknown>)
          .then(() => {
            showToast?.(
              'Item removido do estoque.'
            );
          })
          .catch(() => {
            showToast?.(
              'Não foi possível remover o item.'
            );
          });

        return;
      }

      showToast?.(
        'Item removido do estoque.'
      );
    } catch {
      showToast?.(
        'Não foi possível remover o item.'
      );
    }
  }

  function handleSalvarItem(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    const formData = new FormData(
      e.currentTarget
    );

    const nome = String(
      formData.get('nome') ?? ''
    ).trim();

    const unidade = String(
      formData.get('unidade') ?? ''
    )
      .trim()
      .toUpperCase();

    const quantidade =
      parseRequiredNonNegativeNumber(
        formData.get('quantidade')
      );

    const minimo =
      parseRequiredNonNegativeNumber(
        formData.get('minimo')
      );

    const custoUnitario =
      parseOptionalNonNegativeNumber(
        formData.get('custoUnitario')
      );

    if (!nome) {
      showToast?.(
        'Informe o nome do item.'
      );
      return;
    }

    if (nome.length > 200) {
      showToast?.(
        'O nome do item excede 200 caracteres.'
      );
      return;
    }

    if (!unidade) {
      showToast?.(
        'Informe a unidade de medida.'
      );
      return;
    }

    if (quantidade === null) {
      showToast?.(
        'Informe uma quantidade válida e não negativa.'
      );
      return;
    }

    if (minimo === null) {
      showToast?.(
        'Informe um estoque mínimo válido e não negativo.'
      );
      return;
    }

    if (custoUnitario === null) {
      showToast?.(
        'Informe um custo válido e não negativo.'
      );
      return;
    }

    const payload: InsumoInput = {
      nome,
      unidade,
      quantidade,
      minimo,
      custoUnitario,
      tipo: abaAtiva
    };

    try {
      if (itemEditando) {
        if (
          typeof updateInsumo !== 'function'
        ) {
          showToast?.(
            'A atualização de itens não está disponível.'
          );
          return;
        }

        const result = updateInsumo(
          itemEditando.id,
          payload
        );

        if (
          result &&
          typeof (
            result as Promise<unknown>
          ).then === 'function'
        ) {
          void (result as Promise<unknown>)
            .then(() => {
              showToast?.(
                'Item atualizado com sucesso!'
              );
              setModalItemOpen(false);
            })
            .catch(() => {
              showToast?.(
                'Não foi possível atualizar o item.'
              );
            });

          return;
        }

        showToast?.(
          'Item atualizado com sucesso!'
        );
      } else {
        if (
          typeof addInsumo !== 'function'
        ) {
          showToast?.(
            'O cadastro de itens não está disponível.'
          );
          return;
        }

        const result = addInsumo(payload);

        if (
          result &&
          typeof (
            result as Promise<unknown>
          ).then === 'function'
        ) {
          void (result as Promise<unknown>)
            .then(() => {
              showToast?.(
                'Novo item adicionado ao estoque!'
              );
              setModalItemOpen(false);
            })
            .catch(() => {
              showToast?.(
                'Não foi possível adicionar o item.'
              );
            });

          return;
        }

        showToast?.(
          'Novo item adicionado ao estoque!'
        );
      }

      setModalItemOpen(false);
    } catch {
      showToast?.(
        'Não foi possível salvar o item.'
      );
    }
  }

  function handleAbrirMovimento(
    item: Insumo,
    tipo: TipoMovimento
  ) {
    setItemMovimento(item);
    setTipoMovimento(tipo);
    setQtdMovimento('');
    setMotivoSaida('Perda / Validade');
    setModalMovimentoOpen(true);
  }

  function handleConfirmarMovimento(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!itemMovimento) {
      return;
    }

    if (
      typeof movimentarEstoque !== 'function'
    ) {
      showToast?.(
        'A movimentação de estoque não está disponível.'
      );
      return;
    }

    const valor =
      parseRequiredNonNegativeNumber(
        qtdMovimento
      );

    if (valor === null || valor <= 0) {
      showToast?.(
        'Informe uma quantidade maior que zero.'
      );
      return;
    }

    if (
      tipoMovimento === 'saida' &&
      valor > itemMovimento.quantidade
    ) {
      showToast?.(
        'A quantidade de saída não pode ser maior que o estoque disponível.'
      );
      return;
    }

    try {
      /**
       * IMPORTANTE:
       * O código original passa somente 3 argumentos.
       * Aqui o motivo é enviado como quarto argumento para não perder
       * a informação selecionada na interface.
       *
       * O hook useEstoque precisa aceitar esse argumento para que ele
       * seja persistido.
       */
      const result = (
        movimentarEstoque as (
          id: string,
          quantidade: number,
          tipo: TipoMovimento,
          motivo?: string
        ) => unknown
      )(
        itemMovimento.id,
        valor,
        tipoMovimento,
        tipoMovimento === 'saida'
          ? motivoSaida
          : undefined
      );

      if (
        result &&
        typeof (
          result as Promise<unknown>
        ).then === 'function'
      ) {
        void (result as Promise<unknown>)
          .then(() => {
            showToast?.(
              tipoMovimento === 'entrada'
                ? `Entrada de ${valor} ${itemMovimento.unidade} registrada!`
                : `Saída de ${valor} ${itemMovimento.unidade} registrada!`
            );
            setModalMovimentoOpen(false);
          })
          .catch(() => {
            showToast?.(
              'Não foi possível registrar a movimentação.'
            );
          });

        return;
      }

      showToast?.(
        tipoMovimento === 'entrada'
          ? `Entrada de ${valor} ${itemMovimento.unidade} registrada!`
          : `Saída de ${valor} ${itemMovimento.unidade} registrada!`
      );

      setModalMovimentoOpen(false);
    } catch {
      showToast?.(
        'Não foi possível registrar a movimentação.'
      );
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn p-2 sm:p-4">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#7a1f2e]/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <Package
              className="w-7 h-7 text-[#7a1f2e]"
              aria-hidden="true"
            />
            Controle de Estoque & Insumos
          </h2>

          <p className="text-sm text-zinc-500 mt-1">
            Gerenciamento de matérias-primas,
            produtos e alertas automáticos de reposição.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            type="button"
            onClick={() => {
              setItensPreview([]);
              setErroImportacao(null);
              setModalImportOpen(true);
            }}
            className="flex-1 md:flex-none border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <FileSpreadsheet
              className="w-4 h-4 text-emerald-600"
              aria-hidden="true"
            />
            Importar Planilha
          </button>

          <button
            type="button"
            onClick={handleAbrirNovoItem}
            className="flex-1 md:flex-none bg-[#7a1f2e] text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#601824] transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <Plus
              className="w-4 h-4"
              aria-hidden="true"
            />
            Novo Item no Estoque
          </button>
        </div>
      </div>

      <div
        className="flex gap-2 border-b border-zinc-200 pb-2"
        role="tablist"
        aria-label="Tipo de estoque"
      >
        <button
          type="button"
          role="tab"
          aria-selected={abaAtiva === 'INSUMO'}
          onClick={() => setAbaAtiva('INSUMO')}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
            abaAtiva === 'INSUMO'
              ? 'bg-[#7a1f2e] text-white'
              : 'text-zinc-500 hover:bg-zinc-100'
          }`}
        >
          Matérias-primas / Revenda
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={
            abaAtiva === 'PRODUTO_FINAL'
          }
          onClick={() =>
            setAbaAtiva('PRODUTO_FINAL')
          }
          className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
            abaAtiva === 'PRODUTO_FINAL'
              ? 'bg-[#7a1f2e] text-white'
              : 'text-zinc-500 hover:bg-zinc-100'
          }`}
        >
          Produtos de Produção
        </button>
      </div>

      {alertas > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle
              className="w-4 h-4 text-amber-600"
              aria-hidden="true"
            />

            <span>
              Atenção: você tem{' '}
              <strong>{alertas}</strong>{' '}
              item(ns) no estoque mínimo ou abaixo dele.
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {lista.map(item => {
          const isBaixo =
            item.quantidade <= item.minimo;

          return (
            <div
              key={item.id}
              className={`bg-white rounded-2xl p-5 shadow-sm border transition-all flex flex-col justify-between space-y-4 relative ${
                isBaixo
                  ? 'border-rose-200 bg-rose-50/10'
                  : 'border-[#7a1f2e]/10 hover:border-[#7a1f2e]/30'
              }`}
            >
              <div>
                <div className="flex justify-between items-start gap-2 mb-2">
                  <h3 className="font-bold text-lg text-zinc-900 leading-snug">
                    {item.nome}
                  </h3>

                  {isBaixo ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 shrink-0">
                      <AlertTriangle
                        className="w-3 h-3"
                        aria-hidden="true"
                      />
                      Baixo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                      OK
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-baseline gap-1.5">
                  <span
                    className={`text-3xl font-extrabold tracking-tight ${
                      isBaixo
                        ? 'text-rose-600'
                        : 'text-zinc-900'
                    }`}
                  >
                    {item.quantidade}
                  </span>

                  <span className="text-xs font-bold text-zinc-500 uppercase">
                    {item.unidade}
                  </span>
                </div>

                <div className="mt-2 text-xs space-y-1 text-zinc-500">
                  <p>
                    Estoque mínimo recomendado:{' '}
                    <span className="font-semibold text-zinc-700">
                      {item.minimo} {item.unidade}
                    </span>
                  </p>

                  {item.custoUnitario > 0 && (
                    <p>
                      Custo:{' '}
                      <span className="font-semibold text-zinc-700">
                        R${' '}
                        {item.custoUnitario.toFixed(2)}{' '}
                        / {item.unidade}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
                <div className="flex gap-1.5 flex-1">
                  <button
                    type="button"
                    onClick={() =>
                      handleAbrirMovimento(
                        item,
                        'entrada'
                      )
                    }
                    className="flex-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2.5 py-2 rounded-lg font-semibold text-xs flex items-center justify-center gap-1 transition-colors"
                  >
                    <ArrowUpRight
                      className="w-3.5 h-3.5"
                      aria-hidden="true"
                    />
                    + Entrada
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleAbrirMovimento(
                        item,
                        'saida'
                      )
                    }
                    className="flex-1 bg-rose-50 text-rose-700 hover:bg-rose-100 px-2.5 py-2 rounded-lg font-semibold text-xs flex items-center justify-center gap-1 transition-colors"
                  >
                    <ArrowDownRight
                      className="w-3.5 h-3.5"
                      aria-hidden="true"
                    />
                    - Perda
                  </button>
                </div>

                <div className="flex items-center gap-1 border-l pl-2 border-zinc-200">
                  <button
                    type="button"
                    aria-label={`Editar ${item.nome}`}
                    title={`Editar ${item.nome}`}
                    onClick={() =>
                      handleAbrirEditarItem(item)
                    }
                    className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                  >
                    <Pencil
                      className="w-3.5 h-3.5"
                      aria-hidden="true"
                    />
                  </button>

                  <button
                    type="button"
                    aria-label={`Excluir ${item.nome}`}
                    title={`Excluir ${item.nome}`}
                    onClick={() =>
                      handleExcluirItem(item.id)
                    }
                    className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2
                      className="w-3.5 h-3.5"
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {modalImportOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-modal-title"
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-zinc-100 animate-fadeIn max-h-[90vh] flex flex-col justify-between">
            <div className="flex justify-between items-center border-b pb-3">
              <h3
                id="import-modal-title"
                className="font-bold text-lg text-zinc-900 flex items-center gap-2"
              >
                <FileSpreadsheet
                  className="w-5 h-5 text-emerald-600"
                  aria-hidden="true"
                />
                Importar Insumos por Planilha
              </h3>

              <button
                type="button"
                aria-label="Fechar"
                onClick={() =>
                  setModalImportOpen(false)
                }
                className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-500"
              >
                <X
                  className="w-5 h-5"
                  aria-hidden="true"
                />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1">
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-xs text-zinc-800 uppercase tracking-wider">
                    Passo 1: Baixar modelo padrão
                  </p>

                  <p className="text-xs text-zinc-500 mt-0.5">
                    Utilize a tabela modelo preenchida
                    com as colunas corretas.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadModelo}
                  className="bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-100 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-sm"
                >
                  <Download
                    className="w-3.5 h-3.5 text-zinc-500"
                    aria-hidden="true"
                  />
                  Baixar Modelo (.CSV)
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-xs text-zinc-800 uppercase tracking-wider">
                  Passo 2: Fazer upload do arquivo preenchido
                </label>

                <div className="border-2 border-dashed border-zinc-300 rounded-xl p-5 text-center hover:border-[#7a1f2e] transition-colors relative bg-zinc-50/50">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    aria-label="Selecionar arquivo CSV"
                  />

                  <Upload
                    className="w-8 h-8 text-zinc-400 mx-auto mb-2"
                    aria-hidden="true"
                  />

                  <p className="text-xs font-semibold text-zinc-700">
                    Clique para selecionar um arquivo CSV
                  </p>

                  <p className="text-[11px] text-zinc-400 mt-1">
                    Máximo: 5 MB / 5000 itens
                  </p>

                  <p className="text-[11px] text-zinc-400 mt-1">
                    Colunas esperadas: Nome do Item |
                    Unidade | Quantidade | Custo |
                    Estoque Mínimo
                  </p>
                </div>
              </div>

              {erroImportacao && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-start gap-2 whitespace-pre-line">
                  <AlertTriangle
                    className="w-4 h-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{erroImportacao}</span>
                </div>
              )}

              {itensPreview.length > 0 && (
                <div className="space-y-2">
                  <p className="font-bold text-xs text-emerald-700 flex items-center gap-1">
                    <CheckCircle2
                      className="w-4 h-4"
                      aria-hidden="true"
                    />
                    {itensPreview.length} item(ns)
                    identificados para importação:
                  </p>

                  <div className="border border-zinc-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-zinc-100 text-zinc-700 font-bold sticky top-0">
                        <tr>
                          <th className="p-2 border-b">
                            Nome
                          </th>
                          <th className="p-2 border-b">
                            Un.
                          </th>
                          <th className="p-2 border-b text-right">
                            Qtd
                          </th>
                          <th className="p-2 border-b text-right">
                            Custo
                          </th>
                          <th className="p-2 border-b text-right">
                            Mín.
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-zinc-100 text-zinc-800">
                        {itensPreview.map(
                          (item, index) => (
                            <tr
                              key={`${item.nome}-${index}`}
                              className="hover:bg-zinc-50"
                            >
                              <td className="p-2 font-medium">
                                {item.nome}
                              </td>

                              <td className="p-2 text-zinc-500 uppercase">
                                {item.unidade}
                              </td>

                              <td className="p-2 text-right font-bold">
                                {item.quantidade}
                              </td>

                              <td className="p-2 text-right">
                                R${' '}
                                {item.custoUnitario.toFixed(
                                  2
                                )}
                              </td>

                              <td className="p-2 text-right text-zinc-500">
                                {item.minimo}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-3 border-t mt-3">
              <button
                type="button"
                onClick={() =>
                  setModalImportOpen(false)
                }
                className="flex-1 py-2.5 rounded-xl border border-zinc-300 font-semibold text-sm text-zinc-700 hover:bg-zinc-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={
                  itensPreview.length === 0
                }
                onClick={handleConfirmarImportacao}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Confirmar e Processar (
                {itensPreview.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {modalItemOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="item-modal-title"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-zinc-100 animate-fadeIn">
            <div className="flex justify-between items-center border-b pb-3">
              <h3
                id="item-modal-title"
                className="font-bold text-lg text-zinc-900"
              >
                {itemEditando
                  ? 'Editar Item'
                  : 'Novo Item no Estoque'}
              </h3>

              <button
                type="button"
                aria-label="Fechar"
                onClick={() =>
                  setModalItemOpen(false)
                }
                className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-500"
              >
                <X
                  className="w-5 h-5"
                  aria-hidden="true"
                />
              </button>
            </div>

            <form
              onSubmit={handleSalvarItem}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="nome-item"
                  className="block text-xs font-bold text-zinc-700 mb-1"
                >
                  Nome do Item / Insumo
                </label>

                <input
                  id="nome-item"
                  name="nome"
                  required
                  maxLength={200}
                  defaultValue={
                    itemEditando?.nome || ''
                  }
                  placeholder="Ex: Farinha de Trigo Tipo 1"
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a1f2e]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="unidade-item"
                    className="block text-xs font-bold text-zinc-700 mb-1"
                  >
                    Unidade de Medida
                  </label>

                  <select
                    id="unidade-item"
                    name="unidade"
                    defaultValue={
                      itemEditando?.unidade || 'KG'
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#7a1f2e]"
                  >
                    {UNIDADES.map(unidade => (
                      <option
                        key={unidade}
                        value={unidade}
                      >
                        {unidade}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="custo-item"
                    className="block text-xs font-bold text-zinc-700 mb-1"
                  >
                    Custo Un. (R$)
                  </label>

                  <input
                    id="custo-item"
                    name="custoUnitario"
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    defaultValue={
                      itemEditando?.custoUnitario ?? ''
                    }
                    placeholder="0.00"
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a1f2e]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="quantidade-item"
                    className="block text-xs font-bold text-zinc-700 mb-1"
                  >
                    Quantidade Atual
                  </label>

                  <input
                    id="quantidade-item"
                    name="quantidade"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    inputMode="decimal"
                    defaultValue={
                      itemEditando?.quantidade ?? ''
                    }
                    placeholder="0"
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#7a1f2e]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="minimo-item"
                    className="block text-xs font-bold text-zinc-700 mb-1"
                  >
                    Estoque Mínimo
                  </label>

                  <input
                    id="minimo-item"
                    name="minimo"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    inputMode="decimal"
                    defaultValue={
                      itemEditando?.minimo ?? ''
                    }
                    placeholder="0"
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a1f2e]"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() =>
                    setModalItemOpen(false)
                  }
                  className="flex-1 py-2.5 rounded-xl border border-zinc-300 font-semibold text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#7a1f2e] text-white font-semibold text-sm hover:bg-[#601824]"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalMovimentoOpen &&
        itemMovimento && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="movimento-modal-title"
          >
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-5 shadow-2xl border border-zinc-100 animate-fadeIn">
              <div className="flex justify-between items-center border-b pb-3">
                <h3
                  id="movimento-modal-title"
                  className="font-bold text-base text-zinc-900 flex items-center gap-2"
                >
                  {tipoMovimento === 'entrada' ? (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <ArrowUpRight
                        className="w-5 h-5"
                        aria-hidden="true"
                      />
                      Nova Entrada
                    </span>
                  ) : (
                    <span className="text-rose-600 flex items-center gap-1">
                      <ArrowDownRight
                        className="w-5 h-5"
                        aria-hidden="true"
                      />
                      Registrar Perda / Uso
                    </span>
                  )}
                </h3>

                <button
                  type="button"
                  aria-label="Fechar"
                  onClick={() =>
                    setModalMovimentoOpen(
                      false
                    )
                  }
                  className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-500"
                >
                  <X
                    className="w-5 h-5"
                    aria-hidden="true"
                  />
                </button>
              </div>

              <div>
                <p className="font-bold text-zinc-900 text-lg">
                  {itemMovimento.nome}
                </p>

                <p className="text-xs text-zinc-500">
                  Atual:{' '}
                  <strong>
                    {itemMovimento.quantidade}{' '}
                    {itemMovimento.unidade}
                  </strong>
                </p>
              </div>

              <form
                onSubmit={
                  handleConfirmarMovimento
                }
                className="space-y-4"
              >
                <div>
                  <label
                    htmlFor="quantidade-movimento"
                    className="block text-xs font-bold text-zinc-700 mb-1"
                  >
                    Quantidade a{' '}
                    {tipoMovimento === 'entrada'
                      ? 'adicionar'
                      : 'remover'}{' '}
                    ({itemMovimento.unidade})
                  </label>

                  <input
                    id="quantidade-movimento"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    autoFocus
                    value={qtdMovimento}
                    onChange={e =>
                      setQtdMovimento(
                        e.target.value
                      )
                    }
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 font-bold text-xl text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#7a1f2e]"
                  />
                </div>

                {tipoMovimento === 'saida' && (
                  <div>
                    <label
                      htmlFor="motivo-saida"
                      className="block text-xs font-bold text-zinc-700 mb-1"
                    >
                      Motivo da Saída
                    </label>

                    <select
                      id="motivo-saida"
                      value={motivoSaida}
                      onChange={e =>
                        setMotivoSaida(
                          e.target.value
                        )
                      }
                      className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 text-sm bg-white"
                    >
                      <option value="Perda / Validade">
                        Produto Vencido / Estragado
                      </option>

                      <option value="Dano / Quebra">
                        Dano ou Quebra no Manejo
                      </option>

                      <option value="Consumo Interno">
                        Consumo da Equipe
                      </option>

                      <option value="Ajuste de Inventario">
                        Ajuste de Contagem
                      </option>
                    </select>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      setModalMovimentoOpen(
                        false
                      )
                    }
                    className="flex-1 py-2.5 rounded-xl border border-zinc-300 font-semibold text-sm text-zinc-700 hover:bg-zinc-50"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className={`flex-1 py-2.5 rounded-xl text-white font-semibold text-sm ${
                      tipoMovimento === 'entrada'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                  >
                    Confirmar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </div>
  );
}