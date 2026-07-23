---
description: Reviewt de huidige wijzigingen tegen de zes harde architectuurregels van TaakHelden.
---

Roep de `architecture-reviewer` subagent aan om de huidige wijzigingen te controleren.

Scope: `git diff main...HEAD` plus eventuele unstaged wijzigingen (`git diff`). Als ik
hierna specifieke bestanden noem, beperk je daartoe: $ARGUMENTS

Rapporteer per regel ✅/⚠️/❌ met bestand + regelnummer en een fix-suggestie, en sluit af
met een go/no-go voor de PR.
