package nl.taakhelden.family.widget

import android.content.Context
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.padding
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import androidx.compose.ui.graphics.Color
import androidx.glance.GlanceId
import nl.taakhelden.core.designsystem.WPalettes
import nl.taakhelden.family.R
import nl.taakhelden.family.platform.AppPreferences

/**
 * Home-screen widget showing how many tasks are still open today.
 *
 * It reads a plain preference written after each parent sync rather than calling the API:
 * a widget has no session, and a count is the most a lock screen should ever reveal about
 * a family's day (privacy rule 5 — no names, no task titles).
 */
class OpenTasksWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val openCount = AppPreferences.openTaskCount(context)

        provideContent {
            GlanceTheme {
                WidgetContent(context = context, openCount = openCount)
            }
        }
    }
}

@androidx.compose.runtime.Composable
private fun WidgetContent(context: Context, openCount: Int) {
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(ColorProvider(Color(WPalettes.kid.background.argb)))
            .padding(12.dp),
        verticalAlignment = Alignment.Vertical.CenterVertically,
    ) {
        Text(
            text = context.getString(R.string.app_name),
            style = TextStyle(
                color = ColorProvider(Color(WPalettes.kid.mutedText.argb)),
                fontWeight = FontWeight.Medium,
            ),
        )
        Text(
            text = if (openCount == 0) {
                context.getString(R.string.widget_all_done)
            } else {
                context.getString(R.string.widget_open_tasks, openCount)
            },
            style = TextStyle(
                color = ColorProvider(Color(WPalettes.kid.text.argb)),
                fontWeight = FontWeight.Bold,
            ),
        )
        Text(
            text = context.getString(R.string.widget_open_hint),
            style = TextStyle(color = ColorProvider(Color(WPalettes.kid.mutedText.argb))),
        )
    }
}

class OpenTasksWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = OpenTasksWidget()
}
