# 🚛 Documentação Técnica — Robusty CRM

Este diretório contém a documentação técnica, decisões de arquitetura e registros de evolução do **Robusty CRM**, desenvolvido sobre a base open source do **DeskcommCRM**.

---

## 📌 Sumário
1. [Visão Geral do Negócio Robusty](#visão-geral-do-negócio-robusty)
2. [Estrutura Comercial & Papéis](#estrutura-comercial--papéis)
3. [Funil de Vendas (Kanban Pipelines)](#funil-de-vendas-kanban-pipelines)
4. [Catálogo de Veículos, Produtos & Regras de Instalação](#catálogo-de-veículos-produtos--regras-de-instalação)
5. [Agente de IA (Atendimento, RAG e Handoff)](#agente-de-ia-atendimento-rag-e-handoff)
6. [Arquitetura de Dados & Supabase](#arquitetura-de-dados--supabase)
7. [Histórico de Mudanças Estruturais](#histórico-de-mudanças-estruturais)

---

## 1. Visão Geral do Negócio Robusty
- **Empresa**: Robusty ([robusty.com.br](https://robusty.com.br))
- **Localização**: Rua Dante Marteletti, 122 - Jardim Maringá, São Paulo - SP, CEP 03525-150.
- **Atuação**: Fabricação e comercialização de bagageiros de alta resistência em aço carbono com pintura epóxi eletrostática e acessórios especializados para veículos de trabalho (utilitários) e projetos especiais/motorhomes.
- **Público-alvo**: Autônomos, prestadores de serviços (instaladores, eletricistas), frotas, comerciantes, proprietários de vans e entusiastas de motorhome/Kombi.
- **Canais de Entrada**: WhatsApp, Instagram Direct, Facebook, Atendimento Presencial e Site.

---

## 2. Estrutura Comercial & Papéis

| Ator | Responsabilidades no CRM |
| :--- | :--- |
| **Agente de IA (Robusty Bot)** | Atendimento receptivo imediato 24/7, qualificação de veículo/necessidade, apresentação de orçamentos padrão e triagem. |
| **Norlando (Comercial / Vendas)** | Atendimento consultivo especializado, negociações, fechamento de orçamentos, aplicação de descontos de tabela e agendamento na loja. |
| **Igor (Gestão / Operações)** | Cotações fora de padrão/personalizadas, geração de links de pagamento, emissão de NF-e, despacho com transportadoras e alinhamento logístico. |
| **Loja Física (Oficina SP)** | Recepção de clientes presenciais, preparação do produto e realização de instalações agendadas no veículo do cliente. |

---

## 3. Funil de Vendas (Kanban Pipelines)

1. **Entrada de Leads**: Leads originados de campanhas e canais digitais.
2. **Qualificação & Triagem**: Veículo (Kombi, Fiorino, Kangoo, Saveiro, etc.), ano, modelo e aplicação (trabalho vs motorhome).
3. **Orçamento Enviado**: Proposta com opções de bagageiro e acessórios complementares (escada, deck de madeira, suporte de estepe, toldo, placas solares).
4. **Cotação Especial (Igor)**: Avaliação de projetos especiais, alterações estruturais ou frete com transportadora.
5. **Aguardando Pagamento**: Link de pagamento enviado (10x sem juros no cartão ou 5% no PIX).
6. **Expedição / Transportadora (Caminho A)**: Preparação, coleta agendada com transportadora e envio de NF.
7. **Agendado na Loja SP (Caminho B)**: Agendamento formal na oficina da Rua Dante Marteletti, 122.
8. **Concluído / Ganho**: Produto entregue ou instalado com cliente satisfeito.
9. **Perdido**: Motivo de perda registrado para análise e melhoria da IA/comercial.

---

## 4. Catálogo de Veículos, Produtos & Regras de Instalação

### 4.1. Veículos Atendidos
- **VW Kombi**: MX 100 (sem aba), MX 100 Plus (aba dupla), MX 200 Plus (aba lateral), MX 80 Plus (2,20m), MX 50 Plus (1,00m).
- **Renault Kangoo**: KX 100 (aba dupla), KX 200 (aba lateral), KX 200 Nova (aumenta aprox. 20cm na altura do carro).
- **Fiat Fiorino**: FX 100 (aba dupla), FX 200 (aba lateral - compatível com guia de rolete). Instalação: R$ 200,00.
- **Fiat Doblo**: DX 100, DX 200. Instalação: R$ 200,00.
- **Peugeot Expert / Citroën Jumpy / Fiat Scudo**: MX 120 (2,65m), Aba Dupla, Extreme (3,30m).
- **Fiat Ducato Max Cargo 2023**: 3,65m x 1,70m.
- **VW Saveiro**: Cabine Simples, Cabine Dupla, compatível com guia de rolete especial Saveiro.

### 4.2. Acessórios & Serviços
- Escadas removíveis e kits de fixação com ventosas.
- Suportes de estepe e suportes de base para toldo (incluindo modelo Leroy).
- Barras para fixação de placas solares (motorhome).
- Aplicação de Decks de madeira tratada (bagageiros e degraus de escada).
- Serviços: Instalação com rebite/forração (R$ 340,00), corte para embutir climatizador (R$ 140,00), zincagem (R$ 390,00 até 30kg).

---

## 5. Agente de IA (Atendimento, RAG e Handoff)
- **Engine**: Vercel AI SDK integrado com OpenAI GPT-4o / GPT-4o-mini.
- **RAG (Retrieval-Augmented Generation)**: Vetores armazenados no Supabase (pgvector) com especificações de produtos, medidas e regras comerciais.
- **Gatilhos de Handoff para Norlando**:
  - Pedido de desconto acima de 5% à vista ou negociação fora de tabela.
  - Solicitação de modificação ou projeto sob medida.
  - Pedido explícito do cliente para falar com um humano.
  - Dúvida sobre link de pagamento e nota fiscal.

---

## 6. Arquitetura de Dados & Supabase
- **Banco**: Supabase Cloud PostgreSQL com Row Level Security (RLS).
- **Esquema**: Tabelas multi-tenant alimentadas pelo `baseline.sql`.
- **Canal WhatsApp**: WAHA (WhatsApp HTTP API - engine NOWEB) via container Docker.

---

## 7. Histórico de Mudanças Estruturais
- **2026-11-02**: Clonagem inicial da base DeskcommCRM (Next.js 16 + Supabase).
- **2026-11-02**: Mapeamento do fluxo comercial Robusty (Norlando / Igor / Loja) e criação da documentação técnica inicial.
- **2026-11-02**: Conexão com o Supabase Cloud e aplicação das 220 tabelas relacionais (`baseline.sql`) com suporte a vetores `pgvector`.
- **2026-11-02**: Criação do primeiro usuário Super Admin da Robusty (`ti@grupomixfer.com.br`) e organização cadastrada.
- **2026-11-02**: Configuração do Funil de Vendas oficial da Robusty no banco de dados com as 8 etapas operacionais (Entrada de Leads, Qualificação, Orçamento, Cotação Especial, Pagamento, Expedição, Agendado na Loja, Concluído/Ganho e Perdido).
- **2026-11-02**: Customização da identidade visual da tela de login: redirecionamento direto da raiz, remoção de opções desnecessárias (Google / Criar conta), logo e favicon oficiais da Robusty, botão "Entrar" com laranja vibrante `#ff6701` e link "Esqueci minha senha" em tom neutro tendencioso ao preto.
- **2026-11-02**: Recriação e separação dos funis operacionais no novo Supabase: Funil `Leads` (comercial, 10 etapas, 15 campos customizados com condicionais e validações de etapa) e Funil `Pedidos` (logística e entrega/instalação, 9 etapas, 17 campos customizados). Documentação em `docs/robusty/DIAGNOSTICO_FUNIS.md`, `docs/robusty/FUNIS_E_CAMPOS.md` e `docs/robusty/ESTADO_ATUAL.md`.
