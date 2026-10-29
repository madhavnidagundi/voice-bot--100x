# Add Madhav's real stories

Madhav supplied a real Edge AI internship experience at Magna International. The `stories` array in `src/data/candidate.json` now contains three views of that same experience: a cross-hardware middleware challenge, collaboration across hardware teams, and learning testing/documentation. These are not represented as three separate projects. No specific failure was supplied, so a request for a failure story must acknowledge that gap. Add further stories only after Madhav supplies and confirms the details.

For each story, capture: what was happening, what Madhav personally did, what happened as a result (including unfinished results), and what he learned. Good topics are `challenge`, `failure`, `teamwork`, and `learning`.

Each entry requires `id`, `topic`, `title`, `situation`, `action`, `outcome`, `lesson`, `source`, and `approved: true`. Text fields are ordinary strings. Use a source such as "Madhav's interview notes, 29 October 2026". Unapproved or incomplete entries are excluded from the model's evidence. Do not set approval until the content is confirmed by Madhav. No fabricated sample stories are shipped.

The "Give me an example" action asks the model for a relevant approved story. When none exists, it acknowledges the missing example and can refer to an existing project fact without inventing an incident or result.
