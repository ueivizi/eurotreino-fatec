package expo.modules.treinobloqueio

import android.app.Activity
import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.view.WindowManager

/**
 * Treino sobre a tela bloqueada: durante uma sessão, o app pode aparecer por cima do bloqueio (como
 * navegação e apps de corrida fazem). Aqui ficam o liga/desliga, a leitura de "está bloqueado" e o
 * aviso quando a tela apaga, acende ou é desbloqueada. Quem limita o app à tela do treino enquanto
 * está bloqueado é o lado JS.
 */
internal class LockScreenWatcher(private val context: Context, private val onChange: (Boolean) -> Unit) {
  private var registered = false

  private val receiver = object : BroadcastReceiver() {
    override fun onReceive(receiverContext: Context, intent: Intent) {
      onChange(isLocked())
    }
  }

  fun isLocked(): Boolean {
    val keyguard = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
    return keyguard.isKeyguardLocked
  }

  fun start() {
    if (registered) return
    val filter = IntentFilter().apply {
      addAction(Intent.ACTION_SCREEN_ON)
      addAction(Intent.ACTION_SCREEN_OFF)
      addAction(Intent.ACTION_USER_PRESENT)
    }
    // Só avisos do sistema: o receptor não aceita nada vindo de outros apps.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      context.registerReceiver(receiver, filter)
    }
    registered = true
  }

  fun stop() {
    if (!registered) return
    try {
      context.unregisterReceiver(receiver)
    } catch (error: IllegalArgumentException) {
      // Já tinha saído: nada a fazer.
    }
    registered = false
  }

  companion object {
    /** Liga ou desliga "mostrar sobre a tela bloqueada" na tela do app. */
    fun setShowWhenLocked(activity: Activity, enabled: Boolean) {
      activity.runOnUiThread {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
          activity.setShowWhenLocked(enabled)
        } else if (enabled) {
          @Suppress("DEPRECATION")
          activity.window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED)
        } else {
          @Suppress("DEPRECATION")
          activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED)
        }
      }
    }

    /** Pede o desbloqueio (digital, PIN) para sair da tela do treino e usar o resto do app. */
    fun requestUnlock(activity: Activity) {
      activity.runOnUiThread {
        val keyguard = activity.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        keyguard.requestDismissKeyguard(activity, null)
      }
    }
  }
}
