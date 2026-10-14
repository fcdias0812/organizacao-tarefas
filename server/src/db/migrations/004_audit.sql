-- Auditoria: tudo o que foi feito no sistema, por quem e quando. Só recebe inserções.
-- task_id não tem chave estrangeira: o registro fica mesmo se a tarefa for excluída de vez.
CREATE TABLE audit_log (
  id         INTEGER PRIMARY KEY,
  actor_id   INTEGER REFERENCES users (id), -- NULL = linha de comando
  area       TEXT    NOT NULL,
  action     TEXT    NOT NULL,
  task_id    INTEGER,
  summary    TEXT    NOT NULL,
  created_at TEXT    NOT NULL
);
CREATE INDEX idx_audit_created ON audit_log (created_at);
