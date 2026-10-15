-- Vários responsáveis por tarefa. Copia o responsável atual de cada tarefa;
-- a coluna antiga tasks.assignee_id continua existindo, mas deixa de ser usada.
CREATE TABLE task_assignees (
  task_id  INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  user_id  INTEGER NOT NULL REFERENCES users (id),
  added_at TEXT    NOT NULL,
  PRIMARY KEY (task_id, user_id)
);
CREATE INDEX idx_task_assignees_user ON task_assignees (user_id);

INSERT INTO task_assignees (task_id, user_id, added_at)
SELECT id, assignee_id, created_at FROM tasks WHERE assignee_id IS NOT NULL;
