import pg from "pg"

async function main() {
  const url = process.env.DATABASE_URL

  if (!url) {
    console.error("DATABASE_URL is not defined.")
    process.exit(1)
  }

  console.log("Starting database reset (PostgreSQL)...")

  const pool = new pg.Pool({ connectionString: url })
  const client = await pool.connect()

  try {
    // Disable triggers and drop all schema public tables
    await client.query(`
      DO $$ DECLARE
          r RECORD;
      BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
              EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
          END LOOP;
      END $$;
    `)

    // Drop enums if any (Drizzle generates enums)
    await client.query(`
      DO $$ DECLARE
          r RECORD;
      BEGIN
          FOR r IN (SELECT typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typtype = 'e') LOOP
              EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
          END LOOP;
      END $$;
    `)

    console.log("Database successfully reset.")
  } catch (err) {
    console.error("Error resetting database:", err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
