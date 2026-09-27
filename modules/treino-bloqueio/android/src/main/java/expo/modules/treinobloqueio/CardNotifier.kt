package expo.modules.treinobloqueio

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import java.util.Locale

/**
 * O cartão fixo da sessão: notificação contínua, visível na tela bloqueada, com o relógio que o
 * próprio Android faz correr (nada de repintar de minuto em minuto) e os botões do treino.
 */
internal object CardNotifier {
  private const val CHANNEL_ID = "treino-cartao"
  /** Canal da notificação antiga (silenciosa, escondida da tela bloqueada em muitos aparelhos). */
  private const val OLD_CHANNEL_ID = "sessao"
  private const val NOTIFICATION_ID = 4207
  private const val GOLD = 0xFFC9A24A.toInt()
  private const val GOLD_LIGHT = 0xFFE6C878.toInt()
  /** Android 16: a partir dele o cartão vira Atualização ao vivo (topo da tela bloqueada, sempre aberta). */
  private const val LIVE_UPDATES_SDK = 36
  private val PT_BR: Locale = Locale.forLanguageTag("pt-BR")

  private fun manager(context: Context): NotificationManager =
    context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  private fun ensureChannel(manager: NotificationManager) {
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    // Importância padrão para aparecer na tela bloqueada; sem som nem vibração, porque não é aviso.
    val channel = NotificationChannel(CHANNEL_ID, "Treino em andamento", NotificationManager.IMPORTANCE_DEFAULT)
    channel.description = "Cartão fixo com o relógio e os botões do treino, também com a tela bloqueada."
    channel.setSound(null, null)
    channel.enableVibration(false)
    channel.setShowBadge(false)
    channel.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    manager.createNotificationChannel(channel)
    manager.deleteNotificationChannel(OLD_CHANNEL_ID)
  }

  fun show(context: Context, state: CardState) {
    val manager = manager(context)
    ensureChannel(manager)
    if (!manager.areNotificationsEnabled()) return

    val now = System.currentTimeMillis()
    val elapsed = state.elapsedMs(now)
    val texts = content(state)
    val notification =
      if (Build.VERSION.SDK_INT >= LIVE_UPDATES_SDK) liveUpdate(context, state, texts, elapsed, now) else customCard(context, state, texts, elapsed, now)
    manager.notify(NOTIFICATION_ID, notification)
  }

  /**
   * Android 16+: Atualização ao vivo. O sistema põe no topo da tela bloqueada, aberta e sem recolher,
   * abaixo do player de música, e mostra o relógio num selo na barra de status. Exige o estilo padrão
   * (sem layout próprio): barra de progresso da ficha, textos e até três botões.
   */
  private fun liveUpdate(context: Context, state: CardState, texts: Content, elapsed: Long, now: Long): Notification {
    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.treino_icone)
      .setColor(GOLD)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setCategory(NotificationCompat.CATEGORY_WORKOUT)
      .setContentTitle(texts.title)
      .setContentText("${texts.series} · ${texts.detail}")
      .setSubText(state.title)
      .setContentIntent(openApp(context))
      .setRequestPromotedOngoing(true)
      .setShowWhen(!state.paused)
    if (state.paused) {
      builder.setShortCriticalText("Pausa")
    } else {
      builder.setWhen(now - elapsed).setUsesChronometer(true)
    }
    val progress = workoutProgress(state)
    if (progress != null) builder.setStyle(progress)

    val main = texts.main
    if (texts.loadButtons) builder.addAction(R.drawable.treino_icone, "− 2,5", action(context, CardActions.LOAD_DOWN, 3))
    if (main != null) builder.addAction(R.drawable.treino_icone, main.first, action(context, main.second, 2))
    if (texts.loadButtons) {
      builder.addAction(R.drawable.treino_icone, "+ 2,5", action(context, CardActions.LOAD_UP, 4))
    } else {
      val pause = if (state.paused) "Retomar" to CardActions.RESUME else "Pausar" to CardActions.PAUSE
      builder.addAction(R.drawable.treino_icone, pause.first, action(context, pause.second, 1))
    }
    return builder.build()
  }

  /** A ficha inteira numa barra: um trecho por exercício, do tamanho da meta de séries. */
  private fun workoutProgress(state: CardState): NotificationCompat.ProgressStyle? {
    if (state.kind != "forca") return null
    val planned = state.exercises.filter { it.targetSets > 0 }
    if (planned.isEmpty()) return null
    val style = NotificationCompat.ProgressStyle().setStyledByProgress(true)
    planned.forEachIndexed { position, exercise ->
      style.addProgressSegment(
        NotificationCompat.ProgressStyle.Segment(exercise.targetSets).setColor(if (position % 2 == 0) GOLD else GOLD_LIGHT),
      )
    }
    style.setProgress(planned.sumOf { minOf(it.done, it.targetSets) })
    return style
  }

  /** Android 15 e anteriores: cartão com layout próprio; o recolhido já traz os botões. */
  private fun customCard(context: Context, state: CardState, texts: Content, elapsed: Long, now: Long): Notification {
    val compact = RemoteViews(context.packageName, R.layout.treino_cartao_compacto)
    val expanded = RemoteViews(context.packageName, R.layout.treino_cartao)
    fillCompact(context, compact, state, texts)
    fillExpanded(context, expanded, state, texts, elapsed)

    val builder = Notification.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.treino_icone)
      .setColor(GOLD)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setCategory(Notification.CATEGORY_PROGRESS)
      .setSubText(state.title)
      .setStyle(Notification.DecoratedCustomViewStyle())
      .setCustomContentView(compact)
      .setCustomBigContentView(expanded)
      .setContentIntent(openApp(context))
      .setShowWhen(!state.paused)
    if (!state.paused) {
      builder.setWhen(now - elapsed).setUsesChronometer(true)
    }
    return builder.build()
  }

  fun hide(context: Context) {
    manager(context).cancel(NOTIFICATION_ID)
  }

  /** Textos e botões do cartão, calculados uma vez para os dois tamanhos. */
  private class Content(
    val title: String,
    val series: String,
    val detail: String,
    /** Rótulo e ação do botão principal; nulo quando não há o que marcar. */
    val main: Pair<String, String>?,
    val loadButtons: Boolean,
  )

  private fun content(state: CardState): Content {
    val exercise = state.current()
    return when {
      state.kind == "forca" && exercise != null -> {
        val canMark = !exercise.complete
        Content(
          title = exercise.name,
          series = seriesLine(state, exercise),
          detail = if (state.paused) "Pausado · ${numbers(exercise)}" else numbers(exercise),
          main = if (canMark) "Série feita" to CardActions.SET else null,
          loadButtons = canMark,
        )
      }
      state.kind == "resistencia" ->
        Content(
          title = state.title,
          series = lapsLine(state.laps),
          detail = if (state.paused) "Pausado" else "Em andamento",
          main = "Marcar volta" to CardActions.LAP,
          loadButtons = false,
        )
      else -> {
        val done = state.exercises.sumOf { it.done }
        Content(
          title = state.title,
          series = if (done == 1) "1 série feita" else "$done séries feitas",
          detail = if (state.paused) "Pausado" else "Em andamento",
          main = null,
          loadButtons = false,
        )
      }
    }
  }

  /**
   * Cada tamanho só recebe os campos que o layout dele tem: mexer num campo que não existe faz o
   * Android recusar a notificação inteira.
   */
  private fun fillCompact(context: Context, views: RemoteViews, state: CardState, content: Content) {
    views.setTextViewText(R.id.detalhe, "${content.title} · ${content.series} · ${content.detail}")
    val main = content.main
    views.setViewVisibility(R.id.botao_serie, if (main != null) View.VISIBLE else View.GONE)
    if (main != null) {
      views.setTextViewText(R.id.botao_serie, main.first)
      views.setOnClickPendingIntent(R.id.botao_serie, action(context, main.second, 10))
    }
    val load = if (content.loadButtons) View.VISIBLE else View.GONE
    views.setViewVisibility(R.id.botao_menos, load)
    views.setViewVisibility(R.id.botao_mais, load)
    views.setOnClickPendingIntent(R.id.botao_menos, action(context, CardActions.LOAD_DOWN, 13))
    views.setOnClickPendingIntent(R.id.botao_mais, action(context, CardActions.LOAD_UP, 14))
    // Sem os botões de carga, sobra lugar para pausar direto do cartão recolhido.
    views.setViewVisibility(R.id.botao_pausa, if (content.loadButtons) View.GONE else View.VISIBLE)
    views.setTextViewText(R.id.botao_pausa, if (state.paused) "Retomar" else "Pausar")
    views.setOnClickPendingIntent(R.id.botao_pausa, action(context, if (state.paused) CardActions.RESUME else CardActions.PAUSE, 11))
  }

  private fun fillExpanded(context: Context, views: RemoteViews, state: CardState, content: Content, elapsed: Long) {
    views.setChronometer(R.id.relogio, SystemClock.elapsedRealtime() - elapsed, null, !state.paused)
    views.setTextViewText(R.id.titulo, content.title)
    views.setTextViewText(R.id.serie, content.series)
    views.setTextViewText(R.id.detalhe, content.detail)
    val main = content.main
    views.setViewVisibility(R.id.botao_serie, if (main != null) View.VISIBLE else View.GONE)
    if (main != null) {
      views.setTextViewText(R.id.botao_serie, main.first)
      views.setOnClickPendingIntent(R.id.botao_serie, action(context, main.second, 2))
    }
    val load = if (content.loadButtons) View.VISIBLE else View.GONE
    views.setViewVisibility(R.id.botao_menos, load)
    views.setViewVisibility(R.id.botao_mais, load)
    views.setOnClickPendingIntent(R.id.botao_menos, action(context, CardActions.LOAD_DOWN, 3))
    views.setOnClickPendingIntent(R.id.botao_mais, action(context, CardActions.LOAD_UP, 4))
    views.setTextViewText(R.id.botao_pausa, if (state.paused) "Retomar" else "Pausar")
    views.setOnClickPendingIntent(R.id.botao_pausa, action(context, if (state.paused) CardActions.RESUME else CardActions.PAUSE, 1))
  }

  private fun seriesLine(state: CardState, exercise: CardExercise): String {
    if (exercise.targetSets == 0) return "Série ${roman(exercise.done + 1)}"
    if (exercise.complete) return if (state.nextOpen() < 0) "Ficha concluída" else "Séries completas"
    return "Série ${roman(exercise.done + 1)} de ${roman(exercise.targetSets)}"
  }

  private fun numbers(exercise: CardExercise): String {
    val load = if (exercise.loadKg > 0) String.format(PT_BR, "%.1f kg", exercise.loadKg) else "peso livre"
    return "${exercise.reps} reps · $load"
  }

  private fun lapsLine(laps: Int): String =
    when (laps) {
      0 -> "Sem voltas marcadas"
      1 -> "1 volta"
      else -> "$laps voltas"
    }

  /** Séries em numeral romano, o mesmo alfabeto das divisões de rank. */
  private fun roman(value: Int): String {
    var rest = value.coerceIn(1, 3999)
    val numerals = listOf(1000 to "M", 900 to "CM", 500 to "D", 400 to "CD", 100 to "C", 90 to "XC", 50 to "L", 40 to "XL", 10 to "X", 9 to "IX", 5 to "V", 4 to "IV", 1 to "I")
    val out = StringBuilder()
    for ((amount, symbol) in numerals) {
      while (rest >= amount) {
        out.append(symbol)
        rest -= amount
      }
    }
    return out.toString()
  }

  private fun action(context: Context, name: String, requestCode: Int): PendingIntent {
    val intent = Intent(context, CardActionReceiver::class.java).setAction(name)
    return PendingIntent.getBroadcast(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  /** Tocar no cartão abre a sessão no app. */
  private fun openApp(context: Context): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("eurotreino://sessao"))
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }
}
