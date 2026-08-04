-- PIN-lockout op een atomaire teller in D1.
--
-- De mislukte-pogingenteller stond in KV (`pinfail:<childId>`) en werd
-- read-then-write bijgewerkt. KV is eventually consistent, dus gelijktijdige
-- pogingen vanaf verschillende edge-locaties lazen allemaal dezelfde oude waarde
-- en de teller liep nauwelijks op — waardoor de lock in users.pin_locked_until
-- soms nooit werd gezet. Met een kolom kan het ophogen in één UPDATE, zodat
-- gelijktijdige pogingen elkaar niet meer overschrijven.
ALTER TABLE users ADD COLUMN pin_fail_count INTEGER NOT NULL DEFAULT 0;
