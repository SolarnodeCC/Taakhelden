import WidgetKit
import SwiftUI

/// Optional home-screen widget scaffold. Shares open-task count via App Group
/// `group.nl.taakhelden.family` (written by `OpenTaskCountStore` after parent sync).
/// Wire this target into XcodeGen / Xcode on macOS; Linux CI does not build it.

struct OpenTasksEntry: TimelineEntry {
    let date: Date
    let openCount: Int
}

struct OpenTasksProvider: TimelineProvider {
    func placeholder(in context: Context) -> OpenTasksEntry {
        OpenTasksEntry(date: .now, openCount: 2)
    }

    func getSnapshot(in context: Context, completion: @escaping (OpenTasksEntry) -> Void) {
        completion(OpenTasksEntry(date: .now, openCount: OpenTaskCountStore.shared.count))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<OpenTasksEntry>) -> Void) {
        let entry = OpenTasksEntry(date: .now, openCount: OpenTaskCountStore.shared.count)
        completion(Timeline(entries: [entry], policy: .after(.now.addingTimeInterval(15 * 60))))
    }
}

struct OpenTasksWidgetView: View {
    let entry: OpenTasksEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Wispel")
                .font(.headline)
            Text(entry.openCount == 0 ? "Alles af voor nu" : "Nog \(entry.openCount) taken")
                .font(.title2.bold())
            Text("Open de app voor details")
                .font(.caption)
        }
        .padding()
    }
}

struct OpenTasksWidget: Widget {
    let kind = "OpenTasksWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: OpenTasksProvider()) { entry in
            OpenTasksWidgetView(entry: entry)
        }
        .configurationDisplayName("Nog N taken")
        .description("Toont hoeveel open taken er vandaag nog staan.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
