CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK (role IN ('manager', 'executor')),
  job_title     TEXT,
  avatar_color  TEXT    NOT NULL DEFAULT 'violet',
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL,
  expires_at TEXT    NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions (user_id);

CREATE TABLE categories (
  id       INTEGER PRIMARY KEY,
  key      TEXT    NOT NULL UNIQUE,
  name     TEXT    NOT NULL,
  position INTEGER NOT NULL
);

CREATE TABLE category_checklist_templates (
  id          INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
  label       TEXT    NOT NULL,
  position    INTEGER NOT NULL
);

CREATE TABLE tasks (
  id                  INTEGER PRIMARY KEY,
  title               TEXT    NOT NULL,
  description         TEXT    NOT NULL DEFAULT '',
  status              TEXT    NOT NULL CHECK (status IN ('todo', 'in_progress', 'review', 'done', 'blocked')),
  position            REAL    NOT NULL,
  priority            TEXT    NOT NULL CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  due_date            TEXT,
  category_id         INTEGER NOT NULL REFERENCES categories (id),
  assignee_id         INTEGER REFERENCES users (id),
  created_by          INTEGER NOT NULL REFERENCES users (id),
  blocked_reason      TEXT,
  blocked_from_status TEXT,
  last_return_reason  TEXT,
  created_at          TEXT    NOT NULL,
  updated_at          TEXT    NOT NULL,
  completed_at        TEXT
);
CREATE INDEX idx_tasks_status_position ON tasks (status, position);

CREATE TABLE checklist_items (
  id               INTEGER PRIMARY KEY,
  task_id          INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  label            TEXT    NOT NULL,
  is_done          INTEGER NOT NULL DEFAULT 0,
  is_from_template INTEGER NOT NULL DEFAULT 0,
  done_by          INTEGER REFERENCES users (id),
  done_at          TEXT,
  position         INTEGER NOT NULL
);
CREATE INDEX idx_checklist_task ON checklist_items (task_id);

-- Histórico: só recebe inserções.
CREATE TABLE task_events (
  id          INTEGER PRIMARY KEY,
  task_id     INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  actor_id    INTEGER NOT NULL REFERENCES users (id),
  type        TEXT    NOT NULL,
  from_status TEXT,
  to_status   TEXT,
  reason      TEXT,
  detail      TEXT,
  created_at  TEXT    NOT NULL
);
CREATE INDEX idx_events_task ON task_events (task_id, created_at);

-- Categorias e checklists padrão de "pronto" (dados de referência do sistema).
INSERT INTO categories (id, key, name, position) VALUES
  (1, 'ticket',   'Chamado', 1),
  (2, 'infra',    'Infra',   2),
  (3, 'purchase', 'Compra',  3),
  (4, 'project',  'Projeto', 4),
  (5, 'routine',  'Rotina',  5);

INSERT INTO category_checklist_templates (category_id, label, position) VALUES
  (1, 'Problema entendido e reproduzido', 1),
  (1, 'Solução aplicada', 2),
  (1, 'Usuário confirmou que resolveu', 3),
  (1, 'Registro encerrado e documentado', 4),

  (2, 'Mudança testada', 1),
  (2, 'Plano de volta (rollback) ou backup disponível', 2),
  (2, 'Documentação atualizada', 3),
  (2, 'Monitoramento conferido', 4),

  (3, 'Orçamentos coletados', 1),
  (3, 'Aprovação registrada', 2),
  (3, 'Pedido emitido', 3),
  (3, 'Item recebido e conferido', 4),
  (3, 'Inventário e patrimônio atualizados', 5),

  (4, 'Escopo validado com o solicitante', 1),
  (4, 'Testes realizados', 2),
  (4, 'Documentação entregue', 3),
  (4, 'Solicitante aprovou a entrega', 4),

  (5, 'Executada conforme o procedimento', 1),
  (5, 'Evidência registrada', 2),
  (5, 'Anomalias reportadas', 3);
