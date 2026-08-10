package nl.taakhelden.core.designsystem

import nl.taakhelden.core.auth.ChildAgeBand
import java.time.Year

public object AvatarCatalog {
    private val emojiById: Map<String, String> = mapOf(
        "fox" to "🦊",
        "panda" to "🐼",
        "lion" to "🦁",
        "octopus" to "🐙",
        "unicorn" to "🦄",
        "tiger" to "🐯",
    )

    public val selectableIds: List<String> =
        listOf("fox", "panda", "lion", "octopus", "unicorn", "tiger")

    public val selectableEmojis: List<String> = selectableIds.map { emojiById.getValue(it) }

    public fun idForEmoji(emoji: String): String =
        emojiById.entries.firstOrNull { it.value == emoji }?.key ?: selectableIds[0]

    public fun emojiFor(avatarId: String?): String =
        avatarId?.let { emojiById[it] } ?: "🦊"

    public fun ageBandFrom(ageMode: String?): ChildAgeBand = when (ageMode) {
        "young" -> ChildAgeBand.YOUNG
        "teen" -> ChildAgeBand.TEEN
        else -> ChildAgeBand.MID
    }

    public fun ageBandFromBirthYear(
        birthYear: Int,
        currentYear: Int = Year.now().value,
    ): ChildAgeBand {
        val age = currentYear - birthYear
        return when {
            age <= 7 -> ChildAgeBand.YOUNG
            age >= 13 -> ChildAgeBand.TEEN
            else -> ChildAgeBand.MID
        }
    }
}
