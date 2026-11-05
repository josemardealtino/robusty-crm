import { CAMPOS_CONHECIDOS_DO_PERFIL, valorEstaPreenchido } from "./campos-do-perfil";

export interface LeadOrigemParaPedido {
  id: string;
  pipeline_id: string;
  commercial_id?: string | null;
  title: string;
  description?: string | null;
  contact_id?: string | null;
  value_cents?: number | null;
  recurring_value_cents?: number | null;
  recurring_period?: "monthly" | null;
  recurring_months?: number | null;
  currency?: string | null;
  owner_user_id?: string | null;
  owner_agent_id?: string | null;
  owner_kind?: string | null;
  assigned_at?: string | null;
  expected_close_date?: string | null;
  tags?: string[] | null;
  source?: string | null;
  custom_fields?: Record<string, unknown> | null;
}

function rotuloDaOpcao(chaveCampo: string, valor: unknown): string {
  const def = CAMPOS_CONHECIDOS_DO_PERFIL[chaveCampo];
  if (Array.isArray(valor)) {
    return valor
      .map((item) => rotuloDaOpcao(chaveCampo, item))
      .filter((s) => s.length > 0)
      .join(", ");
  }
  if (typeof valor !== "string") return valor != null ? String(valor) : "";
  const texto = valor.trim();
  if (!texto) return "";
  const opcao = def?.options?.find((o) => o.value === texto);
  return opcao?.label ?? texto;
}

/**
 * Monta um resumo legível dos produtos/serviços a partir dos campos comerciais
 * preenchidos no Lead (`produto`, `veiculo`, `ano_versao`, `modelo_bagageiro`,
 * `tipo_de_acessorio`, `acessorios_adicionais`).
 */
export function gerarResumoProdutosDoPedido(customFields: Record<string, unknown>): string | null {
  const partes: string[] = [];

  const produto = rotuloDaOpcao("produto", customFields.produto);
  if (produto) partes.push(`Produto: ${produto}`);

  const modelo = rotuloDaOpcao("modelo_bagageiro", customFields.modelo_bagageiro);
  if (modelo) partes.push(`Modelo: ${modelo}`);

  const tipoAcessorio = rotuloDaOpcao("tipo_de_acessorio", customFields.tipo_de_acessorio);
  if (tipoAcessorio) partes.push(`Tipo de acessório: ${tipoAcessorio}`);

  const veiculo = rotuloDaOpcao("veiculo", customFields.veiculo);
  const anoVersao =
    typeof customFields.ano_versao === "string" ? customFields.ano_versao.trim() : "";
  if (veiculo && anoVersao) {
    partes.push(`Veículo: ${veiculo} (${anoVersao})`);
  } else if (veiculo) {
    partes.push(`Veículo: ${veiculo}`);
  } else if (anoVersao) {
    partes.push(`Ano/versão: ${anoVersao}`);
  }

  const acessorios = rotuloDaOpcao("acessorios_adicionais", customFields.acessorios_adicionais);
  if (acessorios) partes.push(`Acessórios adicionais: ${acessorios}`);

  return partes.length > 0 ? partes.join(" | ") : null;
}

/**
 * Constrói o objeto `custom_fields` completo do Pedido, preservando 100% dos
 * campos preenchidos no Lead de origem e preenchendo automaticamente os campos
 * operacionais correspondentes do funil de Pedidos.
 */
export function montarCamposDoPedido(leadOrigem: {
  id: string;
  pipeline_id: string;
  commercial_id?: string | null;
  custom_fields?: Record<string, unknown> | null;
}): Record<string, unknown> {
  const origem = { ...(leadOrigem.custom_fields ?? {}) };
  delete origem.pedido_gerado_id;
  delete origem.pedido_pipeline_id;

  const resultado: Record<string, unknown> = {
    ...origem,
    lead_origem_id: leadOrigem.id,
    pipeline_origem_id: leadOrigem.pipeline_id,
    referencia_venda: valorEstaPreenchido(origem.referencia_venda)
      ? origem.referencia_venda
      : (leadOrigem.commercial_id ?? leadOrigem.id),
  };

  if (
    !valorEstaPreenchido(resultado.modalidade_entrega) &&
    (origem.modalidade_pretendida === "transportadora" ||
      origem.modalidade_pretendida === "instalacao_loja")
  ) {
    resultado.modalidade_entrega = origem.modalidade_pretendida;
  }

  if (!valorEstaPreenchido(resultado.cep_entrega) && valorEstaPreenchido(origem.cep)) {
    resultado.cep_entrega = origem.cep;
  }

  if (
    !valorEstaPreenchido(resultado.observacoes_operacionais) &&
    valorEstaPreenchido(origem.detalhes_da_necessidade)
  ) {
    resultado.observacoes_operacionais = origem.detalhes_da_necessidade;
  }

  if (!valorEstaPreenchido(resultado.produtos_servicos_pedido)) {
    const resumo = gerarResumoProdutosDoPedido(origem);
    if (resumo) {
      resultado.produtos_servicos_pedido = resumo;
    }
  }

  return resultado;
}
