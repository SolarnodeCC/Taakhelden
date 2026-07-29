import SwiftUI

struct ParentModeRootView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var redoTarget: ApprovalQueueItem?
    @State private var redoNote = ""
    @State private var showsDeleteConfirmation = false

    var body: some View {
        @Bindable var appState = appState
        let palette = THPalettes.parent
        let store = appState.parentMode

        NavigationStack {
            VStack(spacing: 0) {
                header(palette: palette, store: store)

                Picker(String(localized: "parent.mode.title"), selection: $appState.parentMode.activeSurface) {
                    Text(LocalizedStringKey("parent.surface.vandaag")).tag(ParentSurface.vandaag)
                    Text(LocalizedStringKey("parent.surface.goedkeuren")).tag(ParentSurface.goedkeuren)
                    Text(LocalizedStringKey("parent.surface.instellingen")).tag(ParentSurface.instellingen)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, THSpacing.xl)
                .padding(.vertical, THSpacing.md)

                Group {
                    switch store.activeSurface {
                    case .vandaag:
                        ParentTodayView(snapshot: store.snapshot, isLoading: store.isLoading)
                    case .goedkeuren:
                        ParentApprovalsView(
                            snapshot: store.snapshot,
                            selectedApprovalID: Binding(
                                get: { store.selectedApprovalID },
                                set: { store.selectedApprovalID = $0 }
                            ),
                            selectedApprovalIDs: Binding(
                                get: { store.selectedApprovalIDs },
                                set: { store.selectedApprovalIDs = $0 }
                            ),
                            acknowledgedBulkPhotoReview: Binding(
                                get: { store.acknowledgedBulkPhotoReview },
                                set: { store.acknowledgedBulkPhotoReview = $0 }
                            ),
                            isRegularWidth: horizontalSizeClass == .regular,
                            isBulkApproving: store.isBulkApproving,
                            onSelect: { item in
                                store.selectedApprovalID = item.id
                            },
                            onToggleSelection: { item in
                                store.toggleSelection(for: item)
                            },
                            onApprove: { item in
                                Task { await store.approve(item) }
                            },
                            onRedo: { item in
                                redoTarget = item
                                redoNote = ""
                            },
                            onBulkApprove: {
                                Task { await store.approveSelectedItems() }
                            },
                            onOpenPhoto: { item in
                                store.openFullscreenPhoto(for: item)
                            },
                            bulkValidation: store.bulkApprovalValidation()
                        )
                    case .instellingen:
                        ParentSettingsView(
                            snapshot: store.snapshot,
                            exportStatusMessage: store.exportStatusMessage,
                            deletionStatusMessage: store.deletionStatusMessage,
                            onSoundToggle: { isEnabled in
                                Task { await store.updateSoundPreference(isEnabled: isEnabled) }
                            },
                            onExport: {
                                Task { await store.requestExport() }
                            },
                            onDelete: {
                                showsDeleteConfirmation = true
                            }
                        )
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .background(palette.background.color.ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(String(localized: "parent.mode.back")) {
                        appState.closeParentMode()
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button(String(localized: "parent.mode.refresh")) {
                        Task { await store.refresh(trigger: .manualRefresh) }
                    }
                    .disabled(store.isLoading)
                }
            }
        }
        .task {
            await store.beginSession()
        }
        .onChange(of: scenePhase) { _, newPhase in
            guard newPhase == .active, store.isSessionActive else {
                return
            }

            Task {
                await store.refresh(trigger: .appBecameActive)
            }
        }
        .onDisappear {
            appState.parentMode.endSession()
        }
        .sheet(item: $redoTarget) { item in
            ParentRedoSheet(
                item: item,
                note: $redoNote,
                onCancel: {
                    redoTarget = nil
                    redoNote = ""
                },
                onSubmit: {
                    let trimmed = redoNote.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard trimmed.isEmpty == false else { return }
                    Task {
                        await store.sendRedo(for: item, note: trimmed)
                        redoTarget = nil
                        redoNote = ""
                    }
                }
            )
            .presentationDetents([.fraction(0.45)])
        }
        .fullScreenCover(item: Binding(
            get: { store.fullscreenPhoto },
            set: { updated in
                if updated == nil {
                    store.closeFullscreenPhoto()
                }
            }
        )) { asset in
            ParentPhotoFullscreenView(asset: asset) {
                store.closeFullscreenPhoto()
            }
        }
        .confirmationDialog(
            String(localized: "parent.settings.delete.confirm.title"),
            isPresented: $showsDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button(String(localized: "parent.settings.delete.confirm.button"), role: .destructive) {
                Task {
                    let deleted = await appState.parentMode.requestDeleteAccount()
                    if deleted {
                        appState.closeParentMode()
                        appState.returnToWelcome()
                    }
                }
            }
            Button(String(localized: "parent.settings.delete.confirm.cancel"), role: .cancel) {}
        } message: {
            Text(LocalizedStringKey("parent.settings.delete.confirm.message"))
        }
    }

    private func header(palette: THPalette, store: ParentModeStore) -> some View {
        VStack(alignment: .leading, spacing: THSpacing.sm) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: THSpacing.xs) {
                    Text(LocalizedStringKey("parent.mode.title"))
                        .font(.system(size: 30, weight: .bold, design: .default))
                        .foregroundStyle(palette.text.color)
                    Text(LocalizedStringKey("parent.mode.subtitle"))
                        .foregroundStyle(palette.mutedText.color)
                }
                Spacer()
                THBadge(
                    text: LocalizedStringKey("\(store.snapshot?.pendingApprovalCount ?? 0) te keuren"),
                    palette: palette,
                    fontDesign: .default
                )
            }

            HStack(spacing: THSpacing.md) {
                ParentStatusPill(
                    title: "Live",
                    detail: connectionLabel(for: store.connectionState),
                    palette: palette
                )
                ParentStatusPill(
                    title: "Sync",
                    detail: syncLabel(for: store.syncCoordinator.state),
                    palette: palette
                )
            }

            if let loadErrorMessage = store.loadErrorMessage {
                Text(loadErrorMessage)
                    .font(.footnote)
                    .foregroundStyle(palette.mutedText.color)
            }
        }
        .padding(.horizontal, THSpacing.xl)
        .padding(.top, THSpacing.xl)
    }

    private func connectionLabel(for state: FamilyRoomConnectionState) -> String {
        switch state {
        case .disconnected:
            return String(localized: "parent.sync.disconnected")
        case .connecting:
            return String(localized: "parent.sync.connecting")
        case .connected:
            return String(localized: "parent.sync.connected")
        case .waitingToReconnect(let seconds):
            return String(format: String(localized: "parent.sync.reconnect"), seconds)
        }
    }

    private func syncLabel(for state: ParentSyncState) -> String {
        switch state {
        case .idle:
            return String(localized: "parent.sync.idle")
        case .syncing:
            return String(localized: "parent.sync.busy")
        case .synced(_, let date):
            return String(format: String(localized: "parent.sync.updated"), date.formatted(date: .omitted, time: .shortened))
        case .failed:
            return String(localized: "parent.sync.retry")
        }
    }
}

private struct ParentStatusPill: View {
    let title: String
    let detail: String
    let palette: THPalette

    var body: some View {
        VStack(alignment: .leading, spacing: THSpacing.xs) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(palette.mutedText.color)
            Text(detail)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(palette.text.color)
        }
        .padding(.horizontal, THSpacing.md)
        .padding(.vertical, THSpacing.sm)
        .background(palette.surface.color)
        .clipShape(RoundedRectangle(cornerRadius: THRadius.medium, style: .continuous))
    }
}

private struct ParentTodayView: View {
    let snapshot: ParentDashboardSnapshot?
    let isLoading: Bool

    var body: some View {
        let palette = THPalettes.parent

        ScrollView {
            VStack(alignment: .leading, spacing: THSpacing.lg) {
                if isLoading && snapshot == nil {
                    THCard(palette: palette, cornerRadius: THRadius.medium, shadowRadius: 3, shadowYOffset: 1) {
                        Text(LocalizedStringKey("parent.today.loading"))
                            .font(.headline)
                        Text(LocalizedStringKey("parent.today.loading.detail"))
                            .foregroundStyle(palette.mutedText.color)
                    }
                } else if let snapshot, snapshot.todayChildren.isEmpty {
                    THCard(palette: palette, cornerRadius: THRadius.medium, shadowRadius: 3, shadowYOffset: 1) {
                        Text(LocalizedStringKey("parent.today.empty"))
                            .font(.headline)
                        Text(LocalizedStringKey("parent.today.empty.detail"))
                            .foregroundStyle(palette.mutedText.color)
                    }
                } else if let snapshot {
                    ForEach(snapshot.todayChildren) { child in
                        THCard(palette: palette, cornerRadius: THRadius.medium, shadowRadius: 3, shadowYOffset: 1) {
                            HStack {
                                VStack(alignment: .leading, spacing: THSpacing.xs) {
                                    Text("\(child.avatar) \(child.displayName)")
                                        .font(.system(size: 22, weight: .bold, design: .default))
                                        .foregroundStyle(palette.text.color)
                                    Text("\(child.balancePoints) punten")
                                        .foregroundStyle(palette.mutedText.color)
                                }
                                Spacer()
                            }

                            if child.tasks.isEmpty {
                                Text(String(format: String(localized: "parent.today.child.quiet"), child.displayName.lowercased()))
                                    .foregroundStyle(palette.mutedText.color)
                            } else {
                                ForEach(child.groupedTasks, id: \.bucket.id) { group in
                                    VStack(alignment: .leading, spacing: THSpacing.sm) {
                                        Text(group.bucket.title)
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(palette.mutedText.color)
                                        if group.items.isEmpty {
                                            Text("—")
                                                .foregroundStyle(palette.mutedText.color)
                                        } else {
                                            ForEach(group.items) { item in
                                                HStack(alignment: .top, spacing: THSpacing.sm) {
                                                    if let icon = item.icon { Text(icon) }
                                                    VStack(alignment: .leading, spacing: THSpacing.xs) {
                                                        Text(item.title)
                                                            .foregroundStyle(palette.text.color)
                                                        Text(item.statusLabel)
                                                            .font(.footnote)
                                                            .foregroundStyle(palette.mutedText.color)
                                                    }
                                                    Spacer()
                                                    Text("\(item.points) pt")
                                                        .font(.footnote.weight(.semibold))
                                                        .foregroundStyle(palette.mutedText.color)
                                                }
                                                .padding(THSpacing.md)
                                                .background(palette.background.color)
                                                .clipShape(RoundedRectangle(cornerRadius: THRadius.large, style: .continuous))
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .padding(THSpacing.xl)
        }
    }
}

private struct ParentApprovalsView: View {
    let snapshot: ParentDashboardSnapshot?
    @Binding var selectedApprovalID: String?
    @Binding var selectedApprovalIDs: Set<String>
    @Binding var acknowledgedBulkPhotoReview: Bool
    let isRegularWidth: Bool
    let isBulkApproving: Bool
    let onSelect: (ApprovalQueueItem) -> Void
    let onToggleSelection: (ApprovalQueueItem) -> Void
    let onApprove: (ApprovalQueueItem) -> Void
    let onRedo: (ApprovalQueueItem) -> Void
    let onBulkApprove: () -> Void
    let onOpenPhoto: (ApprovalQueueItem) -> Void
    let bulkValidation: BulkApprovalValidation

    var body: some View {
        let sections = snapshot?.approvalSections ?? []
        let items = sections.flatMap(\.items)

        Group {
            if sections.isEmpty {
                ScrollView {
                    THCard(palette: THPalettes.parent, cornerRadius: THRadius.medium, shadowRadius: 3, shadowYOffset: 1) {
                        Text(LocalizedStringKey("parent.approvals.empty"))
                            .font(.headline)
                        Text(LocalizedStringKey("parent.approvals.empty.detail"))
                            .foregroundStyle(THPalettes.parent.mutedText.color)
                    }
                    .padding(THSpacing.xl)
                }
            } else if isRegularWidth {
                NavigationSplitView {
                    List {
                        ForEach(sections) { section in
                            Section {
                                ForEach(section.items) { item in
                                    ParentApprovalRow(
                                        item: item,
                                        isSelected: selectedApprovalIDs.contains(item.id),
                                        onSelect: { onSelect(item) },
                                        onToggleSelection: { onToggleSelection(item) },
                                        onOpenPhoto: { onOpenPhoto(item) }
                                    )
                                }
                            } header: {
                                Text("\(section.childAvatar) \(section.childName)")
                            }
                        }
                    }
                } detail: {
                    if let selectedApprovalID, let item = items.first(where: { $0.id == selectedApprovalID }) {
                        ParentApprovalDetailCard(item: item, onApprove: {
                            onApprove(item)
                        }, onRedo: {
                            onRedo(item)
                        }, onOpenPhoto: {
                            onOpenPhoto(item)
                        })
                        .padding(THSpacing.xl)
                    } else {
                        ContentUnavailableView(String(localized: "parent.approvals.ipad.pick"), systemImage: "checklist")
                    }
                }
                .safeAreaInset(edge: .bottom) {
                    ParentBulkApprovalBar(
                        validation: bulkValidation,
                        isBusy: isBulkApproving,
                        acknowledgedBulkPhotoReview: $acknowledgedBulkPhotoReview,
                        selectionCount: selectedApprovalIDs.count,
                        onApprove: onBulkApprove
                    )
                    .padding(.horizontal, THSpacing.xl)
                    .padding(.bottom, THSpacing.md)
                }
            } else {
                ScrollView {
                    VStack(spacing: THSpacing.lg) {
                        ForEach(sections) { section in
                            THCard(palette: THPalettes.parent, cornerRadius: THRadius.medium, shadowRadius: 3, shadowYOffset: 1) {
                                Text("\(section.childAvatar) \(section.childName)")
                                    .font(.headline)
                                ForEach(section.items) { item in
                                    ParentApprovalDetailCard(
                                        item: item,
                                        usesCardChrome: false,
                                        isSelected: selectedApprovalIDs.contains(item.id),
                                        onToggleSelection: {
                                            onToggleSelection(item)
                                        },
                                        onApprove: {
                                            onApprove(item)
                                        },
                                        onRedo: {
                                            onRedo(item)
                                        },
                                        onOpenPhoto: {
                                            onOpenPhoto(item)
                                        }
                                    )
                                }
                            }
                        }
                    }
                    .padding(THSpacing.xl)
                }
                .safeAreaInset(edge: .bottom) {
                    ParentBulkApprovalBar(
                        validation: bulkValidation,
                        isBusy: isBulkApproving,
                        acknowledgedBulkPhotoReview: $acknowledgedBulkPhotoReview,
                        selectionCount: selectedApprovalIDs.count,
                        onApprove: onBulkApprove
                    )
                    .padding(.horizontal, THSpacing.xl)
                    .padding(.bottom, THSpacing.md)
                }
            }
        }
    }
}

private struct ParentApprovalRow: View {
    let item: ApprovalQueueItem
    let isSelected: Bool
    let onSelect: () -> Void
    let onToggleSelection: () -> Void
    let onOpenPhoto: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: THSpacing.sm) {
            HStack {
                Button(action: onToggleSelection) {
                    Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                        .foregroundStyle(THPalettes.parent.accent.color)
                }
                .buttonStyle(.plain)

                Button(action: onSelect) {
                    VStack(alignment: .leading, spacing: THSpacing.xs) {
                        Text("\(item.icon ?? "") \(item.title)")
                            .foregroundStyle(THPalettes.parent.text.color)
                        Text(item.submittedAt.formatted(date: .abbreviated, time: .shortened))
                            .font(.footnote)
                            .foregroundStyle(THPalettes.parent.mutedText.color)
                    }
                }
                .buttonStyle(.plain)

                Spacer()

                if item.hasPhoto {
                    Button(String(localized: "parent.approvals.photo.safe")) {
                        onOpenPhoto()
                    }
                    .font(.footnote.weight(.semibold))
                }
            }
        }
    }
}

private struct ParentApprovalDetailCard: View {
    let item: ApprovalQueueItem
    var usesCardChrome: Bool = true
    var isSelected: Bool = false
    var onToggleSelection: (() -> Void)?
    let onApprove: () -> Void
    let onRedo: () -> Void
    let onOpenPhoto: () -> Void

    var body: some View {
        let palette = THPalettes.parent

        VStack(alignment: .leading, spacing: THSpacing.md) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: THSpacing.xs) {
                    Text("\(item.icon ?? "") \(item.title)")
                        .font(.system(size: 22, weight: .bold, design: .default))
                        .foregroundStyle(palette.text.color)
                    Text(String(format: String(localized: "parent.approvals.submitted.by"), item.childName))
                        .foregroundStyle(palette.mutedText.color)
                    Text(item.submittedAt.formatted(date: .abbreviated, time: .shortened))
                        .font(.footnote)
                        .foregroundStyle(palette.mutedText.color)
                }
                Spacer()
                Text("\(item.points) punten")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(palette.mutedText.color)
            }

            if let photoAsset = item.photoAsset {
                Button(action: onOpenPhoto) {
                    ZStack {
                        RoundedRectangle(cornerRadius: THRadius.large, style: .continuous)
                            .fill(palette.accentSoft.color)
                            .frame(height: 220)
                        VStack(spacing: THSpacing.sm) {
                            Image(systemName: "photo.on.rectangle.angled")
                                .font(.system(size: 36))
                                .foregroundStyle(palette.accent.color)
                            Text(photoAsset.accessibilityLabel)
                                .font(.footnote)
                                .foregroundStyle(palette.text.color)
                            Text(LocalizedStringKey("parent.approvals.photo.safe"))
                                .font(.footnote)
                                .foregroundStyle(palette.mutedText.color)
                                .multilineTextAlignment(.center)
                        }
                        .padding()
                    }
                }
                .buttonStyle(.plain)
            } else {
                THBadge(text: LocalizedStringKey("parent.approvals.no.photo"), palette: palette, fontDesign: .default)
            }

            if let onToggleSelection {
                Toggle(isOn: Binding(
                    get: { isSelected },
                    set: { _ in onToggleSelection() }
                )) {
                    Text(LocalizedStringKey("parent.approvals.toggle.bulk"))
                }
                .tint(palette.accent.color)
            }

            HStack {
                Button(String(localized: "parent.approvals.approve"), action: onApprove)
                    .buttonStyle(.borderedProminent)
                    .tint(palette.accent.color)
                Button(String(localized: "parent.approvals.redo"), action: onRedo)
                    .buttonStyle(.bordered)
            }
        }
        .padding(THSpacing.lg)
        .background(usesCardChrome ? palette.surface.color : palette.background.color)
        .clipShape(RoundedRectangle(cornerRadius: usesCardChrome ? THRadius.medium : THRadius.large, style: .continuous))
    }
}

private struct ParentBulkApprovalBar: View {
    let validation: BulkApprovalValidation
    let isBusy: Bool
    @Binding var acknowledgedBulkPhotoReview: Bool
    let selectionCount: Int
    let onApprove: () -> Void

    var body: some View {
        let palette = THPalettes.parent

        THCard(palette: palette, cornerRadius: THRadius.medium, shadowRadius: 3, shadowYOffset: 1) {
            Text(LocalizedStringKey("parent.bulk.title"))
                .font(.headline)
            Text(message)
                .foregroundStyle(palette.mutedText.color)

            if validation == .photoAcknowledgementRequired {
                Toggle(String(localized: "parent.bulk.photo.toggle"), isOn: $acknowledgedBulkPhotoReview)
                    .tint(palette.accent.color)
            }

            Button(String(format: String(localized: "parent.bulk.button"), selectionCount)) {
                onApprove()
            }
            .buttonStyle(.borderedProminent)
            .tint(palette.accent.color)
            .disabled(validation != .allowed || isBusy)
        }
        .opacity(selectionCount == 0 ? 0.75 : 1)
    }

    private var message: String {
        switch validation {
        case .allowed:
            return String(localized: "parent.bulk.allowed")
        case .empty:
            return String(localized: "parent.bulk.empty")
        case .mixedChildren:
            return String(localized: "parent.bulk.mixed")
        case .photoAcknowledgementRequired:
            return String(localized: "parent.bulk.photo.ack")
        }
    }
}

private struct ParentSettingsView: View {
    let snapshot: ParentDashboardSnapshot?
    let exportStatusMessage: String?
    let deletionStatusMessage: String?
    let onSoundToggle: (Bool) -> Void
    let onExport: () -> Void
    let onDelete: () -> Void

    var body: some View {
        let palette = THPalettes.parent

        ScrollView {
            VStack(alignment: .leading, spacing: THSpacing.lg) {
                THCard(palette: palette, cornerRadius: THRadius.medium, shadowRadius: 3, shadowYOffset: 1) {
                    Text(LocalizedStringKey("parent.settings.sound.title"))
                        .font(.headline)
                    Text(LocalizedStringKey("parent.settings.sound.detail"))
                        .foregroundStyle(palette.mutedText.color)

                    Toggle(String(localized: "parent.settings.sound.toggle"), isOn: Binding(
                        get: { snapshot?.settings.soundEnabled ?? true },
                        set: { onSoundToggle($0) }
                    ))
                    .tint(palette.accent.color)
                }

                THCard(palette: palette, cornerRadius: THRadius.medium, shadowRadius: 3, shadowYOffset: 1) {
                    Text(LocalizedStringKey("parent.settings.privacy.title"))
                        .font(.headline)
                    Text(LocalizedStringKey("parent.settings.privacy.detail"))
                        .foregroundStyle(palette.mutedText.color)

                    Button(String(localized: "parent.settings.export"), action: onExport)
                        .buttonStyle(.borderedProminent)
                        .tint(palette.accent.color)

                    Button(String(localized: "parent.settings.delete"), role: .destructive, action: onDelete)
                        .buttonStyle(.bordered)

                    if let exportStatusMessage {
                        Text(exportStatusMessage)
                            .font(.footnote)
                            .foregroundStyle(palette.mutedText.color)
                    }

                    if let deletionStatusMessage {
                        Text(deletionStatusMessage)
                            .font(.footnote)
                            .foregroundStyle(palette.mutedText.color)
                    }
                }
            }
            .padding(THSpacing.xl)
        }
    }
}

private struct ParentRedoSheet: View {
    let item: ApprovalQueueItem
    @Binding var note: String
    let onCancel: () -> Void
    let onSubmit: () -> Void

    var body: some View {
        let palette = THPalettes.parent

        VStack(alignment: .leading, spacing: THSpacing.lg) {
            Text(LocalizedStringKey("parent.redo.title"))
                .font(.title2.bold())
            Text(String(format: String(localized: "parent.redo.note.prompt"), item.childName.lowercased()))
                .foregroundStyle(palette.mutedText.color)

            TextField(String(localized: "parent.redo.note.placeholder"), text: $note, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .lineLimit(3...5)

            HStack {
                Button(String(localized: "parent.redo.cancel"), action: onCancel)
                    .buttonStyle(.bordered)
                Button(String(localized: "parent.redo.submit"), action: onSubmit)
                    .buttonStyle(.borderedProminent)
                    .tint(palette.accent.color)
                    .disabled(note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(THSpacing.xl)
    }
}

private struct ParentPhotoFullscreenView: View {
    let asset: ParentPhotoAsset
    let onClose: () -> Void

    var body: some View {
        let palette = THPalettes.parent

        NavigationStack {
            ZStack {
                palette.background.color.ignoresSafeArea()
                VStack(spacing: THSpacing.lg) {
                    if let previewURL = asset.previewURL {
                        AsyncImage(url: previewURL) { phase in
                            switch phase {
                            case .empty:
                                ProgressView()
                            case .success(let image):
                                image
                                    .resizable()
                                    .scaledToFit()
                                    .clipShape(RoundedRectangle(cornerRadius: THRadius.xlarge, style: .continuous))
                            case .failure:
                                fallbackImage
                            @unknown default:
                                fallbackImage
                            }
                        }
                    } else {
                        fallbackImage
                    }

                    THCard(palette: palette, cornerRadius: THRadius.medium, shadowRadius: 3, shadowYOffset: 1) {
                        Text(LocalizedStringKey("parent.photo.safe.title"))
                            .font(.headline)
                        Text(LocalizedStringKey("parent.photo.safe.detail"))
                            .foregroundStyle(palette.mutedText.color)
                    }
                }
                .padding(THSpacing.xl)
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(String(localized: "parent.photo.close"), action: onClose)
                }
            }
        }
    }

    private var fallbackImage: some View {
        RoundedRectangle(cornerRadius: THRadius.xlarge, style: .continuous)
            .fill(THPalettes.parent.accentSoft.color)
            .frame(maxHeight: 360)
            .overlay {
                VStack(spacing: THSpacing.sm) {
                    Image(systemName: "photo")
                        .font(.system(size: 44))
                        .foregroundStyle(THPalettes.parent.accent.color)
                    Text(asset.accessibilityLabel)
                        .foregroundStyle(THPalettes.parent.text.color)
                }
            }
    }
}
