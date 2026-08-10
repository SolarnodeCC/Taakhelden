package nl.taakhelden.family

import nl.taakhelden.core.i18n.UserMessage
import nl.taakhelden.family.ui.stringRes
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class UserMessageMappingTest {

    @Test
    fun `every core message maps to a real string resource`() {
        // `stringRes` is exhaustive by construction (a `when` over the enum with no else),
        // so a new UserMessage fails compilation rather than silently rendering nothing.
        // This asserts the runtime half: no entry resolves to the "not found" id 0.
        UserMessage.entries.forEach { message ->
            assertNotEquals(
                "UserMessage.$message has no string resource",
                0,
                message.stringRes(),
            )
        }
    }

    @Test
    fun `distinct messages map to distinct resources`() {
        // Two different failures showing the same sentence means one of them is telling
        // the user something untrue about what went wrong.
        val byResource = UserMessage.entries.groupBy { it.stringRes() }
        val collisions = byResource.filterValues { it.size > 1 }
        assertEquals("Messages sharing one string resource: $collisions", 0, collisions.size)
    }
}
