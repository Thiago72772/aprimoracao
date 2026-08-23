---
name: pao-e-leite-frontend
description: Conventions for building the frontend of the "Pão e Leite" bakery management system in Bolt (Next.js + React + TypeScript + Tailwind + shadcn/ui). Use whenever the user asks to build, extend, restyle, or fix a screen in the Pão e Leite app — PDV, Caixa, Produtos, Estoque, or the app shell/navigation — even if they don't mention "Pão e Leite" or "padaria" directly.
---

# Pão e Leite — Frontend

Visual identity and structure conventions for the "Pão e Leite" bakery management system. The app is built as a Next.js + React + TypeScript project using Tailwind CSS and shadcn/ui-style components. Business logic is intentionally deferred — screens ship with mock data and `// TODO: lógica aqui` markers where real logic will land later.

## Visual identity

Brand colors are defined as CSS custom properties in `app/globals.css` and surfaced as typed tokens in `lib/brand-config.ts`. Never hardcode a raw hex color inside a component — always reference a token so the palette stays in one place.

- **Name:** Pão e Leite. **Slogan:** "Padaria · Confeitaria · Almoço".
- **Primary (brand wine):** `#7a1f2e`, white text on it.
- **Support (gold):** `#e8c079`.
- **Soft brand background:** `#f6e9d1`.
- **Neutral background:** zinc-50.
- **Typography:** Plus Jakarta Sans (or similar clean sans), max 3 weights. Body line-height 150%, headings 120%.
- **Cards:** rounded corners, soft shadow, high contrast. 8px spacing system throughout.

## Folder structure

```
app/{page.tsx, layout.tsx, globals.css}
components/{app-sidebar.tsx, pdv-screen.tsx, caixa-screen.tsx,
  produtos-screen.tsx, estoque-screen.tsx}
components/ui/  (shadcn primitives: button, input, card, table, badge, sheet, ...)
lib/{brand-config.ts, mock-data.ts, utils.ts}
hooks/use-mobile.ts
```

Keep one screen per file. Shared types and mock data live in `lib/`. UI primitives stay in `components/ui/` untouched.

## Screens

1. **Sidebar / navigation** — icons + labels for PDV, Caixa, Produtos, Estoque. Collapses to icons on medium screens, becomes a bottom nav on mobile (via `use-mobile`). Brand name at the top.
2. **PDV** — product grid (clickable cards with name, price, emoji/icon), cart panel beside it on desktop, as a bottom-pulled `Sheet` on mobile. Payment method buttons (Pix / Cartão / Dinheiro) and a large "Finalizar Venda" button.
3. **Caixa** — "closed" state with "Abrir Caixa" + initial balance input; "open" state with shift sales summary, entry/exit buttons, and "Fechar Caixa" opening a closing summary (sales by weight vs. unit, by payment method, cash difference). Interface only, fictional numbers.
4. **Produtos** — table/list with name, price, category, unit (un/kg/fatia). "Novo Produto" opens a `Sheet` form. Each row has edit/remove icon actions. Mock only.
5. **Estoque** — list of inputs with current qty, minimum, and a discreet low-stock alert. "Nova Entrada de Insumo" opens a `Sheet` form. Edit/remove per row.

## Responsiveness

Every screen must work without horizontal scroll at 375px width and feel comfortable on desktop. Use the `use-mobile` hook to switch between desktop and mobile layouts (e.g. sidebar vs. bottom nav, side panel vs. bottom sheet).

## Mock data and TODO markers

All data is fictional and lives in `lib/mock-data.ts`. Where real business logic will later land, leave a `// TODO: lógica aqui` comment so the integration point is obvious. No persistence yet — state is in-memory React state only.
