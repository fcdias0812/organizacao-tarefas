-- Arquivar: a tarefa sai do quadro, mas continua no banco com checklist, comentários e histórico.
ALTER TABLE tasks ADD COLUMN archived_at TEXT;
ALTER TABLE tasks ADD COLUMN archived_by INTEGER REFERENCES users (id);
CREATE INDEX idx_tasks_archived ON tasks (archived_at);
