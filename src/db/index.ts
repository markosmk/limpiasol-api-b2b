// --- MYSQL (Comentado por si necesitas volver, descomenta esto y comenta Postgres) ---
// import { type DatabaseMySQL, dbMySQL } from "./init.mysql"
// export const db = dbMySQL
// export type Database = DatabaseMySQL

// --- POSTGRESQL ---
import { type DatabasePG, dbPG } from "./init.pg"

export const db = dbPG
export type Database = DatabasePG
