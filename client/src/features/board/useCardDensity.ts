import { useState } from "react"

export type CardDensity = "comfortable" | "compact"

const STORAGE_KEY = "tarefas.cardDensity"
/** Mesma altura do variante `short` em index.css. */
const SHORT_SCREEN = "(max-height: 860px)"

function initialDensity(): CardDensity {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === "comfortable" || saved === "compact") return saved
  } catch {
    // Armazenamento bloqueado: segue o tamanho da tela.
  }
  return window.matchMedia(SHORT_SCREEN).matches ? "compact" : "comfortable"
}

/**
 * Densidade dos cards do quadro, escolhida por cada pessoa e lembrada neste navegador.
 * Sem escolha salva, telas baixas (notebook) começam no compacto.
 */
export function useCardDensity() {
  const [density, setDensityState] = useState<CardDensity>(initialDensity)

  const setDensity = (value: CardDensity) => {
    setDensityState(value)
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // Sem armazenamento a escolha vale só até recarregar.
    }
  }

  return { density, setDensity }
}
