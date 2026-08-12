# kotlinx.serialization keeps its serializers in companion objects and synthetic
# `$serializer` classes that R8 cannot see are reachable. Losing them turns every API
# response into a runtime crash in release builds only — exactly the failure that does not
# show up in debug testing.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**

-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Our own @Serializable contract models.
-keep,includedescriptorclasses class nl.taakhelden.core.**$$serializer { *; }
-keepclassmembers class nl.taakhelden.core.** {
    *** Companion;
}
-keepclasseswithmembers class nl.taakhelden.core.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# OkHttp ships optional Conscrypt/BouncyCastle integrations that are absent at runtime.
-dontwarn okhttp3.internal.platform.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
