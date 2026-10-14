-- Administrador: acessa Configurações (sempre é também gestor).
ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;

-- Categorias editáveis: ícone e ativa/desativada (desativar preserva as tarefas antigas).
ALTER TABLE categories ADD COLUMN icon TEXT NOT NULL DEFAULT 'tag';
ALTER TABLE categories ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;

UPDATE categories SET icon = CASE key
  WHEN 'ticket'   THEN 'headset'
  WHEN 'infra'    THEN 'server'
  WHEN 'purchase' THEN 'shopping-cart'
  WHEN 'project'  THEN 'folder-kanban'
  WHEN 'routine'  THEN 'refresh-cw'
  ELSE 'tag'
END;

-- Configurações gerais (nome, cor, colunas, prioridades, prazos) em JSON.
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Comentários de acompanhamento da tarefa.
CREATE TABLE task_comments (
  id         INTEGER PRIMARY KEY,
  task_id    INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  author_id  INTEGER NOT NULL REFERENCES users (id),
  body       TEXT    NOT NULL,
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);
CREATE INDEX idx_comments_task ON task_comments (task_id, created_at);
