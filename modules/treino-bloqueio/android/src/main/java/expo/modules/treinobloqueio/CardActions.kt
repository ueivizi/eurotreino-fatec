package expo.modules.treinobloqueio

import org.json.JSONObject
import kotlin.math.roundToInt

/**
 * O que cada botão do cartão faz. As regras são as mesmas da tela do app (lock-card.ts): série
 * além da meta não entra, e fechar a meta passa ao próximo exercício. Cada toque vira um evento
 * na fila, que o app aplica na sessão quando volta.
 */
internal object CardActions {
  const val SET = "expo.modules.treinobloqueio.SERIE"
  const val LOAD_UP = "expo.modules.treinobloqueio.CARGA_MAIS"
  const val LOAD_DOWN = "expo.modules.treinobloqueio.CARGA_MENOS"
  const val PAUSE = "expo.modules.treinobloqueio.PAUSAR"
  const val RESUME = "expo.modules.treinobloqueio.RETOMAR"
  const val LAP = "expo.modules.treinobloqueio.VOLTA"

  val ALL = setOf(SET, LOAD_UP, LOAD_DOWN, PAUSE, RESUME, LAP)

  /** Passo da carga, o mesmo da tela. */
  const val LOAD_STEP = 2.5

  fun apply(state: CardState, action: String, now: Long): List<JSONObject> {
    return when (action) {
      SET -> markSet(state, now)
      LOAD_UP -> changeLoad(state, LOAD_STEP)
      LOAD_DOWN -> changeLoad(state, -LOAD_STEP)
      PAUSE -> {
        if (state.paused) {
          emptyList()
        } else {
          state.pausedElapsedMs = state.elapsedMs(now)
          listOf(JSONObject().put("t", "pause").put("at", now))
        }
      }
      RESUME -> {
        if (!state.paused) {
          emptyList()
        } else {
          state.startedAtMs = now - state.pausedElapsedMs
          state.pausedElapsedMs = -1L
          listOf(JSONObject().put("t", "resume").put("at", now))
        }
      }
      LAP -> {
        if (state.laps >= 1000) {
          emptyList()
        } else {
          state.laps += 1
          listOf(JSONObject().put("t", "lap").put("at", now))
        }
      }
      else -> emptyList()
    }
  }

  private fun markSet(state: CardState, now: Long): List<JSONObject> {
    val exercise = state.current() ?: return emptyList()
    if (exercise.complete) return emptyList()
    exercise.done += 1
    val events = mutableListOf(
      JSONObject()
        .put("t", "set")
        .put("id", exercise.id)
        .put("reps", exercise.reps)
        .put("load", exercise.loadKg)
        .put("at", now),
    )
    if (exercise.complete) {
      val next = state.nextOpen()
      if (next >= 0) {
        state.index = next
        events.add(JSONObject().put("t", "focus").put("id", state.exercises[next].id))
      }
    }
    return events
  }

  private fun changeLoad(state: CardState, step: Double): List<JSONObject> {
    val exercise = state.current() ?: return emptyList()
    val next = ((exercise.loadKg + step) * 10).roundToInt() / 10.0
    exercise.loadKg = next.coerceIn(0.0, 500.0)
    return listOf(JSONObject().put("t", "load").put("id", exercise.id).put("load", exercise.loadKg))
  }
}
