package nl.taakhelden.core.config

/**
 * Resolves the API base URL for release-safe builds.
 *
 * Order: explicit override (build config / environment) → production Workers URL. It
 * never falls back to localhost — on iOS that once shipped in a Review build and broke
 * it, so the safety net here is always the public API.
 */
public object AppConfiguration {
    public const val PRODUCTION_API_BASE_URL: String =
        "https://taakhelden-api.oostelaar.workers.dev/v1"

    public const val OVERRIDE_ENV_KEY: String = "TAAKHELDEN_API_BASE_URL"

    public fun apiBaseUrl(
        buildConfigValue: String? = null,
        environment: Map<String, String> = System.getenv(),
    ): String {
        buildConfigValue?.trim()?.let { candidate ->
            // An unexpanded Gradle placeholder must not win over the safety net.
            if (candidate.isNotEmpty() && !candidate.startsWith("\$")) return candidate
        }
        environment[OVERRIDE_ENV_KEY]?.trim()?.let { candidate ->
            if (candidate.isNotEmpty()) return candidate
        }
        return PRODUCTION_API_BASE_URL
    }
}
