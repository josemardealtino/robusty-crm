import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildCardInput } from "@/lib/kanban/card-state";
import { applyFilters } from "@/lib/kanban/filters";
import type { Lead } from "@/lib/types/leads";

describe("Identificador Único Comercial de Leads (P01 / Robusty)", () => {
  const mockLead: Lead = {
    id: "lead-uuid-1",
    commercial_id: "ROB-2026-000042",
    organization_id: "org-uuid-1",
    pipeline_id: "pipe-uuid-1",
    stage_id: "stage-uuid-1",
    contact_id: null,
    title: "Venda Especial",
    description: "Observações do pedido",
    status: "open",
    lost_reason: null,
    position_in_stage: 1000,
    value_cents: 150000,
    currency: "BRL",
    owner_user_id: null,
    owner_kind: null,
    owner_agent_id: null,
    stage_changed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    expected_close_date: null,
    closed_at: null,
    source: "manual",
    source_metadata: {},
    external_id: null,
    custom_fields: {},
    tags: ["vip"],
    created_by_user_id: null,
  };

  it("buildCardInput preserva commercialId do lead para exibição no card", () => {
    const card = buildCardInput(mockLead, {
      stageName: "Novo lead",
      ownerNames: undefined,
    });
    expect(card.commercialId).toBe("ROB-2026-000042");
    expect(card.title).toBe("Venda Especial");
  });

  it("applyFilters encontra o lead ao pesquisar pelo commercial_id", () => {
    const leads = [
      mockLead,
      {
        ...mockLead,
        id: "lead-uuid-2",
        commercial_id: "ROB-2026-000043",
        title: "Outro Cliente",
      },
    ];

    // Busca exata pelo ID
    const filtrado1 = applyFilters(leads, { search: "ROB-2026-000042" });
    expect(filtrado1).toHaveLength(1);
    expect(filtrado1[0]?.id).toBe("lead-uuid-1");

    // Busca por número sequencial do ID
    const filtrado2 = applyFilters(leads, { search: "000043" });
    expect(filtrado2).toHaveLength(1);
    expect(filtrado2[0]?.id).toBe("lead-uuid-2");
  });

  it("migration de commercial_id está versionada com manifesto e apêndice no baseline.sql", () => {
    const migrationPath = join(
      __dirname,
      "..",
      "..",
      "supabase",
      "migrations",
      "20261102220000_9084_lead_commercial_id.sql",
    );
    expect(existsSync(migrationPath)).toBe(true);

    const migrationContent = readFileSync(migrationPath, "utf-8");
    expect(migrationContent).toContain("-- manifest:");
    expect(migrationContent).toContain("commercial_id");
    expect(migrationContent).toContain("fn_generate_lead_commercial_id");

    const baselinePath = join(__dirname, "..", "..", "supabase", "baseline.sql");
    const baselineContent = readFileSync(baselinePath, "utf-8");
    expect(baselineContent).toContain("commercial_id");
    expect(baselineContent).toContain("fn_generate_lead_commercial_id");
  });
});
