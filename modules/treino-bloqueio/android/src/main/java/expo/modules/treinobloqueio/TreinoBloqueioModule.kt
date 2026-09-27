package expo.modules.treinobloqueio

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Ponte do cartão da tela bloqueada com o app: publicar o estado, tirar o cartão e ler os toques
 * feitos enquanto o app estava fechado. O estado chega em JSON e é conferido campo a campo.
 */
class TreinoBloqueioModule : Module() {
  private var watcher: LockScreenWatcher? = null

  override fun definition() = ModuleDefinition {
    Name("TreinoBloqueio")

    Events("onAction", "onLockChange")

    OnCreate {
      CardActionReceiver.listener = { sendEvent("onAction", mapOf("pendente" to true)) }
      val context = appContext.reactContext
      if (context != null) {
        val created = LockScreenWatcher(context) { locked -> sendEvent("onLockChange", mapOf("locked" to locked)) }
        created.start()
        watcher = created
      }
    }

    OnDestroy {
      CardActionReceiver.listener = null
      watcher?.stop()
      watcher = null
    }

    Function("isLocked") {
      watcher?.isLocked() ?: false
    }

    Function("setShowWhenLocked") { enabled: Boolean ->
      val activity = appContext.currentActivity
      if (activity != null) LockScreenWatcher.setShowWhenLocked(activity, enabled)
    }

    Function("requestUnlock") {
      val activity = appContext.currentActivity
      if (activity != null) LockScreenWatcher.requestUnlock(activity)
    }

    // Sem retorno antecipado (return@Function): no compilador do Kotlin 2 ele não fecha o tipo.
    Function("show") { json: String ->
      val context = appContext.reactContext
      val state = CardState.fromApp(json, System.currentTimeMillis())
      if (context != null && state != null) {
        CardStore.writeState(context, state)
        CardNotifier.show(context, state)
      }
    }

    Function("hide") {
      val context = appContext.reactContext
      if (context != null) {
        CardStore.writeState(context, null)
        CardNotifier.hide(context)
      }
    }

    Function("drainEvents") {
      val context = appContext.reactContext
      if (context != null) CardStore.drainEvents(context) else "[]"
    }
  }
}
