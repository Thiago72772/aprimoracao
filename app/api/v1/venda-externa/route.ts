import { supabase } from "@/lib/supabase";
import { createHash } from "crypto";

export async function POST(req: Request) {
  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return Response.json({ erro: "Chave de API não informada" }, { status: 401 });
    }

    // 1. Criptografia da chave recebida para comparação no banco
    const hash = createHash("sha256").update(apiKey).digest("hex");

    // 2. Validação da credencial do PDV
    const { data: cred } = await supabase
      .from("pdv_credenciais")
      .select("chave_hash")
      .eq("ativo", true)
      .eq("chave_hash", hash)
      .maybeSingle();

    if (!cred) {
      return Response.json({ erro: "Credencial inválida ou inativa" }, { status: 401 });
    }

    const body = await req.json();

    // 3. Validação do payload
    if (!Array.isArray(body.itens) || body.itens.length === 0) {
      return Response.json({ erro: "Payload inválido: informe a lista de 'itens'" }, { status: 400 });
    }

    const idempotencyKey = req.headers.get("idempotency-key") ?? body.venda_id;
    if (!idempotencyKey) {
      return Response.json({ erro: "Header 'idempotency-key' ou campo 'venda_id' é obrigatório" }, { status: 400 });
    }

    // 4. Execução atômica no Postgres (RPC)
    const { data, error } = await supabase.rpc("registrar_venda_externa", {
      p_itens: body.itens,
      p_idempotency_key: String(idempotencyKey),
      p_origem: "pdv_balcao",
    });

    if (error) {
      return Response.json({ erro: "Falha ao processar venda no estoque", detalhe: error.message }, { status: 422 });
    }

    return Response.json(data, { status: 200 });
  } catch (err: any) {
    return Response.json({ erro: "Erro interno no servidor", detalhe: err.message }, { status: 500 });
  }
}