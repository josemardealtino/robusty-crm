const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const envContent = fs.readFileSync(".env.local", "utf8");
const env = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = match[2] || "";
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[match[1]] = val;
  }
});

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const SENHA_PADRAO_EQUIPE = "Robusty@2026!";

const PERFIS = {
  admin_ti: {
    email: "ti@grupomixfer.com.br",
    fullName: "Administrador TI (Robusty)",
    role: "admin",
    isPlatformAdmin: true,
    keepExistingPassword: true,
    interface_settings: {
      preset: "completa",
    },
  },
  joao_ricardo: {
    email: "josemardealtino@gmail.com",
    fullName: "João Ricardo",
    role: "admin",
    isPlatformAdmin: false,
    keepExistingPassword: false,
    interface_settings: {
      preset: "completa",
      destinos: [
        "/app/inbox",
        "/app/radar",
        "/app/agenda",
        "/app/templates",
        "/app/kanban",
        "/app/contacts",
        "/app/tasks",
        "/app/ai/agents",
        "/app/ai/followups",
        "/app/ai/cases",
        "/app/connections",
      ],
    },
  },
  norlando: {
    email: "norlando@ironparts.com.br",
    fullName: "Norlando",
    role: "manager",
    isPlatformAdmin: false,
    keepExistingPassword: false,
    interface_settings: {
      preset: "completa",
      destinos: [
        "/app/inbox",
        "/app/radar",
        "/app/agenda",
        "/app/templates",
        "/app/kanban",
        "/app/contacts",
        "/app/tasks",
      ],
    },
  },
  igor: {
    email: "igor@grupomixfer.com.br",
    fullName: "Igor",
    role: "manager",
    isPlatformAdmin: false,
    keepExistingPassword: false,
    interface_settings: {
      preset: "completa",
      destinos: [
        "/app/inbox",
        "/app/agenda",
        "/app/kanban",
        "/app/contacts",
        "/app/tasks",
      ],
    },
  },
};

async function run() {
  console.log("=== ESTRUTURAÇÃO DA EQUIPE ROBUSTY ===");

  const { data: org, error: errOrg } = await sb
    .from("organizations")
    .select("id, legal_name, display_name, settings, interface_settings")
    .limit(1)
    .single();
  if (errOrg || !org) throw new Error("Organização não encontrada: " + JSON.stringify(errOrg));

  console.log(`Organização ativa: ${org.display_name || org.legal_name} (${org.id})`);

  // Garantir visibility_mode: "all" e interface_settings da empresa completa para não bloquear destinos individuais
  const nextSettings = {
    ...(org.settings && typeof org.settings === "object" ? org.settings : {}),
    visibility_mode: "all",
  };
  await sb
    .from("organizations")
    .update({
      settings: nextSettings,
      interface_settings: { preset: "completa" },
    })
    .eq("id", org.id);

  // Listar usuários atuais no Supabase Auth
  const { data: listData, error: errList } = await sb.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (errList) throw new Error("Erro ao listar usuários: " + JSON.stringify(errList));

  const existingUsers = listData.users || [];
  console.log(`Usuários existentes no Auth: ${existingUsers.length}`);
  for (const u of existingUsers) {
    console.log(` - ${u.email} (${u.id})`);
  }

  for (const [key, cfg] of Object.entries(PERFIS)) {
    const emailLower = cfg.email.toLowerCase();
    let authUser = existingUsers.find((u) => (u.email || "").toLowerCase() === emailLower);

    if (!authUser) {
      console.log(`\nCriando usuário no Auth: ${cfg.email} (${cfg.fullName})...`);
      const { data: created, error: errCreate } = await sb.auth.admin.createUser({
        email: cfg.email,
        password: SENHA_PADRAO_EQUIPE,
        email_confirm: true,
        user_metadata: {
          full_name: cfg.fullName,
          name: cfg.fullName,
        },
      });
      if (errCreate) {
        throw new Error(`Erro ao criar ${cfg.email}: ` + JSON.stringify(errCreate));
      }
      authUser = created.user;
      console.log(` -> Criado com ID: ${authUser.id}`);
    } else {
      console.log(`\nAtualizando usuário existente no Auth: ${cfg.email} (${authUser.id})...`);
      const updatePayload = {
        email_confirm: true,
        user_metadata: {
          ...(authUser.user_metadata || {}),
          full_name: cfg.fullName,
          name: cfg.fullName,
        },
      };
      if (!cfg.keepExistingPassword) {
        updatePayload.password = SENHA_PADRAO_EQUIPE;
      }
      const { error: errUpdate } = await sb.auth.admin.updateUserById(authUser.id, updatePayload);
      if (errUpdate) {
        throw new Error(`Erro ao atualizar ${cfg.email}: ` + JSON.stringify(errUpdate));
      }
    }

    // Garantir vínculo em public.user_organizations
    const { data: existingMembership } = await sb
      .from("user_organizations")
      .select("id")
      .eq("user_id", authUser.id)
      .eq("organization_id", org.id)
      .maybeSingle();

    if (existingMembership) {
      const { error: errUpdMem } = await sb
        .from("user_organizations")
        .update({
          role: cfg.role,
          interface_settings: cfg.interface_settings,
          accepted_at: new Date().toISOString(),
        })
        .eq("id", existingMembership.id);
      if (errUpdMem) {
        throw new Error(`Erro ao atualizar vínculo de ${cfg.email}: ` + JSON.stringify(errUpdMem));
      }
      console.log(` -> Vínculo atualizado (${cfg.role}) para ${cfg.email}`);
    } else {
      const { error: errInsMem } = await sb.from("user_organizations").insert({
        user_id: authUser.id,
        organization_id: org.id,
        role: cfg.role,
        interface_settings: cfg.interface_settings,
        accepted_at: new Date().toISOString(),
      });
      if (errInsMem) {
        throw new Error(`Erro ao criar vínculo de ${cfg.email}: ` + JSON.stringify(errInsMem));
      }
      console.log(` -> Vínculo criado (${cfg.role}) para ${cfg.email}`);
    }

    // Platform Admin (somente para ti@grupomixfer.com.br)
    if (cfg.isPlatformAdmin) {
      await sb.from("platform_admins").upsert(
        {
          user_id: authUser.id,
          scope: "full",
          notes: "Administrador Técnico Robusty",
        },
        { onConflict: "user_id" },
      );
      console.log(` -> Permissão platform_admin (full) garantida para ${cfg.email}`);
    } else {
      await sb.from("platform_admins").delete().eq("user_id", authUser.id);
    }
  }

  // Verificar estado final da equipe na organização
  const { data: finalTeam } = await sb
    .from("user_organizations")
    .select("user_id, role, interface_settings")
    .eq("organization_id", org.id);

  console.log("\n=== RESUMO FINAL DA EQUIPE NA ORGANIZAÇÃO ROBUSTY ===");
  for (const m of finalTeam || []) {
    const { data: uRes } = await sb.auth.admin.getUserById(m.user_id);
    const u = uRes?.user;
    const destCount = Array.isArray(m.interface_settings?.destinos)
      ? `${m.interface_settings.destinos.length} telas personalizadas`
      : `preset: ${m.interface_settings?.preset || "completa"}`;
    console.log(
      ` - ${u?.user_metadata?.full_name || "Sem nome"} <${u?.email}> | role=${m.role} | menu=${destCount}`,
    );
  }
}

run().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
