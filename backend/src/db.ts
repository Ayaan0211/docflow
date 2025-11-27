import { Pool } from "pg";

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// tables
function createUsersTable() {
  return pool
    .query(
      `
    CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    password TEXT,
    google_id VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL
    );
    `
    )
    .then(() => console.log("✅ Users table ready"))
    .catch((err) =>
      console.error("❌ Error creating users table:", err.message)
    );
}

function createDocumentsTable() {
  return pool
    .query(
      `
    CREATE TABLE IF NOT EXISTS documents (
    document_id SERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content JSONB NOT NULL,
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `
    )
    .then(() => console.log("✅ Documents table ready"))
    .catch((err) =>
      console.error("❌ Error creating documents table:", err.message)
    );
}

function createSharedDocumentsTable() {
  return pool
    .query(
      `
    CREATE TABLE IF NOT EXISTS shared_documents (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(document_id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    permission VARCHAR(20) CHECK (permission IN ('view', 'edit')),
    UNIQUE (document_id, user_id)
    );
    `
    )
    .then(() => console.log("✅ Shared Documents table ready"))
    .catch((err) =>
      console.error("❌ Error creating shared documents table:", err.message)
    );
}

function createDocumentVersionsTable() {
  return pool
    .query(
      `
    CREATE TABLE IF NOT EXISTS document_versions (
    version_id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(document_id) ON DELETE CASCADE,
    edited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    content JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `
    )
    .then(() => console.log("✅ Documents Versions table ready"))
    .catch((err) =>
      console.error("❌ Error creating document versions table:", err.message)
    );
}

// indexes for faster queries
function createIndexes() {
  return pool
    .query(
      `
    CREATE INDEX IF NOT EXISTS idx_documents_owner_id ON documents(owner_id);
    CREATE INDEX IF NOT EXISTS idx_shared_documents_user_id ON shared_documents(user_id);
    CREATE INDEX IF NOT EXISTS idx_shared_documents_document_id ON shared_documents(document_id);
    CREATE INDEX IF NOT EXISTS idx_versions_document_id ON document_versions(document_id);
  `
    )
    .then(() => console.log("✅ Indexes ready"))
    .catch((err) => console.error("❌ Error creating indexes:", err.message));
}

// initialize tables
export function initDb() {
    return createUsersTable()
        .then(createDocumentsTable)
        .then(createSharedDocumentsTable)
        .then(createDocumentVersionsTable)
        .then(createIndexes)
        .then(() => console.log("✅ Database initialization complete"))
        .catch((err) =>
            console.error("❌ Database initialization failed:", err.message)
        );
        // Chain more tables above as needed
}