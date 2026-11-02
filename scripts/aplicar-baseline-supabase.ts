import { readFileSync } from "fs";
import { resolve } from "path";
import { Client } from "pg";

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL || process.argv[2];

  if (!connectionString) {
    console.error("Uso: npx tsx scripts/aplicar-baseline-supabase.ts <SUPABASE_DB_URL>");
    console.error("Ou defina SUPABASE_DB_URL no ambiente / .env.local");
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
    console.log("Aplicando schema baseline no Supabase (pode levar 30-60 segundos)...");
    
    // Executa o script SQL
    await client.query(sql);
    
    console.log("✅ Schema baseline aplicado com sucesso no Supabase!");
  } catch (error) {
    console.error("❌ Erro ao aplicar baseline:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
