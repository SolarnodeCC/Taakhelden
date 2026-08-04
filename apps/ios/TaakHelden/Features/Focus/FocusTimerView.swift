import SwiftUI

/// Duration presets a child can pick when starting a focus session.
private enum FocusDuration: Int, CaseIterable, Identifiable {
    case ten = 10
    case fifteen = 15
    case twenty = 20
    case twentyFive = 25

    var id: Int { rawValue }
    var seconds: TimeInterval { Double(rawValue) * 60 }

    var label: String {
        String(format: String(localized: "focus.duration.format"), rawValue)
    }
}

/// Full-screen focus timer sheet shown when a child starts a focus session.
///
/// Lifecycle:
///   - Parent calls `onComplete` with the linked `instanceID` when the child
///     wants to mark the task done (this forwards to the existing complete flow).
///   - `onDismiss` is called when the child closes without completing.
///
/// No points are awarded for elapsed time; this is pure UX scaffolding.
struct FocusTimerSheet: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let taskTitle: String
    let palette: THPalette
    let isYoung: Bool
    let timer: FocusTimerService
    let onComplete: () -> Void
    let onDismiss: () -> Void

    @State private var selectedDuration: FocusDuration = .twentyFive
    @State private var showCompleteOffer = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: THSpacing.xl) {
                    timerRing

                    taskTitleLabel

                    if timer.phase == .idle {
                        durationPicker
                        startButton
                    } else {
                        controlButtons
                    }

                    if showCompleteOffer {
                        completeOfferCard
                    }
                }
                .padding(THSpacing.xl)
            }
            .background(palette.background.color.ignoresSafeArea())
            .navigationTitle(String(localized: "focus.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(String(localized: "focus.close")) {
                        timer.stop()
                        onDismiss()
                    }
                }
            }
        }
        .onChange(of: timer.phase) { _, newPhase in
            if newPhase == .completed {
                showCompleteOffer = true
            }
        }
    }

    // MARK: - Subviews

    @ViewBuilder
    private var timerRing: some View {
        ZStack {
            Circle()
                .stroke(palette.accent.color.opacity(0.15), lineWidth: 10)

            Circle()
                .trim(from: 0, to: CGFloat(timer.phase == .idle ? 0 : timer.progress))
                .stroke(palette.accent.color, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(reduceMotion ? .none : .linear(duration: 0.5), value: timer.progress)

            VStack(spacing: THSpacing.xs) {
                if timer.phase == .idle {
                    Text(String(format: String(localized: "focus.duration.format"), selectedDuration.rawValue))
                        .font(.system(size: isYoung ? 44 : 36, weight: .bold, design: .rounded))
                        .foregroundStyle(palette.text.color)
                    Text(LocalizedStringKey("focus.ready"))
                        .font(.subheadline)
                        .foregroundStyle(palette.mutedText.color)
                } else if timer.phase == .completed {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 48))
                        .foregroundStyle(palette.accent.color)
                    Text(LocalizedStringKey("focus.done"))
                        .font(.headline)
                        .foregroundStyle(palette.text.color)
                } else {
                    Text(timer.formattedRemaining)
                        .font(.system(size: isYoung ? 52 : 44, weight: .bold, design: .rounded).monospacedDigit())
                        .foregroundStyle(palette.text.color)
                    Text(LocalizedStringKey(timer.phase == .paused ? "focus.paused" : "focus.running"))
                        .font(.subheadline)
                        .foregroundStyle(palette.mutedText.color)
                }
            }
        }
        .frame(width: 220, height: 220)
        .padding(.top, THSpacing.lg)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(timerAccessibilityLabel)
    }

    private var timerAccessibilityLabel: String {
        switch timer.phase {
        case .idle:
            return String(localized: "focus.a11y.idle")
        case .running:
            return String(format: String(localized: "focus.a11y.running"), timer.formattedRemaining)
        case .paused:
            return String(format: String(localized: "focus.a11y.paused"), timer.formattedRemaining)
        case .completed:
            return String(localized: "focus.a11y.done")
        }
    }

    @ViewBuilder
    private var taskTitleLabel: some View {
        THCard(palette: palette) {
            HStack(spacing: THSpacing.sm) {
                Image(systemName: "book.fill")
                    .foregroundStyle(palette.accent.color)
                    .accessibilityHidden(true)
                Text(taskTitle)
                    .font(isYoung ? .title3.bold() : .headline)
                    .foregroundStyle(palette.text.color)
                    .lineLimit(2)
                Spacer(minLength: 0)
            }
        }
    }

    @ViewBuilder
    private var durationPicker: some View {
        VStack(alignment: .leading, spacing: THSpacing.sm) {
            Text(LocalizedStringKey("focus.duration.pick"))
                .font(.subheadline)
                .foregroundStyle(palette.mutedText.color)

            HStack(spacing: THSpacing.sm) {
                ForEach(FocusDuration.allCases) { duration in
                    Button {
                        selectedDuration = duration
                    } label: {
                        Text(duration.label)
                            .font(.subheadline.bold())
                            .frame(minWidth: 56, minHeight: 44)
                            .padding(.horizontal, THSpacing.sm)
                    }
                    .buttonStyle(.bordered)
                    .tint(selectedDuration == duration ? palette.accent.color : nil)
                    .accessibilityAddTraits(selectedDuration == duration ? .isSelected : [])
                }
            }
        }
    }

    @ViewBuilder
    private var startButton: some View {
        Button {
            timer.start(duration: selectedDuration.seconds)
        } label: {
            Label(String(localized: "focus.start"), systemImage: "play.fill")
                .frame(maxWidth: .infinity)
                .frame(minHeight: isYoung ? YoungModeSupport.minTapTarget : 50)
        }
        .buttonStyle(.borderedProminent)
        .tint(palette.accent.color)
        .accessibilityLabel(Text("focus.start"))
    }

    @ViewBuilder
    private var controlButtons: some View {
        HStack(spacing: THSpacing.md) {
            if timer.phase == .running {
                Button {
                    timer.pause()
                } label: {
                    Label(String(localized: "focus.pause"), systemImage: "pause.fill")
                        .frame(maxWidth: .infinity, minHeight: isYoung ? YoungModeSupport.minTapTarget : 44)
                }
                .buttonStyle(.bordered)
            } else if timer.phase == .paused {
                Button {
                    timer.start()
                } label: {
                    Label(String(localized: "focus.resume"), systemImage: "play.fill")
                        .frame(maxWidth: .infinity, minHeight: isYoung ? YoungModeSupport.minTapTarget : 44)
                }
                .buttonStyle(.borderedProminent)
                .tint(palette.accent.color)
            }

            Button {
                timer.stop()
            } label: {
                Label(String(localized: "focus.stop"), systemImage: "stop.fill")
                    .frame(maxWidth: .infinity, minHeight: isYoung ? YoungModeSupport.minTapTarget : 44)
            }
            .buttonStyle(.bordered)
            .tint(.secondary)
        }
    }

    @ViewBuilder
    private var completeOfferCard: some View {
        THCard(palette: palette) {
            VStack(alignment: .leading, spacing: THSpacing.md) {
                Text(LocalizedStringKey("focus.complete.offer.title"))
                    .font(.headline)
                    .foregroundStyle(palette.text.color)
                Text(LocalizedStringKey("focus.complete.offer.detail"))
                    .foregroundStyle(palette.mutedText.color)
                HStack(spacing: THSpacing.sm) {
                    Button(String(localized: "focus.complete.offer.yes")) {
                        onComplete()
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(palette.accent.color)
                    .frame(minHeight: 44)

                    Button(String(localized: "focus.complete.offer.later")) {
                        showCompleteOffer = false
                    }
                    .buttonStyle(.bordered)
                    .frame(minHeight: 44)
                }
            }
        }
    }
}

/// Small inline affordance shown on task cards to launch the focus timer.
struct FocusStartButton: View {
    let palette: THPalette
    let isYoung: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(String(localized: "focus.button.inline"), systemImage: "timer")
                .font(isYoung ? .subheadline.bold() : .subheadline)
                .frame(minHeight: isYoung ? YoungModeSupport.minTapTarget : 36)
        }
        .buttonStyle(.bordered)
        .tint(palette.accent.color)
        .accessibilityLabel(Text("focus.button.inline.a11y"))
    }
}
