pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "wispel-android"

// `:core` is a plain Kotlin/JVM library: it holds every piece of app logic that does
// not need the Android framework (contract DTOs, API client, auth store, sync engine,
// realtime client, design tokens, parent rules). It builds and tests on any JDK, so CI
// and Linux dev boxes can run the proof lane without an Android SDK.
include(":core")

// `:app` needs the Android SDK. Including it unconditionally would make *every* Gradle
// invocation fail on a machine without the SDK, which would take `:core:test` down with
// it. Include it only when an SDK is actually resolvable.
val androidSdkAvailable: Boolean =
    file("local.properties")
        .takeIf { it.exists() }
        ?.let { propertiesFile ->
            java.util.Properties()
                .apply { propertiesFile.inputStream().use(::load) }
                .getProperty("sdk.dir")
                ?.let { dir -> file(dir).isDirectory }
        } == true ||
        sequenceOf("ANDROID_HOME", "ANDROID_SDK_ROOT")
            .mapNotNull(System::getenv)
            .any { file(it).isDirectory }

if (androidSdkAvailable) {
    include(":app")
} else {
    logger.lifecycle(
        "[wispel] Android SDK not found — skipping :app. " +
            "Set ANDROID_HOME or sdk.dir in local.properties to build the app module. " +
            "':core' still builds and tests."
    )
}
