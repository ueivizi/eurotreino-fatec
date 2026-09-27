package expo.modules.treinobloqueio

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Recebe os botões do cartão. Funciona com o app fechado: aplica o toque no estado guardado,
 * redesenha o cartão e deixa o evento na fila; se o app estiver aberto, avisa para ele aplicar já.
 */
class CardActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action ?: return
    // Só as ações do próprio cartão; o receptor nem é exportado, mas a lista fecha a porta.
    if (action !in CardActions.ALL) return
    val state = CardStore.mutate(context) { current -> CardActions.apply(current, action, System.currentTimeMillis()) } ?: return
    CardNotifier.show(context, state)
    listener?.invoke()
  }

  companion object {
    /** O módulo, quando o app está aberto, para aplicar os toques na hora. */
    @Volatile
    var listener: (() -> Unit)? = null
  }
}
