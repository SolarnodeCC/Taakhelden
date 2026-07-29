import XCTest
@testable import TaakHelden

final class Phase2ParentModeTests: XCTestCase {
    func testParentGateUnlockFlowTracksChallengeAndTimeout() {
        let coordinator = ParentGateCoordinator()

        coordinator.openGate(from: .heroWordmarkLongPress)
        XCTAssertTrue(coordinator.isChallengePresented)
        XCTAssertFalse(coordinator.isParentModePresented)

        let now = Date()
        coordinator.unlock(using: .localAuthentication, now: now)

        XCTAssertFalse(coordinator.isChallengePresented)
        XCTAssertTrue(coordinator.isParentModePresented)
        XCTAssertEqual(coordinator.lastUnlockMethod, .localAuthentication)
        XCTAssertFalse(coordinator.parentSessionRequiresReauth(now: now.addingTimeInterval(9 * 60)))
        XCTAssertTrue(coordinator.parentSessionRequiresReauth(now: now.addingTimeInterval(11 * 60)))
    }

    func testParentGateDoesNotOpenWithoutUnlock() {
        let coordinator = ParentGateCoordinator()

        coordinator.openGate(from: .buildNumberFiveTap)
        XCTAssertTrue(coordinator.isChallengePresented)
        XCTAssertFalse(coordinator.isParentModePresented)

        coordinator.closeGate()
        XCTAssertFalse(coordinator.isChallengePresented)
        XCTAssertFalse(coordinator.isParentModePresented)
    }

    func testParentGateCloseParentModeResetsAll() {
        let coordinator = ParentGateCoordinator()
        coordinator.openGate(from: .heroWordmarkLongPress)
        coordinator.unlock(using: .parentAccount)
        XCTAssertTrue(coordinator.isParentModePresented)

        coordinator.closeParentMode()
        XCTAssertFalse(coordinator.isParentModePresented)
        XCTAssertFalse(coordinator.isChallengePresented)
        XCTAssertNil(coordinator.activeEntryPoint)
    }

    func testPreviewLAClientSucceeds() async throws {
        let client = PreviewLocalAuthenticationClient()
        XCTAssertTrue(client.canEvaluateBiometrics())
        let success = try await client.evaluateBiometrics(reason: "test")
        XCTAssertTrue(success)
    }

    func testBulkApprovalRequiresSameChildAndPhotoAcknowledgement() {
        let first = ApprovalQueueItem(
            id: "one",
            childID: "child-sam",
            childName: "Sam",
            childAvatar: "🦊",
            title: "Kamer opruimen",
            icon: "🧹",
            submittedAt: .now,
            points: 12,
            photoAsset: ParentPhotoAsset(id: "photo", previewURL: nil, accessibilityLabel: "Foto")
        )
        let secondChild = ApprovalQueueItem(
            id: "two",
            childID: "child-noor",
            childName: "Noor",
            childAvatar: "🐼",
            title: "Huiswerk",
            icon: "📚",
            submittedAt: .now,
            points: 8,
            photoAsset: nil
        )

        XCTAssertEqual(
            ParentApprovalRules.validateBulkApproval(selectedItems: [first], acknowledgedPhotoReview: false),
            .photoAcknowledgementRequired
        )
        XCTAssertEqual(
            ParentApprovalRules.validateBulkApproval(selectedItems: [first, secondChild], acknowledgedPhotoReview: true),
            .mixedChildren
        )
        XCTAssertEqual(
            ParentApprovalRules.validateBulkApproval(selectedItems: [first], acknowledgedPhotoReview: true),
            .allowed
        )
    }

    func testPhotoViewerModelNeverExposesSensitiveMetadata() {
        let asset = ParentPhotoAsset(
            id: "photo-safe",
            previewURL: URL(string: "https://example.invalid/review.jpg"),
            accessibilityLabel: "Foto van de taak"
        )

        XCTAssertFalse(asset.showsSensitiveMetadata)
    }

    func testReconnectPolicyUsesApprovedBackoffSequence() {
        let policy = FamilyRoomReconnectPolicy.parentDefault

        XCTAssertEqual(policy.delay(forAttempt: 0), 2)
        XCTAssertEqual(policy.delay(forAttempt: 1), 4)
        XCTAssertEqual(policy.delay(forAttempt: 2), 8)
        XCTAssertEqual(policy.delay(forAttempt: 99), 8)
    }

    func testApproveSelectedItemsRemovesOnlyChosenChildItems() async {
        let apiClient = PreviewAPIClient()
        let store = ParentModeStore(apiClient: apiClient, familyRoomClient: PreviewFamilyRoomClient())

        await store.refresh(trigger: .appBecameActive)

        let snapshot = await MainActor.run { store.snapshot }
        guard let unwrappedSnapshot = try? XCTUnwrap(snapshot) else {
            XCTFail("Expected preview dashboard snapshot")
            return
        }

        await MainActor.run {
            let sameChildItems = Array(unwrappedSnapshot.approvalSections[0].items.prefix(2))
            sameChildItems.forEach { store.toggleSelection(for: $0) }
            store.acknowledgedBulkPhotoReview = true
        }

        await store.approveSelectedItems()

        await MainActor.run {
            XCTAssertEqual(store.selectedApprovalIDs.count, 0)
            XCTAssertEqual(store.snapshot?.pendingApprovalCount, 1)
            XCTAssertEqual(store.syncCoordinator.lastTrigger, .approvalResolved)
        }
    }
}
