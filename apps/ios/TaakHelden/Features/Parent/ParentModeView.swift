import SwiftUI

struct ParentModeRootView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var redoTarget: ApprovalQueueItem?
    @State private var redoNote = ""
    @State private var showsDeleteConfirmation = false
    @State private var showsAppleDeleteSheet = false

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
                    Text(LocalizedStringKey("parent.surface.taken")).tag(ParentSurface.taken)
                    Text(LocalizedStringKey("parent.surface.beloningen")).tag(ParentSurface.beloningen)
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
                            bulkFailureMessage: store.bulkFailureMessage,
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
                                Task { await store.openFullscreenPhoto(for: item) }
                            },
                            bulkValidation: store.bulkApprovalValidation()
                        )
                    case .taken:
                        ParentTasksManageView(store: store)
                    case .beloningen:
                        ParentRewardsManageView(store: store)
                    case .instellingen:
                        ParentSettingsView(
                            snapshot: store.snapshot,
                            exportStatusMessage: store.exportStatusMessage,
                            deletionStatusMessage: store.deletionStatusMessage,
                            needsParentAccount: store.needsParentAccount,
                            onSoundToggle: { isEnabled in
                                Task { await store.updateSoundPreference(isEnabled: isEnabled) }
                            },
                            onExport: {
                                Task { await store.requestExport() }
                            },
                            onDelete: {
                                showsDeleteConfirmation = true
                            },
                            onParentSignIn: { session in
                                appState.authStore.storeParentSession(session)
                                Task { await store.refresh(trigger: .manualRefresh) }
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
            if newPhase == .active {
                appState.enforceParentIdleTimeoutIfNeeded()
            }
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
                showsAppleDeleteSheet = true
            }
            Button(String(localized: "parent.settings.delete.confirm.cancel"), role: .cancel) {}
        } message: {
            Text(LocalizedStringKey("parent.settings.delete.confirm.message"))
        }
        .sheet(isPresented: $showsAppleDeleteSheet) {
            ParentDeleteConfirmSheet { token in
                Task {
                    let deleted = await store.requestDeleteAccount(appleIdentityToken: token)
                    if deleted {
                        appState.closeParentMode()
                        appState.returnToWelcome()
                    }
                }
            }
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
                    text: LocalizedStringKey(
                        String(
                            format: String(localized: "parent.mode.pending"),
                            store.snapshot?.pendingApprovalCount ?? 0
                        )
                    ),
                    palette: palette,
                    fontDesign: .default
                )
            }

            HStack(spacing: THSpacing.md) {
                ParentStatusPill(
                    title: String(localized: "parent.sync.live"),
                    detail: connectionLabel(for: store.connectionState),
                    palette: palette
                )
                ParentStatusPill(
                    title: String(localized: "parent.sync.sync"),
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
                                    Text(String(format: String(localized: "parent.today.balance"), child.balancePoints))
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
                                        Text(LocalizedStringKey(group.bucket.titleKey))
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
                                                        Text(LocalizedStringKey(item.statusLabelKey))
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
    let bulkFailureMessage: String?
    let onSelect: (ApprovalQueueItem) -> Void
    let onToggleSelection: (ApprovalQueueItem) -> Void
    let onApprove: (ApprovalQueueItem) -> Void
    let onRedo: (ApprovalQueueItem) -> Void
    let onBulkApprove: () -> Void
    let onOpenPhoto: (ApprovalQueueItem) -> Void
    let bulkValidation: BulkApprovalValidation

    var body: some View {
        let sections = (snapshot?.approvalSections ?? []).map { section in
            ApprovalQueueSection(
                id: section.id,
                childID: section.childID,
                childName: section.childName,
                childAvatar: section.childAvatar,
                items: section.items.sorted { $0.submittedAt < $1.submittedAt }
            )
        }
        let items = sections.flatMap(\.items)

        VStack(spacing: 0) {
            if let bulkFailureMessage {
                Text(bulkFailureMessage)
                    .font(.footnote)
                    .foregroundStyle(THPalettes.parent.mutedText.color)
                    .padding(.horizontal, THSpacing.xl)
                    .padding(.bottom, THSpacing.sm)
            }

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

            if item.photoProcessing {
                THBadge(text: LocalizedStringKey("parent.approvals.photo.processing"), palette: palette, fontDesign: .default)
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
                            if item.photoReady {
                                Text(LocalizedStringKey("parent.approvals.photo.ready"))
                                    .font(.footnote.weight(.semibold))
                                    .foregroundStyle(palette.accent.color)
                            }
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
    @Environment(AppState.self) private var appState
    let snapshot: ParentDashboardSnapshot?
    let exportStatusMessage: String?
    let deletionStatusMessage: String?
    let needsParentAccount: Bool
    let onSoundToggle: (Bool) -> Void
    let onExport: () -> Void
    let onDelete: () -> Void
    let onParentSignIn: (ParentSession) -> Void

    var body: some View {
        let palette = THPalettes.parent

        ScrollView {
            VStack(alignment: .leading, spacing: THSpacing.lg) {
                if needsParentAccount {
                    THCard(palette: palette, cornerRadius: THRadius.medium, shadowRadius: 3, shadowYOffset: 1) {
                        Text(LocalizedStringKey("parent.gate.account.title"))
                            .font(.headline)
                        Text(LocalizedStringKey("parent.gate.account.detail"))
                            .foregroundStyle(palette.mutedText.color)
                        SignInWithAppleButtonView { identityToken, familyName, displayName in
                            Task {
                                if let session = try? await appState.apiClient.signInWithApple(
                                    identityToken: identityToken,
                                    familyName: familyName,
                                    displayName: displayName
                                ) {
                                    onParentSignIn(session)
                                }
                            }
                        } onFailure: { _ in }
                    }
                }

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

private struct ParentTasksManageView: View {
    @Bindable var store: ParentModeStore

    var body: some View {
        let palette = THPalettes.parent
        ScrollView {
            VStack(alignment: .leading, spacing: THSpacing.lg) {
                THCard(palette: palette, cornerRadius: THRadius.medium, shadowRadius: 3, shadowYOffset: 1) {
                    Text(LocalizedStringKey("parent.tasks.create.title"))
                        .font(.headline)
                    TextField(String(localized: "parent.tasks.create.placeholder"), text: $store.draftTaskTitle)
                    Stepper(value: $store.draftTaskPoints, in: 1...100) {
                        Text(String(format: String(localized: "parent.tasks.create.points"), store.draftTaskPoints))
                    }
                    Button(String(localized: "parent.tasks.create.button")) {
                        let childIDs = store.snapshot?.todayChildren.map(\.id) ?? []
                        Task { await store.createTaskFromDraft(defaultChildIDs: childIDs) }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(palette.accent.color)
                }

                if let tasks = store.snapshot?.managedTasks, !tasks.isEmpty {
                    ForEach(tasks) { task in
                        THCard(palette: palette, cornerRadius: THRadius.medium, shadowRadius: 3, shadowYOffset: 1) {
                            HStack {
                                VStack(alignment: .leading, spacing: THSpacing.xs) {
                                    Text("\(task.icon ?? "⭐️") \(task.title)")
                                        .font(.headline)
                                    Text(String(format: String(localized: "parent.tasks.meta"), task.points, task.assigneeCount))
                                        .foregroundStyle(palette.mutedText.color)
                                }
                                Spacer()
                                Button(String(localized: "parent.tasks.archive"), role: .destructive) {
                                    Task { await store.archiveTask(id: task.id) }
                                }
                                .buttonStyle(.bordered)
                            }
                        }
                    }
                } else {
                    Text(LocalizedStringKey("parent.tasks.empty"))
                        .foregroundStyle(palette.mutedText.color)
                }
            }
            .padding(THSpacing.xl)
        }
    }
}

private struct ParentRewardsManageView: View {
    @Bindable var store: ParentModeStore

    var body: some View {
        let palette = THPalettes.parent
        ScrollView {
            VStack(alignment: .leading, spacing: THSpacing.lg) {
                THCard(palette: palette, cornerRadius: THRadius.medium, shadowRadius: 3, shadowYOffset: 1) {
                    Text(LocalizedStringKey("parent.rewards.create.title"))
                        .font(.headline)
                    TextField(String(localized: "parent.rewards.create.placeholder"), text: $store.draftRewardTitle)
                    Stepper(value: $store.draftRewardPrice, in: 1...500) {
                        Text(String(format: String(localized: "parent.rewards.create.price"), store.draftRewardPrice))
                    }
                    Button(String(localized: "parent.rewards.create.button")) {
                        Task { await store.createRewardFromDraft() }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(palette.accent.color)
                }

                if let rewards = store.snapshot?.managedRewards, !rewards.isEmpty {
                    ForEach(rewards) { reward in
                        THCard(palette: palette, cornerRadius: THRadius.medium, shadowRadius: 3, shadowYOffset: 1) {
                            HStack {
                                VStack(alignment: .leading, spacing: THSpacing.xs) {
                                    Text("\(reward.icon ?? "🎁") \(reward.title)")
                                        .font(.headline)
                                    Text(String(format: String(localized: "parent.rewards.meta"), reward.price))
                                        .foregroundStyle(palette.mutedText.color)
                                }
                                Spacer()
                                Button(String(localized: "parent.rewards.archive"), role: .destructive) {
                                    Task { await store.archiveReward(id: reward.id) }
                                }
                                .buttonStyle(.bordered)
                            }
                        }
                    }
                } else {
                    Text(LocalizedStringKey("parent.rewards.empty"))
                        .foregroundStyle(palette.mutedText.color)
                }
            }
            .padding(THSpacing.xl)
        }
    }
}

private struct ParentDeleteConfirmSheet: View {
    @Environment(\.dismiss) private var dismiss
    let onToken: (String) -> Void

    var body: some View {
        let palette = THPalettes.parent
        NavigationStack {
            VStack(alignment: .leading, spacing: THSpacing.lg) {
                Text(LocalizedStringKey("parent.settings.delete.siwa.title"))
                    .font(.title3.bold())
                Text(LocalizedStringKey("parent.settings.delete.siwa.detail"))
                    .foregroundStyle(palette.mutedText.color)
                SignInWithAppleButtonView { identityToken, _, _ in
                    onToken(identityToken)
                    dismiss()
                } onFailure: { _ in }
                Spacer()
            }
            .padding(THSpacing.xl)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(String(localized: "parent.gate.cancel")) { dismiss() }
                }
            }
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
    @State private var zoom: CGFloat = 1
    @State private var dragOffset: CGSize = .zero

    var body: some View {
        let palette = THPalettes.parent

        NavigationStack {
            ZStack {
                palette.background.color.ignoresSafeArea()
                VStack(spacing: THSpacing.lg) {
                    Group {
                        if let previewURL = asset.previewURL {
                            AsyncImage(url: previewURL) { phase in
                                switch phase {
                                case .empty:
                                    ProgressView()
                                case .success(let image):
                                    image
                                        .resizable()
                                        .scaledToFit()
                                        .scaleEffect(zoom)
                                        .offset(dragOffset)
                                        .gesture(
                                            MagnificationGesture()
                                                .onChanged { value in
                                                    zoom = max(1, min(value, 4))
                                                }
                                        )
                                        .simultaneousGesture(
                                            DragGesture()
                                                .onChanged { value in
                                                    dragOffset = value.translation
                                                    if value.translation.height > 140 {
                                                        onClose()
                                                    }
                                                }
                                                .onEnded { _ in
                                                    dragOffset = .zero
                                                }
                                        )
                                        .clipShape(RoundedRectangle(cornerRadius: THRadius.xlarge, style: .continuous))
                                        .accessibilityLabel(asset.accessibilityLabel)
                                case .failure:
                                    fallbackImage
                                @unknown default:
                                    fallbackImage
                                }
                            }
                        } else {
                            fallbackImage
                        }
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
