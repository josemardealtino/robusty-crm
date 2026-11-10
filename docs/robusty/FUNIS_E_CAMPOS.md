# Especificação Técnica dos Funis e Campos — Robusty CRM

Este documento consolida as regras de negócio, etapas, dicionário de campos personalizados e validações implementadas para os funis **Leads** (comercial) e **Pedidos** (operacional/logístico) da Robusty.

---

## 1. Funil LEADS (Comercial)

### 1.1 Etapas Operacionais
| Ordem | Nome da Etapa | Slug | Posição | Cor | Tipo / Comportamento |
| :---: | :--- | :--- | :---: | :---: | :--- |
| 1 | **Novo lead** | `novo-lead` | 1000 | `#3b82f6` | Entrada de lead (aberto, dados mínimos de contato) |
| 2 | **Em qualificação** | `em-qualificacao` | 2000 | `#6366f1` | Identificação de produto, veículo e necessidade |
| 3 | **Aguardando atendimento comercial** | `aguardando-atendimento` | 3000 | `#8b5cf6` | Handoff para vendedor humano (`requires_human: true`) |
| 4 | **Aguardando cotação** | `aguardando-cotacao` | 4000 | `#ec4899` | Projetos especiais / frete especial (Igor) |
| 5 | **Preparação do orçamento** | `preparacao-orcamento` | 5000 | `#f97316` | Montagem de proposta, itens, serviços e condições |
| 6 | **Orçamento enviado** | `orcamento-enviado` | 6000 | `#eab308` | Proposta apresentada (exige Produto e Precificação) |
| 7 | **Em negociação** | `em-negociacao` | 7000 | `#14b8a6` | Objeções, ajustes de itens e contrapropostas |
| 8 | **Aguardando pagamento** | `aguardando-pagamento` | 8000 | `#06b6d4` | Link enviado / aguardando comprovante |
| 9 | **Venda ganha** | `venda-ganha` | 9000 | `#22c55e` | **Terminal Ganho** (`is_won: true`, exige Forma e Status de pagamento) |
| 10 | **Venda perdida** | `venda-perdida` | 10000 | `#ef4444` | **Terminal Perdido** (`is_lost: true`, exige Motivo de Perda) |

### 1.2 Dicionário de Campos do Funil Leads
1. **Produto (`produto`)**: `select`
   - Opções: Bagageiro (`bagageiro`), Escada (`escada`), Deck / Meio deck (`deck_meio_deck`), Suporte (`suporte`), Fixação / Ventosas (`fixacao_ventosas`), Outros acessórios (`outros_acessorios`), Serviço (`servico`), A definir (`a_definir`).
   - Validação: Obrigatório na etapa *Orçamento enviado*.
2. **Tipo de acessório (`tipo_de_acessorio`)**: `select`
   - Condicional: exibido quando `produto == outros_acessorios`.
3. **Veículo (`veiculo`)**: `searchable_select`
   - Opções: Volkswagen Kombi, Renault Kangoo, Renault Kangoo Nova, Fiat Fiorino, Fiat Ducato Max Cargo, Fiat Doblò Cargo, Citroën Jumpy, Peugeot Expert, Fiat Scudo, Volkswagen Saveiro - Cabine simples, Volkswagen Saveiro - Cabine dupla, Outro / Não identificado.
4. **Ano / versão (`ano_versao`)**: `text`
5. **Modelo do bagageiro (`modelo_bagageiro`)**: `searchable_select`
   - Condicional: exibido quando `produto == bagageiro`.
   - Opções: MX 100, MX 100 Plus, MX 200 Plus, MX 80 Plus, MX 50 Plus, KX 100, KX 200, KX 200 Nova, FX 100, FX 200, DX 100, DX 200, MX 120, Aba dupla, Extreme, Outro / A definir.
6. **Acessórios adicionais (`acessorios_adicionais`)**: `searchable_select` (`multiple: true`)
   - Opções: Escada removível Kombi, Escada Jumpy / Expert / Scudo, Deck completo, Meio deck, Deck para escada, Suporte de estepe, Base para toldo, Base para toldo Leroy, Suporte de escada com guia de rolete, Par de ventosas, Haste de fixação, Kit de hastes, Kit de fixação para escada, Barra para placa solar, Guia de rolete Saveiro, Instalação, Instalação com rebite, Corte para climatizador.
7. **Detalhes da necessidade (`detalhes_da_necessidade`)**: `textarea`
8. **Modalidade pretendida (`modalidade_pretendida`)**: `select`
   - Opções: Transportadora (`transportadora`), Instalação na loja (`instalacao_loja`), A definir (`a_definir`).
9. **CEP (`cep`)**: `text`
   - Condicional: exibido quando `modalidade_pretendida == transportadora`.
   - Validação regex: `^\d{5}-?\d{3}$`.
10. **Tipo de precificação (`tipo_precificacao`)**: `select`
    - Opções: Tabelado (`tabelado`), Cotação especial (`cotacao_especial`).
    - Validação: Obrigatório na etapa *Orçamento enviado*.
11. **Status da cotação (`status_cotacao`)**: `select`
    - Condicional: exibido quando `tipo_precificacao == cotacao_especial`.
    - Opções: Não necessária, Pendente, Em andamento, Concluída.
12. **Valor do frete (`valor_frete`)**: `currency`
    - Condicional: exibido quando `modalidade_pretendida == transportadora`.
13. **Data de coleta / despacho (`data_coleta_despacho`)**: `date`
    - Condicional: exibido quando `modalidade_pretendida == transportadora`.
14. **Horário de coleta / despacho (`horario_coleta_despacho`)**: `time`
    - Tipo nativo com seletor de horários de 00:00 a 23:30 (passo de 30 min).
    - Condicional: exibido quando `modalidade_pretendida == transportadora`.
    - Sincronização: alimenta a agenda automaticamente como *Coleta Transportadora*.
15. **Data da instalação (`data_instalacao`)**: `date`
    - Condicional: exibido quando `modalidade_pretendida == instalacao_loja`.
16. **Horário da instalação (`horario_instalacao`)**: `time`
    - Tipo nativo com seletor de horários de 00:00 a 23:30 (passo de 30 min).
    - Condicional: exibido quando `modalidade_pretendida == instalacao_loja`.
    - Sincronização: alimenta a agenda automaticamente como *Instalação na Loja (Oficina SP)*.
17. **Forma de pagamento (`forma_pagamento`)**: `select`
    - Opções: Pix (`pix`), Cartão (`cartao`), Transferência (`transferencia`), Outro (`outro`).
    - Validação: Obrigatório para fechar como *Venda ganha*.
18. **Status do pagamento (`status_pagamento`)**: `select`
    - Opções: Pendente (`pendente`), Em conferência (`em_conferencia`), Confirmado (`confirmado`), Não aprovado (`nao_aprovado`).
    - Validação: Obrigatório para fechar como *Venda ganha*.
19. **Motivo de ganho (`motivo_ganho`)**: `select`
    - Opções: Atendimento rápido, Qualidade e resistência do produto, Preço e condições de pagamento, Disponibilidade / Instalação na loja, Indicação / Reputação da marca, Outro motivo.

---

## 2. Funil PEDIDOS (Operação, Logística e Entrega/Instalação)

### 2.1 Etapas Operacionais
| Ordem | Nome da Etapa | Slug | Posição | Cor | Tipo / Comportamento |
| :---: | :--- | :--- | :---: | :---: | :--- |
| 1 | **Pedido recebido** | `pedido-recebido` | 1000 | `#3b82f6` | Entrada após fechamento comercial |
| 2 | **Modalidade definida** | `modalidade-definida` | 2000 | `#6366f1` | Exige seleção de modalidade de entrega |
| 3 | **Aguardando preparação** | `aguardando-preparacao` | 3000 | `#8b5cf6` | Fila de produção/separação |
| 4 | **Em preparação** | `em-preparacao` | 4000 | `#ec4899` | Separação física, pintura epóxi, conferência |
| 5 | **Aguardando entrega ou instalação** | `aguardando-entrega-instalacao` | 5000 | `#f97316` | Aguardando coleta transportadora ou agendamento loja |
| 6 | **Em entrega ou instalação** | `em-entrega-instalacao` | 6000 | `#eab308` | Em rota de envio ou veículo no box da oficina |
| 7 | **Aguardando finalização** | `aguardando-finalizacao` | 7000 | `#14b8a6` | Aguardando canhoto assinado / liberação do cliente |
| 8 | **Pedido concluído** | `pedido-concluido` | 8000 | `#22c55e` | **Terminal Concluído** (`is_won: true`, exige Data e Confirmação) |
| 9 | **Pedido cancelado** | `pedido-cancelado` | 9000 | `#ef4444` | **Terminal Cancelado** (`is_lost: true`, exige Motivo de Cancelamento) |

### 2.2 Dicionário de Campos do Funil Pedidos
1. **Referência da venda / ID da oportunidade (`referencia_venda`)**: `text`
2. **Modalidade de entrega (`modalidade_entrega`)**: `select`
   - Opções: Transportadora (`transportadora`), Instalação na loja (`instalacao_loja`).
   - Validação: Obrigatório na etapa *Modalidade definida*.
3. **Produtos / serviços do pedido (`produtos_servicos_pedido`)**: `textarea`
4. **Status da nota fiscal (`status_nota_fiscal`)**: `select`
   - Opções: Pendente de emissão, Emitida, Enviada ao cliente, Não se aplica.
5. **Número da nota fiscal (`numero_nota_fiscal`)**: `text`
   - Condicional: exibido quando `status_nota_fiscal == emitida`.
6. **Observações operacionais (`observacoes_operacionais`)**: `textarea`
7. **Data de conclusão (`data_conclusao`)**: `date`
   - Validação: Obrigatório ao concluir pedido.
8. **Campos Condicionais de Transportadora:**
   - CEP de entrega (`cep_entrega`): `text` com máscara/regex
   - Endereço de entrega (`endereco_entrega`): `textarea`
   - Transportadora (`transportadora`): `text`
   - Data de coleta / despacho (`data_coleta_despacho`): `date`
   - Horário de coleta / despacho (`horario_coleta_despacho`): `time` (00:00 às 23:30, sincroniza com agenda)
   - Previsão/data de entrega (`previsao_entrega`): `date`
   - Código/link de rastreamento (`codigo_rastreamento`): `text`
9. **Campos Condicionais de Instalação na Loja:**
   - Data da instalação (`data_instalacao`): `date`
   - Horário da instalação (`horario_instalacao`): `time` (00:00 às 23:30, sincroniza com agenda)
   - Local e responsável pela instalação (`local_responsavel_instalacao`): `text` (ex: Box 1, Box 2)
10. **Confirmação de entrega/instalação (`confirmacao_entrega_instalacao`)**: `select`
    - Opções: Pendente, Confirmado pelo cliente, Comprovante anexado, Instalação concluída na loja.
    - Validação: Obrigatório ao concluir pedido.
