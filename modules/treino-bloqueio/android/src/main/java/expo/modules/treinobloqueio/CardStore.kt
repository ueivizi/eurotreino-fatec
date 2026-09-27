package expo.modules.treinobloqueio

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/**
 * Estado do cartão e fila de toques, no armazenamento do app. Precisam valer com o app fechado:
 * quem responde ao botão pode ser um processo novo, aberto só para isso.
 */
internal object CardStore {
  private const val PREFS = "eurotreino.cartao"
  private const val KEY_STATE = "estado"
  private const val KEY_EVENTS = "eventos"
  private const val MAX_EVENTS = 500
  private val lock = Any()

  private fun prefs(context: Context): SharedPreferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private fun readEvents(context: Context): JSONArray =
    try {
      JSONArray(prefs(context).getString(KEY_EVENTS, "[]") ?: "[]")
    } catch (error: Exception) {
      JSONArray()
    }

  fun writeState(context: Context, state: CardState?) {
    synchronized(lock) {
      val editor = prefs(context).edit()
      if (state == null) {
        editor.remove(KEY_STATE)
        // Sessão acabou: toque que ficou na fila não tem mais onde entrar.
        editor.remove(KEY_EVENTS)
      } else {
        editor.putString(KEY_STATE, state.toJson())
      }
      editor.commit()
    }
  }

  /** Lê o estado, aplica o toque e grava estado e eventos juntos. */
  fun mutate(context: Context, change: (CardState) -> List<JSONObject>): CardState? {
    synchronized(lock) {
      val raw = prefs(context).getString(KEY_STATE, null) ?: return null
      val state = CardState.fromJson(raw) ?: return null
      val events = change(state)
      if (events.isEmpty()) return state
      val list = readEvents(context)
      for (event in events) {
        if (list.length() < MAX_EVENTS) list.put(event)
      }
      prefs(context).edit().putString(KEY_STATE, state.toJson()).putString(KEY_EVENTS, list.toString()).commit()
      return state
    }
  }

  /** Entrega os toques ainda não aplicados e esvazia a fila. */
  fun drainEvents(context: Context): String {
    synchronized(lock) {
      val list = readEvents(context)
      prefs(context).edit().remove(KEY_EVENTS).commit()
      return list.toString()
    }
  }
}
