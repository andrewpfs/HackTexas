// Checks that .env.local has Supabase credentials and the trips table exists.
// Run with: npm run db:check
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function readEnvFile(path) {
  try {
    const values = {};
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match) {
        values[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
    return values;
  } catch {
    return {};
  }
}

const env = { ...readEnvFile(".env.local"), ...process.env };
const url = env.SUPABASE_URL?.trim();
const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  process.exit(1);
}

function isPublicKey(value) {
  if (value.startsWith("sb_publishable_")) return true;
  try {
    return JSON.parse(Buffer.from(value.split(".")[1], "base64url").toString()).role === "anon";
  } catch {
    return false;
  }
}

if (isPublicKey(key)) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is the public publishable/anon key, which cannot write trips.");
  console.error("Use the secret key instead: Project Settings -> API Keys -> Secret keys (starts with sb_secret_).");
  process.exit(1);
}

const client = createClient(url, key, { auth: { persistSession: false } });
const { count, error } = await client.from("trips").select("id", { count: "exact", head: true });

if (error) {
  console.error(`Could not read the trips table: ${error.message}`);
  console.error("If the table is missing, run supabase/schema.sql in the Supabase SQL Editor.");
  process.exit(1);
}

console.log(`Connected to Supabase. The trips table has ${count} trip(s).`);
