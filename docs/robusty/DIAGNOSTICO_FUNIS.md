# Diagnóstico do Schema e Inventário de Funis — Robusty CRM

**Data:** 02/11/2026  
**Ambiente:** Supabase Cloud (Novo Projeto)  
**Project Ref:** `rpydmxvvxttposaaikeo`  
**URL:** `https://rpydmxvvxttposaaikeo.supabase.co`  
**Organização Ativa:** Robusty (`id: 23533966-6d2f-42fd-898a-6318e9e1549c`, `slug: robusty`)  
**Usuário Administrador:** `ti@grupomixfer.com.br` (`id: a933837f-2c21-46ff-9a39-bc73b272917a`)

---

## 1. Inventário do Banco de Dados

### 1.1 Tabelas e Schema Base
- **Total de tabelas públicas:** ~220 tabelas aplicadas via `supabase/baseline.sql` compatível com DeskcommCRM (Next.js 16 + Turbopack).
- **Extensões ativas:** `pgcrypto`, `vector` (pgvector 0.8.0), `citext`, `pg_trgm`, `uuid-ossp`.
- **Row Level Security (RLS):** Ativado em todas as tabelas multi-tenant com funções canônicas `fn_user_org_ids()` e `fn_user_role_in_org()`.
- **Permissões e RBAC:** Super Admin atribuído à organização Robusty com role `owner` / `admin`.

### 1.2 Mecanismo de Campos Personalizados no DeskcommCRM
- **Arquitetura nativa:** No DeskcommCRM, campos personalizados de funil não são tabelas isoladas como `crm_custom_fields`, mas sim armazenados de forma estruturada no JSONB `crm_pipelines.settings.fields`, validados via Zod (`pipelineConfigPatchSchema` / `customFieldSchema` em `lib/schemas/settings.ts`).
- **Valores nos negócios:** Os dados preenchidos de cada negócio são persistidos na coluna `crm_leads.custom_fields` (JSONB indexado com GIN `idx_crm_leads_custom_fields_gin`).
- **Capacidades nativas homologadas:**
  - `select`, `searchable_select` (com `allow_new` e `multiple`), `currency`, `text`, `textarea`, `date`, `boolean`.
  - Condicionais: `mostrar_quando` (`{ campo, operador, valor }`).
  - Validações de etapa: `obrigatorio_em` (`{ etapas: [uuid], ao_ganhar: true, ao_perder: true }`).
  - Validação regex: `padrao` e `mensagem_padrao`.

### 1.3 Estado dos Dados Anteriores
- **Funil Comercial anterior:** Funil genérico `Funil Comercial Robusty` (`slug: vendas-robusty`).
- **Leads associados:** 0 (zero leads cadastrados no momento da intervenção). Nenhuma perda de dados ocorreu.
- **Ação:** O funil anterior foi atualizado com segurança e renomeado para se tornar o funil `Leads` (idempotente e preservando a integridade referencial do banco).

---

## 2. Configuração Efetiva dos Funis

### 2.1 Funil `Leads` (Comercial)
- **ID:** `9f77c2ce-08cc-4ac7-a2f0-48f4ce9d8732`
- **Slug:** `leads`
- **Default:** `true` (Funil padrão de entrada)
- **Etapas ativas (10 etapas):**
  1. `Novo lead` (pos: 1000, cor: `#3b82f6`)
  2. `Em qualificação` (pos: 2000, cor: `#6366f1`)
  3. `Aguardando atendimento comercial` (pos: 3000, cor: `#8b5cf6`, `requires_human: true`)
  4. `Aguardando cotação` (pos: 4000, cor: `#ec4899`)
  5. `Preparação do orçamento` (pos: 5000, cor: `#f97316`)
  6. `Orçamento enviado` (pos: 6000, cor: `#eab308`)
  7. `Em negociação` (pos: 7000, cor: `#14b8a6`)
  8. `Aguardando pagamento` (pos: 8000, cor: `#06b6d4`)
  9. `Venda ganha` (pos: 9000, cor: `#22c55e`, Terminal Ganho: `is_won: true`)
  10. `Venda perdida` (pos: 10000, cor: `#ef4444`, Terminal Perdido: `is_lost: true`)
- **Campos configurados:** 15 campos de negócio mapeados com opções canônicas, condicionais e validações de etapa.

### 2.2 Funil `Pedidos` (Operação & Entrega/Instalação)
- **ID:** `28df8647-9940-4b4c-a997-2d1289e1e27c`
- **Slug:** `pedidos`
- **Default:** `false`
- **is_client_pipeline:** `true`
- **Etapas ativas (9 etapas):**
  1. `Pedido recebido` (pos: 1000, cor: `#3b82f6`)
  2. `Modalidade definida` (pos: 2000, cor: `#6366f1`)
  3. `Aguardando preparação` (pos: 3000, cor: `#8b5cf6`)
  4. `Em preparação` (pos: 4000, cor: `#ec4899`)
  5. `Aguardando entrega ou instalação` (pos: 5000, cor: `#f97316`)
  6. `Em entrega ou instalação` (pos: 6000, cor: `#eab308`)
  7. `Aguardando finalização` (pos: 7000, cor: `#14b8a6`)
  8. `Pedido concluído` (pos: 8000, cor: `#22c55e`, Terminal Ganho: `is_won: true`)
  9. `Pedido cancelado` (pos: 9000, cor: `#ef4444`, Terminal Perdido: `is_lost: true`)
- **Campos configurados:** 17 campos operacionais com segregação estrita entre Transporte e Instalação na loja.
