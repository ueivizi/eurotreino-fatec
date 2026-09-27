package expo.modules.treinobloqueio

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Ponte do cartão da tela bloqueada com o app: publicar o estado, tirar o cartão e ler os toques
 * feitos enquanto o app estava fechado. O estado chega em JSON e é conferido campo a campo.
 */
class TreinoBloqueioModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TreinoBloqueio")

    Events("onAction")

    OnCreate {
      CardActionReceiver.listener = { sendEvent("onAction", mapOf("pendente" to true)) }
    }

    OnDestroy {
      CardActionReceiver.listener = null
    }

    Function("show") { json: String ->
      val context = appContext.reactContext ?: return@Function
      val state = CardState.fromApp(json, System.currentTimeMillis()) ?: return@Function
      CardStore.writeState(context, state)
      CardNotifier.show(context, state)
    }

    Function("hide") {
      val context = appContext.reactContext ?: return@Function
      CardStore.writeState(context, null)
      CardNotifier.hide(context)
    }

    Function("drainEvents") {
      val context = appContext.reactContext ?: return@Function "[]"
      CardStore.drainEvents(context)
    }
  }
}
