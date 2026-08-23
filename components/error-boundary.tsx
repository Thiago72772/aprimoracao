'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Essencial para um sistema de caixa: um erro de renderização em qualquer
 * tela nunca deve travar o app inteiro numa tela branca — o operador
 * precisa de um caminho claro para voltar a vender.
 */
export class GlobalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Erro crítico capturado no sistema:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-lg">
            <h2 className="mb-4 text-2xl font-bold text-destructive">Ops! O sistema encontrou um erro.</h2>
            <p className="mb-6 text-muted-foreground">
              Uma instabilidade inesperada ocorreu na interface. Recarregue o sistema para
              continuar as operações — nenhuma venda já registrada é perdida.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Recarregar Sistema
            </button>
            {process.env.NODE_ENV === 'development' && (
              <pre className="mt-6 overflow-auto rounded bg-muted p-4 text-left text-xs text-muted-foreground">
                {this.state.error?.message}
              </pre>
            )}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}