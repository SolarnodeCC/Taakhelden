import Foundation
import UIKit
import UserNotifications

extension Notification.Name {
    static let apnsTokenUpdated = Notification.Name("taakhelden.apnsTokenUpdated")
    static let pushDeepLinkReceived = Notification.Name("taakhelden.pushDeepLinkReceived")
    static let silentPushReceived = Notification.Name("taakhelden.silentPushReceived")
}

final class APNSTokenStore: PushTokenProviding {
    static let shared = APNSTokenStore()

    var apnsToken: String?

    private init() {}
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        APNSTokenStore.shared.apnsToken = token
        NotificationCenter.default.post(name: .apnsTokenUpdated, object: token)
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        // Push is optional — the app must keep working without APNs.
    }

    func application(
        _ application: UIApplication,
        didReceiveRemoteNotification userInfo: [AnyHashable: Any],
        fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        NotificationCenter.default.post(name: .silentPushReceived, object: userInfo)
        // Sync runs asynchronously via RootView; report new data optimistically.
        completionHandler(.newData)
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        NotificationCenter.default.post(
            name: .pushDeepLinkReceived,
            object: response.notification.request.content.userInfo
        )
    }
}
