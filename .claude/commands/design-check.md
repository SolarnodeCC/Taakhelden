---
description: Reviewt de huidige UI-wijzigingen tegen het TaakHelden design system.
---

Roep de `ui-design-reviewer` subagent aan om de huidige UI-wijzigingen te controleren.

Scope: `git diff main...HEAD` plus eventuele unstaged wijzigingen (`git diff`), beperkt tot
user-facing UI (`apps/web/app`, `apps/web/components`, `messages/`, `globals.css`,
`tailwind.config.ts`). Als ik hierna specifieke bestanden noem, beperk je daartoe: $ARGUMENTS

Rapporteer per punt ✅/⚠️/❌ met bestand + regelnummer en een fix-suggestie, en sluit af met
een go/no-go voor de PR.
