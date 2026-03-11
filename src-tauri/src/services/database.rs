use std::path::PathBuf;

use chrono::Utc;
use rusqlite::Connection;

use crate::error::AppError;
use crate::models::conversation::{Conversation, Message, Role};

fn db_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_default();
    home.join(".localllm").join("conversations.db")
}

pub fn open_database() -> Result<Connection, AppError> {
    let path = db_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let conn = Connection::open(&path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
    init_schema(&conn)?;
    run_migrations(&conn)?;
    Ok(conn)
}

fn init_schema(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT 'New Conversation',
            model_id TEXT NOT NULL DEFAULT '',
            mode TEXT NOT NULL DEFAULT 'chat',
            working_directory TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            tool_calls TEXT,
            tool_result TEXT,
            attachments TEXT,
            image_url TEXT,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
        CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);",
    )?;
    Ok(())
}

fn run_migrations(conn: &Connection) -> Result<(), AppError> {
    let version: i32 = conn
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .unwrap_or(0);

    if version < 1 {
        // Check if this is an old schema that needs migration
        let has_mode_column = conn
            .prepare("SELECT mode FROM conversations LIMIT 0")
            .is_ok();

        if !has_mode_column {
            conn.execute_batch(
                "ALTER TABLE conversations ADD COLUMN mode TEXT NOT NULL DEFAULT 'chat';
                 ALTER TABLE conversations ADD COLUMN working_directory TEXT;",
            )?;

            // Recreate messages table with new columns (removes old CHECK constraint)
            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS messages_new (
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    tool_calls TEXT,
                    tool_result TEXT,
                    attachments TEXT,
                    image_url TEXT,
                    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
                );
                INSERT INTO messages_new (id, conversation_id, role, content, created_at)
                    SELECT id, conversation_id, role, content, created_at FROM messages;
                DROP TABLE messages;
                ALTER TABLE messages_new RENAME TO messages;
                CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);",
            )?;
        }

        conn.pragma_update(None, "user_version", 1)?;
    }

    Ok(())
}

pub fn list_conversations(conn: &Connection) -> Result<Vec<Conversation>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, title, model_id, mode, working_directory, created_at, updated_at
         FROM conversations ORDER BY updated_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Conversation {
            id: row.get(0)?,
            title: row.get(1)?,
            model_id: row.get(2)?,
            mode: row.get(3)?,
            working_directory: row.get(4)?,
            created_at: row
                .get::<_, String>(5)?
                .parse()
                .unwrap_or_default(),
            updated_at: row
                .get::<_, String>(6)?
                .parse()
                .unwrap_or_default(),
        })
    })?;
    let mut conversations = Vec::new();
    for row in rows {
        conversations.push(row?);
    }
    Ok(conversations)
}

pub fn create_conversation(conn: &Connection, conv: &Conversation) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO conversations (id, title, model_id, mode, working_directory, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            conv.id,
            conv.title,
            conv.model_id,
            conv.mode,
            conv.working_directory,
            conv.created_at.to_rfc3339(),
            conv.updated_at.to_rfc3339(),
        ],
    )?;
    Ok(())
}

pub fn update_conversation_title(
    conn: &Connection,
    id: &str,
    title: &str,
) -> Result<(), AppError> {
    conn.execute(
        "UPDATE conversations SET title = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![title, Utc::now().to_rfc3339(), id],
    )?;
    Ok(())
}

pub fn delete_conversation(conn: &Connection, id: &str) -> Result<(), AppError> {
    conn.execute("DELETE FROM conversations WHERE id = ?1", [id])?;
    Ok(())
}

pub fn delete_all_conversations(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch("DELETE FROM messages; DELETE FROM conversations;")?;
    Ok(())
}

pub fn get_messages(conn: &Connection, conversation_id: &str) -> Result<Vec<Message>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, conversation_id, role, content, created_at,
                tool_calls, tool_result, attachments, image_url
         FROM messages WHERE conversation_id = ?1 ORDER BY created_at ASC",
    )?;
    let rows = stmt.query_map([conversation_id], |row| {
        let role_str: String = row.get(2)?;
        let role = match role_str.as_str() {
            "assistant" => Role::Assistant,
            "system" => Role::System,
            "tool" => Role::Tool,
            _ => Role::User,
        };
        Ok(Message {
            id: row.get(0)?,
            conversation_id: row.get(1)?,
            role,
            content: row.get(3)?,
            created_at: row
                .get::<_, String>(4)?
                .parse()
                .unwrap_or_default(),
            tool_calls: row.get(5)?,
            tool_result: row.get(6)?,
            attachments: row.get(7)?,
            image_url: row.get(8)?,
        })
    })?;
    let mut messages = Vec::new();
    for row in rows {
        messages.push(row?);
    }
    Ok(messages)
}

pub fn insert_message(conn: &Connection, msg: &Message) -> Result<(), AppError> {
    let role_str = match msg.role {
        Role::User => "user",
        Role::Assistant => "assistant",
        Role::System => "system",
        Role::Tool => "tool",
    };
    conn.execute(
        "INSERT INTO messages (id, conversation_id, role, content, created_at,
                               tool_calls, tool_result, attachments, image_url)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![
            msg.id,
            msg.conversation_id,
            role_str,
            msg.content,
            msg.created_at.to_rfc3339(),
            msg.tool_calls,
            msg.tool_result,
            msg.attachments,
            msg.image_url,
        ],
    )?;
    Ok(())
}

#[allow(dead_code)]
pub fn update_message_content(
    conn: &Connection,
    id: &str,
    content: &str,
) -> Result<(), AppError> {
    conn.execute(
        "UPDATE messages SET content = ?1 WHERE id = ?2",
        rusqlite::params![content, id],
    )?;
    Ok(())
}
