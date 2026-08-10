package nl.taakhelden.core

import nl.taakhelden.core.api.ChildTodayViewDTO
import nl.taakhelden.core.api.InstanceViewDTO
import nl.taakhelden.core.api.SyncResponseDTO
import nl.taakhelden.core.api.apiJson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ContractDecoderTest {

    @Test
    fun `child today view decodes the viewer discriminator`() {
        val json = """
            {
              "viewer": "child",
              "date": "2026-07-28",
              "instances": [],
              "balance": {
                "childId": "ch_1",
                "balance": 12,
                "todayCompleted": 2,
                "todayTotal": 3,
                "weekProgress": 0.5,
                "streakDays": 4,
                "lifetimeEarned": 120
              }
            }
        """.trimIndent()

        val decoded = apiJson.decodeFromString(ChildTodayViewDTO.serializer(), json)
        assertEquals("child", decoded.viewer)
        assertEquals(12, decoded.balance.balance)
    }

    @Test
    fun `sync response decodes applied and rejected results`() {
        val json = """
            {
              "results": [
                { "key": "k1", "status": "applied", "newBalance": 20 },
                {
                  "key": "k2",
                  "status": "rejected",
                  "code": "INSUFFICIENT_POINTS",
                  "message": "Niet genoeg punten"
                }
              ],
              "changes": { "ledger": [], "instances": [] },
              "serverTime": "2026-07-28T10:00:00Z"
            }
        """.trimIndent()

        val decoded = apiJson.decodeFromString(SyncResponseDTO.serializer(), json)
        assertEquals(2, decoded.results.size)
        assertEquals("INSUFFICIENT_POINTS", decoded.results[1].code)
        assertEquals(20, decoded.results[0].newBalance)
        assertNull(decoded.results[0].code)
    }

    @Test
    fun `an unknown response field does not break decoding`() {
        // Forward compatibility: a Worker deploy that adds a field must not crash
        // installed Android clients, the way Swift's Codable tolerates extra keys.
        val json = """
            {
              "id": "i1",
              "taskId": "t1",
              "childId": "c1",
              "date": "2026-07-28",
              "status": "open",
              "title": "Kamer opruimen",
              "category": "household",
              "points": 10,
              "brandNewServerField": { "nested": true }
            }
        """.trimIndent()

        val decoded = apiJson.decodeFromString(InstanceViewDTO.serializer(), json)
        assertEquals("i1", decoded.id)
        assertEquals(10, decoded.points)
        // Optional fields absent from the payload fall back to their defaults.
        assertEquals(0, decoded.photoBonusPoints)
        assertNull(decoded.photoId)
    }
}
