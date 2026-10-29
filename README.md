# Echo — Madhav's personal voice agent

A Vercel-ready web app for the **100x AI Agent Team take-home assessment**. Reviewers can ask Madhav interview questions by speaking, typing, or choosing a suggested question. The app answers in first person using Madhav's supplied background, then offers relevant follow-up questions.

The reviewer needs **only a browser**. No account, installation, or API key entry is required. The deployed owner configures the provider keys once.

## Run locally

Requires Node.js 22.22.2+ or a current Node.js 24 LTS release.

```powershell
cd "D:\gnani ai\hundredx-voice"
npm ci
# .env.local is already configured on this machine and ignored by Git.
# On another machine, copy .env.example to .env.local and set the two keys.
npm run dev
```

Open http://127.0.0.1:3000. Microphones work on localhost and HTTPS. The app supports English speech; typing works without microphone access.

## Deploy on Vercel

1. Put this folder's source into a GitHub repository. Exclude `.env.local`, `node_modules`, `.next`, and `artifacts`; `.gitignore` already covers these. If using the parent repository, select **`hundredx-voice` as Root Directory**.
2. In Vercel, choose **Add New → Project**, import that repository, and keep the **Next.js** framework preset. Use Node.js **24.x**. The default build command is `npm run build`.
3. In the project's environment variables, add **`GNANI_API_KEY`** and **`OPENROUTER_API_KEY`** for Production (and Preview if desired). The values are in your local ignored `.env.local`. Never add a `NEXT_PUBLIC_` prefix.
4. Deploy. Open the generated HTTPS URL, test a typed question, then test microphone recording and spoken playback. Submit this public Vercel URL to 100x. Disable Vercel Deployment Protection for the submission URL if it would require the reviewer to sign in.

The project does not require a separate Python server, FFmpeg, local models, a database, or a background worker. Deployment itself has **not** been performed by this project setup.

For an internet-facing deployment with sustained traffic, configure both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` using a Redis instance from the Vercel Marketplace. This gives shared, atomic limits across serverless instances. Without Redis, limits are per process and reset with cold starts; they are best-effort demo protection, not a global spending cap. Set provider spending caps and Vercel firewall rules appropriate to your expected traffic. Requests fail closed if a configured Redis service is unavailable.

## Features

- Responsive interview room with a voice orb, clear listening/thinking/speaking states, and reduced-motion support.
- Browser AudioWorklet capture → 16 kHz mono WAV → Gnani transcription. Recordings stop at 29 seconds.
- **Review first** mode preserves editable transcripts before submission. **Hands-free** mode detects a pause and automatically submits each question, then listens again after the answer.
- In Hands-free, starting to speak interrupts playback. **Interrupt & ask** provides a manual alternative during playback. Headphones help avoid speaker echo; automatic detection uses local audio energy and may be affected by room noise or device echo cancellation.
- A visible microphone indicator and **End voice session** control accompany automatic capture. Leaving the tab or 25 seconds of idle listening releases the microphone. Only completed utterances are uploaded; microphone audio is never continuously streamed to a server.
- **Hear my 1-minute introduction** gives an overall interview introduction covering studies, the Magna internship, Local Interviewer, work style, and learning goals. It uses a fixed, grounded script and Gnani speech without a language-model call, aiming for 40–60 seconds. Actual duration depends on the chosen voice.
- Answers start with roughly 25–55 words. **Tell me more** requests more detail; **Give me an example** asks for a supplied personal story while preserving conversation context.
- Grounded OpenRouter responses with conversational history and relevant follow-up suggestions.
- Gnani speech playback, replay, stop, and a mute control. Text answers remain usable if speech fails.
- Speech starts after the first sentence group is synthesized, while the next group is prepared during playback. Up to six groups preserve sentence order; interruptions cancel pending requests. Downloaded audio is cached only in the current tab (up to 24 MB) and cleared when starting a new conversation. This reduces startup delay for longer answers but can introduce pauses between groups if the provider is slow.
- Keyboard input, screen-reader status updates, clear microphone errors, transcript export, and cancellation of pending work when starting a new conversation.
- Conversations stay in the current tab's memory; refreshing or closing the tab clears that local history.

## Madhav's profile

Edit `src/data/candidate.json` to update personal facts, the five sample answers, introduction, stories, or speaking style. The current profile includes Madhav's KLE Tech background and Edge AI internship at Magna International. Three related examples from the same internship cover the cross-hardware middleware challenge, collaboration across teams of two, and learning unit/integration testing and documentation. They preserve the reported team outcome: meeting requirements within the given time. No failure incident, hardware assignment, specific implementation module, date, or metric has been invented. The Local Interviewer project is attributed as collaborative work. See `docs/personal-stories.md` for adding confirmed stories.

The answers use simple, everyday English. The agent is told to acknowledge missing facts instead of inventing employment, salaries, grades, project metrics, or coworker opinions. These are prompt constraints, not a formal guarantee against hallucinations; review the live answers before submitting.

```bash
npm run profile:check
```

Review the third growth area and coworker answer in particular: the third area is phrased as broadening practical skills through learning opportunities, and the coworker answer avoids asserting what other people actually believe.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `GNANI_API_KEY` | Required | Server-only speech provider key |
| `OPENROUTER_API_KEY` | Required | Server-only language model key; also signs audio authorization tokens |
| `OPENROUTER_MODEL` | `openai/gpt-4o-mini` | Model with JSON object output support |
| `GNANI_TTS_MODEL` | `timbre-v2.5` | Gnani synthesis model |
| `GNANI_TTS_VOICE` | `Shlok` | Conversational English voice; must match the chosen model's catalog |
| `UPSTASH_REDIS_REST_URL` | Empty | Optional shared rate-limit backend |
| `UPSTASH_REDIS_REST_TOKEN` | Empty | Required if Redis URL is set |

The voice is synthetic; it is not a clone of Madhav's own voice. There is no key entry or configuration interface for reviewers.

## Architecture

```text
Browser — Next.js App Router on Vercel
  │
  ├─ PCM AudioWorklet → WAV → POST /api/transcribe → Gnani Prisma
  ├─ reviewed question → POST /api/chat → OpenRouter → grounded JSON answer
  └─ answer + signed token → POST /api/speak → Gnani Timbre → WAV playback
```

`src/lib/server/` holds provider adapters, validation, rate limits, and speech authorization. `src/components/interview-room.tsx` renders the interface; `src/hooks/use-interview.ts` controls conversation and audio lifecycle. `src/lib/recorder.ts` and `public/pcm-recorder.js` capture microphone PCM. `src/lib/voice-activity.ts` detects utterance boundaries locally. `POST /api/introduction` returns the fixed introduction with a signed speech token.

Security measures include server-only keys, same-origin checks, strict input schemas, bounded body readers, WAV validation, provider timeouts, bounded context/output, and privacy-safe structured error logs. Text-to-speech accepts only an unmodified answer with a valid one-hour HMAC token, preventing it from becoming an arbitrary public speech proxy. Rate limits apply to both original requests and replays. These public APIs intentionally do not require a user login.

The server does not persist recordings or chat history. Gnani processes audio, and OpenRouter processes the profile and conversation context; their retention policies still apply. The app does not include analytics. Exporting a transcript saves a file on the reviewer's device.

## Tests

```bash
npm run typecheck
npm test                 # Unit and provider-mocked API integration tests
npm run test:coverage
npm run build            # Vercel-compatible production build
npm run test:e2e         # Chrome desktop + mobile viewport browser integration tests
npm run profile:check
npm audit --omit=dev
npm run security:check
```

Browser tests use installed Google Chrome. On CI, `npx playwright install --with-deps chrome` installs the test browser. They exercise real browser AudioWorklet capture with a synthetic microphone and deterministic API mocks. They do not establish physical microphone/speaker quality or actual iPhone/Safari behavior. Mobile tests run a mobile viewport in Chromium.

The included GitHub Actions workflow assumes this folder is the repository root. In a monorepo, move the workflow into the repository's top-level `.github/workflows/` and set its working directory and lockfile path to `hundredx-voice`.

For live provider verification, run the server in another terminal, then:

```bash
npm run test:live
```

This uses the configured keys and consumes a small amount of provider quota. It checks the five sample questions, unknown-background handling, internship answers and contextual detail/example follow-ups, missing-failure honesty, introduction speech, and a synthesis/transcription round trip. It writes metadata-only evidence to `artifacts/live-check.json`. It never saves keys or raw audio. See `docs/verification.md` for completed run results.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Microphone blocked | Allow microphone access for the HTTPS site, or use typed input. |
| No speech heard | Check microphone selection and speak for at least one second. |
| Browser pauses playback | Tap the speaker button beside an answer. |
| Service unavailable | Check server environment variables, provider scope/credits, and Vercel function logs. |
| Rate limit reached | Wait a minute, then retry. |
| Old audio token expired | Ask the question again for a fresh answer. |
| Different TTS voice fails | Use a voice from the selected model's catalog. |

`GET /api/health` reports whether keys are present, not whether provider credentials or credits have been validated. Live smoke tests verify those separately.

## References

- [Reference project supplied by Madhav](https://github.com/SparshSunilNaik/Local-Interviewer)
- [Gnani speech-to-text REST contract](https://docs.gnani.ai/api/STT/speech-to-text)
- [Gnani text-to-speech REST contract](https://docs.gnani.ai/api/TTS/tts-inference)
- [Gnani voice catalog](https://docs.gnani.ai/api/TTS/available-voices)
- [OpenRouter API reference](https://openrouter.ai/docs/api/reference/overview)
- [Next.js route handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
