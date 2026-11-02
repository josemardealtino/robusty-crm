import { readFileSync } from "fs";
import { resolve } from "path";
import { Client } from "pg";

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL || process.argv[2];

  if (!connectionString) {
    console.error("Uso: node --env-file=.env.local -r tsx scripts/aplicar-baseline-supabase.ts");
    console.error("Ou defina SUPABASE_DB_URL no .env.local");
    process.exit(1);
  }

  const baselinePath = resolve(process.cwd(), "supabase/baseline.sql");
  console.log(`Lendo schema baseline de: ${baselinePath}...`);
  const sql = readFileSync(baselinePath, "utf-8");

  console.log("Conectando ao banco Supabase...");
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("Conexão estabelecida com sucesso!");

    console.log("Garantindo extensões necessárias (vector, citext, pg_trgm, pgcrypto)...");
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;
      CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;
      CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
      CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
    `);
    console.log("Extensões verificadas.");

    console.log("Aplicando schema baseline no Supabase (pode levar de 30 a 90 segundos)...");
    const inicio = Date.now();
    await client.query(sql);
    const duracao = ((Date.now() - inicio) / 1000).toFixed(1);
    
    console.log(`✅ Schema baseline aplicado com sucesso no Supabase em ${duracao}s!`);
  } catch (error: any) {
    console.error("❌ Erro ao aplicar baseline:", error.message);
    if (error.detail) console.error("Detalhe:", error.detail);
    if (error.where) console.error("Onde:", error.where);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
