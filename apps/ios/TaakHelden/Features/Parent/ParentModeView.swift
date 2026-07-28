import SwiftUI

struct ParentModeRootView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var redoTarget: ApprovalQueueItem?
    @State private var redoNote = ""
    @State private var showsDeleteConfirmation = false

    var body: some View {
        let palette = THPalettes.parent
        let store = appState.parentMode

        NavigationStack {
            VStack(spacing: 0) {
                header(palette: palette, store: store)

                Picker("Oudermodus", selection: $appState.parentMode.activeSurface) {
                    Text("Vandaag").tag(ParentSurface.vandaag)
                    Text("Goedkeuren").tag(ParentSurface.goedkeuren)
                    Text("Instellingen").tag(ParentSurface.instellingen)
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
                    Button("Terug naar kindmodus") {
                        appState.closeParentMode()
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button("Ververs") {
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
            "Weet je het zeker?",
            isPresented: $showsDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("Account verwijderen", role: .destructive) {
                Task {
                    let deleted = await appState.parentMode.requestDeleteAccount()
                    if deleted {
                        appState.closeParentMode()
                        appState.returnToWelcome()
                    }
                }
            }
            Button("Annuleren", role: .cancel) {}
        } message: {
            Text("Hiermee vraag je om je account en gezinsdata te verwijderen. Dit blijft bewust achter de ouderpoort.")
        }
    }

    private func header(palette: THPalette, store: ParentModeStore) -> some View {
        VStack(alignment: .leading, spacing: THSpacing.sm) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: THSpacing.xs) {
                    Text("Oudermodus")
                        .font(.system(size: 30, weight: .bold, design: .default))
                        .foregroundStyle(palette.text.color)
                    Text("Kijk per kind wat vandaag loopt, keur foto’s veilig goed en houd instellingen rustig in de hand.")
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
            return "Niet verbonden"
        case .connecting:
            return "Verbinden…"
        case .connected:
            return "Verbonden"
        case .waitingToReconnect(let seconds):
            return "Opnieuw in \(seconds)s"
        }
    }

    private func syncLabel(for state: ParentSyncState) -> String {
        switch state {
        case .idle:
            return "Nog niet gestart"
        case .syncing:
            return "Bezig"
        case .synced(_, let date):
            return "Bijgewerkt om \(date.formatted(date: .omitted, time: .shortened))"
        case .failed:
            return "Nogmaals proberen"
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
        .clipShape(RoundedRectangle(cornerRadius: THRadius.large, style: .continuous))
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
                        Text("Vandaag laden…")
                            .font(.headline)
                        Text("We halen per kind rustig de nieuwste stand op.")
                            .foregroundStyle(palette.mutedText.color)
                    }
                } else if let snapshot, snapshot.todayChildren.isEmpty {
                    THCard(palette: palette, cornerRadius: THRadius.medium, shadowRadius: 3, shadowYOffset: 1) {
                        Text("Nog geen kinderen zichtbaar")
                            .font(.headline)
                        Text("Zodra er een profiel gekoppeld is, zie je hier per kind de dag in drie rustige kolommen.")
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
                                Text("Vandaag is het rustig voor \(child.displayName.lowercased()).")
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
                                                    Text(item.icon)
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
                        Text("Niets te keuren — lekker rustig.")
                            .font(.headline)
                        Text("Nieuwe foto’s en goedkeuringen landen hier automatisch achter de ouderpoort.")
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
                        ContentUnavailableView("Kies een kaartje", systemImage: "checklist")
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
                        Text("\(item.icon) \(item.title)")
                            .foregroundStyle(THPalettes.parent.text.color)
                        Text(item.submittedAt.formatted(date: .abbreviated, time: .shortened))
                            .font(.footnote)
                            .foregroundStyle(THPalettes.parent.mutedText.color)
                    }
                }
                .buttonStyle(.plain)

                Spacer()

                if item.hasPhoto {
                    Button("Foto") {
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
                    Text("\(item.icon) \(item.title)")
                        .font(.system(size: 22, weight: .bold, design: .default))
                        .foregroundStyle(palette.text.color)
                    Text("Ingediend door \(item.childName)")
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
                            Text("Fullscreen bekijken zonder locatie- of cameragegevens te tonen.")
                                .font(.footnote)
                                .foregroundStyle(palette.mutedText.color)
                                .multilineTextAlignment(.center)
                        }
                        .padding()
                    }
                }
                .buttonStyle(.plain)
            } else {
                THBadge(text: "Zonder foto", palette: palette, fontDesign: .default)
            }

            if let onToggleSelection {
                Toggle(isOn: Binding(
                    get: { isSelected },
                    set: { _ in onToggleSelection() }
                )) {
                    Text("Kies mee voor bulk goedkeuren")
                }
                .tint(palette.accent.color)
            }

            HStack {
                Button("Goedkeuren", action: onApprove)
                    .buttonStyle(.borderedProminent)
                    .tint(palette.accent.color)
                Button("Nog even kijken", action: onRedo)
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
            Text("Bulk goedkeuren")
                .font(.headline)
            Text(message)
                .foregroundStyle(palette.mutedText.color)

            if validation == .photoAcknowledgementRequired {
                Toggle("Ik heb de geselecteerde foto’s bewust bekeken.", isOn: $acknowledgedBulkPhotoReview)
                    .tint(palette.accent.color)
            }

            Button("Keur \(selectionCount) kaartjes goed") {
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
            return "Je selectie hoort bij hetzelfde kind en kan veilig samen door."
        case .empty:
            return "Kies eerst een paar kaartjes van hetzelfde kind."
        case .mixedChildren:
            return "Bulk goedkeuren werkt alleen voor kaartjes van hetzelfde kind."
        case .photoAcknowledgementRequired:
            return "Voor geselecteerde foto’s vragen we eerst een bewuste bevestiging."
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
                    Text("Geluiden")
                        .font(.headline)
                    Text("Ouders kunnen het beloningsgeluid hier rustig aan- of uitzetten zonder dat die instelling in kindmodus zichtbaar is.")
                        .foregroundStyle(palette.mutedText.color)

                    Toggle("Geluiden aan", isOn: Binding(
                        get: { snapshot?.settings.soundEnabled ?? true },
                        set: { onSoundToggle($0) }
                    ))
                    .tint(palette.accent.color)
                }

                THCard(palette: palette, cornerRadius: THRadius.medium, shadowRadius: 3, shadowYOffset: 1) {
                    Text("Privacy en gegevens")
                        .font(.headline)
                    Text("Je kunt je gezinsdata opvragen of je account verwijderen. Dit blijft alleen bereikbaar achter de ouderpoort.")
                        .foregroundStyle(palette.mutedText.color)

                    Button("Vraag je data-export aan", action: onExport)
                        .buttonStyle(.borderedProminent)
                        .tint(palette.accent.color)

                    Button("Verwijder account en gezin", role: .destructive, action: onDelete)
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
            Text("Nog even kijken")
                .font(.title2.bold())
            Text("Stuur een korte, positieve notitie mee voor \(item.childName.lowercased()).")
                .foregroundStyle(palette.mutedText.color)

            TextField("Bijna! Kijk nog even naar de hoekjes, dan is hij klaar.", text: $note, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .lineLimit(3...5)

            HStack {
                Button("Annuleren", action: onCancel)
                    .buttonStyle(.bordered)
                Button("Verstuur notitie", action: onSubmit)
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
                        Text("Veilige fotoweergave")
                            .font(.headline)
                        Text("TaakHelden laat hier bewust geen EXIF-, locatie- of cameragegevens zien. Alleen de foto zelf telt mee voor de beoordeling.")
                            .foregroundStyle(palette.mutedText.color)
                    }
                }
                .padding(THSpacing.xl)
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Sluiten", action: onClose)
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
