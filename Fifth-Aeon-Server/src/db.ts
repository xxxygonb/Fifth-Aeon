import * as fs from "fs";
import * as path from "path";
import { Pool, PoolClient } from "pg";
import { config } from "./config";

export const db = new Pool({
    connectionString: config.connectionString || "",
    // Only use SSL when the connection string explicitly requires it
    // (e.g. hosted databases). Local PostgreSQL instances do not support SSL.
    ssl: /sslmode=require/.test(config.connectionString || "")
        ? { rejectUnauthorized: false }
        : false
});

/**
 * Directory holding sequential migration scripts named "0001_description.sql",
 * "0002_description.sql", ... They run inside a transaction after the baseline
 * schema (sql/makeDB.sql) and each applied version is recorded in
 * CCG.SchemaVersion, so adding a column/table means dropping a new file here.
 */
const migrationsDir = path.join(__dirname, "..", "sql", "migrations");

export async function startDB() {
    try {
        const existQuery = await db.query(`SELECT EXISTS (
    SELECT 1
    FROM   information_schema.tables
    WHERE  table_schema = 'ccg'
    );`);
        if (!existQuery.rows[0].exists) {
            console.warn("No CCG Schema detected. Creating now.");
            // Small startup-time script: sync read keeps es2016 lib compat
            const sql = fs.readFileSync("./sql/makeDB.sql", "utf8");
            // pg's simple query protocol runs the whole script in one call;
            // the script is idempotent so a partially built schema is completed.
            await db.query(sql);
        }
        await applyMigrations();
    } catch (e) {
        console.error(
            "Could not connect to postgres database. Please be sure the server is running."
        );
        console.error(
            "You may also need to set the PGUSER and PGDATABASE environment variables to the correct values."
        );
        console.error("See https://node-postgres.com/features/connecting");
        throw e;
    }
}

/**
 * Applies every sql/migrations/NNNN_*.sql file newer than the recorded
 * schema version, inside a single transaction, and records the new version.
 */
async function applyMigrations() {
    const client: PoolClient = await db.connect();
    try {
        await client.query(
            `CREATE TABLE IF NOT EXISTS CCG.SchemaVersion (version INTEGER NOT NULL);`
        );
        await client.query("BEGIN");
        const versionResult = await client.query(
            `SELECT version FROM CCG.SchemaVersion;`
        );
        let version = 0;
        if (versionResult.rowCount === 0) {
            // First run against a database built by makeDB.sql: record baseline
            await client.query(
                `INSERT INTO CCG.SchemaVersion (version) VALUES ($1);`,
                [0]
            );
        } else {
            version = versionResult.rows[0].version as number;
        }

        if (fs.existsSync(migrationsDir)) {
            const files = fs
                .readdirSync(migrationsDir)
                .filter(f => /^\d+_.*\.sql$/.test(f))
                .sort();
            for (const file of files) {
                const fileVersion = parseInt(file.split("_")[0], 10);
                if (isNaN(fileVersion) || fileVersion <= version) {
                    continue;
                }
                const sql = fs.readFileSync(
                    path.join(migrationsDir, file),
                    "utf8"
                );
                await client.query(sql);
                await client.query(
                    `UPDATE CCG.SchemaVersion SET version = $1;`,
                    [fileVersion]
                );
                console.log("Applied migration:", file);
                version = fileVersion;
            }
        }
        await client.query("COMMIT");
    } catch (e) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            // Transaction was already aborted/rolled back
        }
        throw e;
    } finally {
        client.release();
    }
}
