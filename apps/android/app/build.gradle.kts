import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.kotlin.compose)
}

/**
 * Optional local override for the API base URL, mirroring the iOS scheme env var.
 * Put `TAAKHELDEN_API_BASE_URL=http://10.0.2.2:8787/v1` in `local.properties` to point a
 * debug build at a wrangler dev server (10.0.2.2 is the host loopback from an emulator).
 */
val localProperties = Properties().apply {
    rootProject.file("local.properties").takeIf { it.exists() }?.inputStream()?.use(::load)
}
val apiBaseUrlOverride: String =
    (localProperties.getProperty("TAAKHELDEN_API_BASE_URL") ?: "").trim()

/**
 * `google-services.json` is a per-project Firebase file that is not in this repository.
 * Applying the plugin unconditionally would break the build for everyone without it, so
 * we wire FCM up only when the file is actually present. Push is optional by design — the
 * app works fully without it (see `PushRegistrationService`).
 */
val firebaseConfigured: Boolean = file("google-services.json").exists()
if (firebaseConfigured) {
    apply(plugin = libs.plugins.google.services.get().pluginId)
}

android {
    namespace = "nl.taakhelden.family"
    compileSdk = 35

    defaultConfig {
        applicationId = "nl.taakhelden.family"
        // API 26 is the floor for java.time, which the core module uses throughout.
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // Empty means "use the production URL"; AppConfiguration treats blank as absent.
        buildConfigField("String", "API_BASE_URL_OVERRIDE", "\"$apiBaseUrlOverride\"")
        buildConfigField("boolean", "FIREBASE_CONFIGURED", firebaseConfigured.toString())

        resourceConfigurations += listOf("nl", "en")
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs += listOf(
            // ModalBottomSheet, SegmentedButton and combinedClickable are still marked
            // experimental but are the only Compose APIs for the sheets, segmented
            // pickers and long-press gestures this app is built from. Opting in once here
            // beats scattering @OptIn over every screen.
            "-opt-in=androidx.compose.material3.ExperimentalMaterial3Api",
            "-opt-in=androidx.compose.foundation.ExperimentalFoundationApi",
        )
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }

    sourceSets {
        getByName("main") {
            java.srcDirs("src/main/kotlin")
        }
        getByName("test") {
            java.srcDirs("src/test/kotlin")
        }
    }

    lint {
        warningsAsErrors = false
        abortOnError = true
        // A missing translation must fail the build: half-Dutch child copy is worse than
        // no feature at all.
        error += listOf("MissingTranslation")
    }
}

dependencies {
    implementation(project(":core"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)
    implementation(libs.kotlinx.coroutines.android)

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons.extended)
    debugImplementation(libs.compose.ui.tooling)

    implementation(libs.androidx.security.crypto)
    implementation(libs.androidx.biometric)
    implementation(libs.androidx.browser)
    implementation(libs.coil.compose)

    implementation(libs.glance.appwidget)
    implementation(libs.glance.material3)

    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    androidTestImplementation(libs.androidx.test.junit)
    androidTestImplementation(libs.androidx.espresso.core)
}
