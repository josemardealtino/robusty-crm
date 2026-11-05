# Estado Atual de Implementação — Robusty CRM

**Data:** 02/11/2026  
**Status Geral:** Funis Leads e Pedidos configurados e testados com sucesso no novo Supabase.

---

## 1. Conexão e Banco de Dados Supabase
- **Projeto conectado:** Supabase Cloud (`rpydmxvvxttposaaikeo`)
- **Organização:** Robusty (`id: 23533966-6d2f-42fd-898a-6318e9e1549c`)
- **Administrador:** `ti@grupomixfer.com.br`
- **Ambiente legado:** Totalmente preservado e intocado. Apenas o novo projeto Supabase foi manipulado.

---

## 2. Funis Criados e Ativos
1. **Funil `Leads` (Comercial)**:
   - ID: `9f77c2ce-08cc-4ac7-a2f0-48f4ce9d8732`
   - Default: `true` (Funil padrão de entrada)
   - 10 Etapas ativas (`Novo lead` até `Venda ganha` / `Venda perdida`)
   - 15 campos customizados do negócio com condicionais e validações de etapa
   - 9 motivos de perda cadastrados no vocabulário nativo
2. **Funil `Pedidos` (Logística & Operação)**:
   - ID: `28df8647-9940-4b4c-a997-2d1289e1e27c`
   - Default: `false`, `is_client_pipeline: true`
   - 9 Etapas operacionais (`Pedido recebido` até `Pedido concluído` / `Pedido cancelado`)
   - 17 campos customizados (segregação condicional entre Transportadora e Instalação na loja)
   - 5 motivos de cancelamento cadastrados

---

## 3. Testes Executados e Resultados
- **Script executado:** `scripts/verify-funis.js`
- **Resultado:**
  - Leitura dos 2 pipelines persistidos: **100% OK**.
  - Validação de etapas e posições: **100% OK**.
  - Criação de lead de teste com campos mínimos e campos personalizados: **100% OK**.
  - Limpeza imediata do lead de teste: **100% OK** (banco permanece limpo).
  - Testes unitários do repositório: 41 testes de branding passando.

---

## 4. Inspeção das Particularidades P01 na Base Clonada

| Item P01 | Status na Base Clonada Atual | Detalhe Técnico |
| :--- | :---: | :--- |
| **Editor visual de campos do funil** | **Existe nativamente** | Implementado em `/app/settings/pipelines` (`CustomFieldsEditor`, `mostrar_quando`, `obrigatorio_em`). Permite adicionar, editar opções e condicionais. |
| **Campos Condicionais** | **Existe nativamente** | Implementado via `mostrar_quando` em `lib/schemas/mostrar-quando.ts` e renderizado em `LeadFieldsForm.tsx`. |
| **Validações por Etapa / Ganho / Perda** | **Existe nativamente** | Implementado via `obrigatorio_em` em `lib/leads/campos-exigidos.ts`. |
| **Múltipla escolha nativa** | **Existe nativamente** | Implementado via `searchable_select` com `multiple: true`. |
| **ID Comercial Único (ex: `ROB-2026-000001`)** | **Implementado e ativo** | Gerado automaticamente e de forma atômica no banco Postgres via trigger `trg_generate_lead_commercial_id` com sequence `seq_crm_leads_commercial_id`. Exibido no card do Kanban, no perfil do lead (com botão de cópia rápida) e suportado na busca do funil. |
| **Conversão Leads -> Pedidos** | **Implementado e ativo** | Botão **Criar pedido** no dossiê do lead (`LeadDossier.tsx` + `createOrderFromLead.ts`). Preserva o mesmo `commercial_id` (`ROB-2026-XXXXXX`), copia 100% dos campos preenchidos, mapeia os campos operacionais e garante idempotência no banco (`uniq_crm_leads_org_pipeline_commercial_id`) e na aplicação. |
| **Persistência de Campos entre Etapas e Funis** | **Implementado e ativo** | `mesclarCamposDoPerfil` (`lib/leads/campos-do-perfil.ts`) garante que qualquer campo já preenchido permaneça visível e editável no perfil do lead/pedido independentemente da etapa ou do funil. |

---

## 5. Pontos Pendentes de Homologação Comercial
- Lista exata e final de modelos compatíveis por veículo (Ducato, Saveiro, etc.) a ser revisada após uso pela equipe de vendas.
- Lista final de status de emissão fiscal e regras de NF-e com o Igor.
- Regra de fechamento: pagamento confirmado (implementado no funil Leads conforme o desenho mais recente).
