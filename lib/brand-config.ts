export interface BrandConfig {
  name: string;
  tagline: string;
  logoUrl?: string;
  contact: {
    phone: string;
    email: string;
    address: string;
  };
  settings: {
    currencySymbol: string;
    lowStockThreshold: number;
    taxRate: number;
  };
}

export const brandConfig: BrandConfig = {
  name: "Pão & Leite",
  tagline: "Gestão Integrada de Padaria e Conveniência",
  contact: {
    phone: "(85) 99999-8888",
    email: "contato@paoeleite.com.br",
    address: "Av. Principal, 1000 - Centro",
  },
  settings: {
    currencySymbol: "R$",
    lowStockThreshold: 10,
    taxRate: 0.0,
  },
};