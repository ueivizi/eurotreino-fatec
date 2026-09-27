package expo.modules.treinobloqueio

import org.json.JSONArray
import org.json.JSONObject

/** Um exercício do cartão. `targetSets` 0 = sem meta; `loadKg` 0 = peso livre. */
internal class CardExercise(
  val id: String,
  val name: String,
  val targetSets: Int,
  var done: Int,
  val reps: Int,
  var loadKg: Double,
) {
  val complete: Boolean
    get() = targetSets > 0 && done >= targetSets
}

/**
 * O que o cartão mostra. O relógio é guardado como instantes, não como contador: com o app
 * fechado, quem desenha o tempo é o próprio Android.
 */
internal class CardState(
  val kind: String,
  val title: String,
  /** Instante (relógio de parede) em que o cronômetro marcaria zero, enquanto corre. */
  var startedAtMs: Long,
  /** Tempo congelado da pausa; -1 enquanto corre. */
  var pausedElapsedMs: Long,
  val exercises: MutableList<CardExercise>,
  var index: Int,
  var laps: Int,
) {
  val paused: Boolean
    get() = pausedElapsedMs >= 0

  fun elapsedMs(now: Long): Long = if (paused) pausedElapsedMs else maxOf(0L, now - startedAtMs)

  fun current(): CardExercise? = exercises.getOrNull(index)

  /** Próximo exercício com meta e séries por fazer, dando a volta; -1 se não houver. */
  fun nextOpen(): Int {
    val size = exercises.size
    for (step in 1..size) {
      val candidate = (index + step) % size
      val exercise = exercises[candidate]
      if (candidate != index && exercise.targetSets > 0 && exercise.done < exercise.targetSets) return candidate
    }
    return -1
  }

  fun toJson(): String {
    val list = JSONArray()
    for (exercise in exercises) {
      list.put(
        JSONObject()
          .put("id", exercise.id)
          .put("name", exercise.name)
          .put("targetSets", exercise.targetSets)
          .put("done", exercise.done)
          .put("reps", exercise.reps)
          .put("loadKg", exercise.loadKg),
      )
    }
    return JSONObject()
      .put("kind", kind)
      .put("title", title)
      .put("startedAtMs", startedAtMs)
      .put("pausedElapsedMs", pausedElapsedMs)
      .put("exercises", list)
      .put("index", index)
      .put("laps", laps)
      .toString()
  }

  companion object {
    private const val MAX_EXERCISES = 40
    private const val MAX_ELAPSED_MS = 24L * 60 * 60 * 1000
    private val KINDS = setOf("forca", "resistencia", "outro")

    private fun text(value: String, max: Int): String = value.replace(Regex("\\s+"), " ").trim().take(max)

    private fun readExercises(list: JSONArray?): MutableList<CardExercise> {
      val exercises = mutableListOf<CardExercise>()
      if (list == null) return exercises
      for (i in 0 until minOf(list.length(), MAX_EXERCISES)) {
        val item = list.optJSONObject(i) ?: continue
        val id = text(item.optString("id", ""), 60)
        if (id.isEmpty()) continue
        val load = item.optDouble("loadKg", 0.0)
        exercises.add(
          CardExercise(
            id = id,
            name = text(item.optString("name", ""), 60).ifEmpty { "Exercício" },
            targetSets = item.optInt("targetSets", 0).coerceIn(0, 20),
            done = item.optInt("done", 0).coerceIn(0, 200),
            reps = item.optInt("reps", 10).coerceIn(1, 200),
            loadKg = if (load.isNaN()) 0.0 else load.coerceIn(0.0, 500.0),
          ),
        )
      }
      return exercises
    }

    private fun kindOf(value: String): String = if (value in KINDS) value else "outro"

    /** Estado publicado pelo app: `elapsedMs` vale para o instante da publicação. */
    fun fromApp(json: String, now: Long): CardState? =
      try {
        val root = JSONObject(json)
        val elapsed = root.optLong("elapsedMs", 0L).coerceIn(0L, MAX_ELAPSED_MS)
        val paused = root.optBoolean("paused", false)
        val exercises = readExercises(root.optJSONArray("exercises"))
        CardState(
          kind = kindOf(root.optString("kind", "outro")),
          title = text(root.optString("title", ""), 60).ifEmpty { "Treino" },
          startedAtMs = now - elapsed,
          pausedElapsedMs = if (paused) elapsed else -1L,
          exercises = exercises,
          index = root.optInt("index", 0).coerceIn(0, maxOf(0, exercises.size - 1)),
          laps = root.optInt("laps", 0).coerceIn(0, 1000),
        )
      } catch (error: Exception) {
        null
      }

    /** Estado guardado no aparelho pelo próprio cartão. */
    fun fromJson(json: String): CardState? =
      try {
        val root = JSONObject(json)
        val exercises = readExercises(root.optJSONArray("exercises"))
        CardState(
          kind = kindOf(root.optString("kind", "outro")),
          title = text(root.optString("title", ""), 60).ifEmpty { "Treino" },
          startedAtMs = root.optLong("startedAtMs", System.currentTimeMillis()),
          pausedElapsedMs = root.optLong("pausedElapsedMs", -1L).coerceIn(-1L, MAX_ELAPSED_MS),
          exercises = exercises,
          index = root.optInt("index", 0).coerceIn(0, maxOf(0, exercises.size - 1)),
          laps = root.optInt("laps", 0).coerceIn(0, 1000),
        )
      } catch (error: Exception) {
        null
      }
  }
}
