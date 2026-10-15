import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  checkArchive,
  checkAssign,
  checkChecklistEditable,
  checkChecklistItemRemoval,
  checkMove,
  checkNotArchived,
  checkPermanentDelete,
  positionBetween,
  previewMove,
  type MoveInput,
} from "./rules"

const base: MoveInput = { from: "todo", to: "in_progress", actorRole: "executor", checklistDone: 0, checklistTotal: 4 }
const move = (patch: Partial<MoveInput>) => checkMove({ ...base, ...patch })

describe("checkMove", () => {
  it("reordenar na mesma coluna não gera evento", () => {
    assert.deepEqual(move({ from: "todo", to: "todo" }), { ok: true, event: null })
  })

  it("A fazer ↔ Em andamento é livre", () => {
    assert.deepEqual(move({ from: "todo", to: "in_progress" }), { ok: true, event: "moved" })
    assert.deepEqual(move({ from: "in_progress", to: "todo" }), { ok: true, event: "moved" })
  })

  describe("Revisão exige checklist 100%", () => {
    it("recusa com itens faltando e diz quantos", () => {
      const r = move({ from: "in_progress", to: "review", checklistDone: 2, checklistTotal: 4 })
      assert.equal(r.ok, false)
      assert.equal(!r.ok && r.code, "checklist_incomplete")
      assert.match(!r.ok ? r.message : "", /Faltam 2 itens do checklist para enviar para Revisão/)
    })

    it("usa singular quando falta 1", () => {
      const r = move({ from: "in_progress", to: "review", checklistDone: 3, checklistTotal: 4 })
      assert.match(!r.ok ? r.message : "", /Falta 1 item/)
    })

    it("recusa checklist vazio", () => {
      const r = move({ from: "in_progress", to: "review", checklistDone: 0, checklistTotal: 0 })
      assert.equal(!r.ok && r.code, "checklist_incomplete")
    })

    it("aceita com tudo marcado, de A fazer ou Em andamento", () => {
      for (const from of ["todo", "in_progress"] as const) {
        assert.deepEqual(move({ from, to: "review", checklistDone: 4 }), { ok: true, event: "sent_to_review" })
      }
    })
  })

  describe("saindo da Revisão", () => {
    it("executor não move", () => {
      for (const to of ["done", "in_progress", "todo"] as const) {
        const r = move({ from: "review", to, reason: "motivo qualquer" })
        assert.equal(!r.ok && r.code, "forbidden")
      }
    })

    it("gestor aprova", () => {
      assert.deepEqual(move({ from: "review", to: "done", actorRole: "manager" }), { ok: true, event: "approved" })
    })

    it("gestor devolve só com motivo", () => {
      const sem = move({ from: "review", to: "in_progress", actorRole: "manager" })
      assert.equal(!sem.ok && sem.code, "reason_required")
      const curto = move({ from: "review", to: "in_progress", actorRole: "manager", reason: "  a " })
      assert.equal(!curto.ok && curto.code, "reason_required")
      assert.deepEqual(
        move({ from: "review", to: "in_progress", actorRole: "manager", reason: "Faltou testar no celular" }),
        { ok: true, event: "returned" }
      )
    })

    it("gestor não manda da Revisão para A fazer ou Bloqueado", () => {
      for (const to of ["todo", "blocked"] as const) {
        const r = move({ from: "review", to, actorRole: "manager", reason: "motivo" })
        assert.equal(!r.ok && r.code, "invalid_transition")
      }
    })
  })

  it("ninguém conclui sem passar pela Revisão", () => {
    for (const actorRole of ["manager", "executor"] as const) {
      const r = move({ from: "in_progress", to: "done", actorRole, checklistDone: 4 })
      assert.equal(!r.ok && r.code, "invalid_transition")
    }
  })

  it("bloquear exige motivo", () => {
    const r = move({ from: "in_progress", to: "blocked" })
    assert.equal(!r.ok && r.code, "reason_required")
    assert.deepEqual(move({ from: "in_progress", to: "blocked", reason: "Aguardando fornecedor" }), {
      ok: true,
      event: "blocked",
    })
  })

  it("desbloquear volta para A fazer ou Em andamento", () => {
    assert.deepEqual(move({ from: "blocked", to: "in_progress" }), { ok: true, event: "unblocked" })
    assert.deepEqual(move({ from: "blocked", to: "todo" }), { ok: true, event: "unblocked" })
    const r = move({ from: "blocked", to: "review", checklistDone: 4 })
    assert.equal(!r.ok && r.code, "invalid_transition")
  })

  it("reabrir concluído é só com o gestor", () => {
    const r = move({ from: "done", to: "in_progress" })
    assert.equal(!r.ok && r.code, "forbidden")
    assert.deepEqual(move({ from: "done", to: "in_progress", actorRole: "manager" }), { ok: true, event: "reopened" })
  })
})

describe("checkAssign", () => {
  const manager = { id: 1, role: "manager" as const }
  const executor = { id: 3, role: "executor" as const }

  it("gestor define quem quiser, inclusive ninguém", () => {
    assert.equal(checkAssign(manager, [], [2, 3]).ok, true)
    assert.equal(checkAssign(manager, [2, 3], []).ok, true)
  })

  it("executor só se inclui ou se retira", () => {
    assert.equal(checkAssign(executor, [], [3]).ok, true, "cria para si")
    assert.equal(checkAssign(executor, [2], [2, 3]).ok, true, "entra numa tarefa de outra pessoa")
    assert.equal(checkAssign(executor, [2, 3], [2]).ok, true, "sai e a tarefa continua com alguém")
    assert.equal(checkAssign(executor, [2], [2]).ok, true, "nada mudou")
    const outro = checkAssign(executor, [3], [3, 1])
    assert.equal(!outro.ok && outro.message, "Só o gestor atribui tarefas para outras pessoas.")
    assert.equal(checkAssign(executor, [2], []).ok, false, "não tira outra pessoa")
  })

  it("executor não deixa a tarefa sem responsável", () => {
    const r = checkAssign(executor, [3], [])
    assert.equal(!r.ok && r.message, "Só o gestor deixa uma tarefa sem responsável.")
    assert.equal(checkAssign(executor, [], []).ok, false)
  })
})

describe("checklist", () => {
  it("fica travado em Revisão e Concluído", () => {
    assert.equal(checkChecklistEditable("in_progress").ok, true)
    assert.equal(checkChecklistEditable("blocked").ok, true)
    assert.equal(checkChecklistEditable("review").ok, false)
    assert.equal(checkChecklistEditable("done").ok, false)
  })

  it("executor não remove item do padrão da categoria", () => {
    assert.equal(checkChecklistItemRemoval("executor", true).ok, false)
    assert.equal(checkChecklistItemRemoval("executor", false).ok, true)
    assert.equal(checkChecklistItemRemoval("manager", true).ok, true)
  })
})

describe("previewMove", () => {
  it("bloquear e devolver são permitidos, mas pedem motivo", () => {
    assert.deepEqual(previewMove({ from: "todo", to: "blocked", actorRole: "executor", checklistDone: 0, checklistTotal: 4 }), {
      ok: true,
      event: "blocked",
      needsReason: true,
    })
    const devolver = previewMove({ from: "review", to: "in_progress", actorRole: "manager", checklistDone: 4, checklistTotal: 4 })
    assert.equal(devolver.ok && devolver.needsReason, true)
  })

  it("movimentos comuns não pedem motivo e recusas continuam recusas", () => {
    const mover = previewMove({ from: "todo", to: "in_progress", actorRole: "executor", checklistDone: 0, checklistTotal: 4 })
    assert.equal(mover.ok && mover.needsReason, false)
    const revisao = previewMove({ from: "todo", to: "review", actorRole: "executor", checklistDone: 1, checklistTotal: 4 })
    assert.equal(!revisao.ok && revisao.code, "checklist_incomplete")
  })
})

describe("positionBetween", () => {
  it("coluna vazia, topo, fim e meio", () => {
    assert.equal(positionBetween([]), 1024)
    assert.equal(positionBetween([1024, 2048], 0), 0)
    assert.equal(positionBetween([1024, 2048]), 3072)
    assert.equal(positionBetween([1024, 2048], 1), 1536)
  })

  it("avisa quando não há espaço entre os vizinhos", () => {
    assert.equal(positionBetween([1, 1 + 1e-9], 1), null)
  })
})

describe("opções configuráveis", () => {
  const options = {
    statusLabels: { todo: "Fila", in_progress: "Fazendo", review: "Conferência", done: "Pronto", blocked: "Parado" },
    reasonMinLength: 10,
  }

  it("mensagens usam os nomes de colunas configurados", () => {
    const r = checkMove({ ...base, from: "in_progress", to: "review", checklistDone: 1 }, options)
    assert.match(!r.ok ? r.message : "", /para enviar para Conferência/)
    const e = checkMove({ ...base, from: "review", to: "done" }, options)
    assert.equal(!e.ok && e.message, "Só o gestor tira um card de Conferência.")
  })

  it("respeita o tamanho mínimo do motivo", () => {
    const curto = checkMove({ ...base, from: "in_progress", to: "blocked", reason: "aguardando" }, options)
    assert.equal(curto.ok, true, "10 caracteres passam")
    const muitoCurto = checkMove({ ...base, from: "in_progress", to: "blocked", reason: "aguardo" }, options)
    assert.equal(!muitoCurto.ok && muitoCurto.code, "reason_required")
    const preview = previewMove({ ...base, from: "in_progress", to: "blocked" }, options)
    assert.equal(preview.ok && preview.needsReason, true)
  })
})

describe("arquivar e excluir de vez", () => {
  const executor = { id: 3, role: "executor" as const }
  const manager = { id: 1, role: "manager" as const }

  it("gestor ou quem criou arquiva e restaura", () => {
    assert.equal(checkArchive(manager, { createdById: 3 }).ok, true)
    assert.equal(checkArchive(executor, { createdById: 3 }).ok, true)
    const outro = checkArchive(executor, { createdById: 2 }, "restore")
    assert.equal(!outro.ok && outro.code, "forbidden")
    assert.equal(!outro.ok && outro.message, "Só o gestor ou quem criou a tarefa pode restaurá-la.")
  })

  it("tarefa arquivada fica só para leitura", () => {
    assert.equal(checkNotArchived({ archivedAt: null }).ok, true)
    const r = checkNotArchived({ archivedAt: "2026-10-14T12:00:00.000Z" })
    assert.equal(!r.ok && r.code, "invalid_transition")
  })

  it("excluir de vez: só administrador e só tarefa arquivada", () => {
    const archived = { archivedAt: "2026-10-14T12:00:00.000Z" }
    assert.equal(checkPermanentDelete({ isAdmin: true }, archived).ok, true)
    const naoAdmin = checkPermanentDelete({ isAdmin: false }, archived)
    assert.equal(!naoAdmin.ok && naoAdmin.code, "forbidden")
    const ativa = checkPermanentDelete({ isAdmin: true }, { archivedAt: null })
    assert.equal(!ativa.ok && ativa.message, "Arquive a tarefa antes de excluir de vez.")
  })
})
