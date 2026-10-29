# Verification record

Verified on **29 October 2026**, using the production Next.js build on Windows with Node.js 24.11.1 and installed Google Chrome. Tests and builds use the pinned dependency lockfile. Use a current Node.js 24 LTS release on Vercel.

| Check | Result |
| --- | --- |
| TypeScript | Passed |
| Unit and API integration tests | **66 passed** in 7 files |
| Browser integration tests | **26 passed**: 13 scenarios each on desktop and mobile Chromium |
| Production build | Passed; page and five API routes built successfully |
| Candidate profile validation | Passed |
| Production dependency audit | **0 reported vulnerabilities** |
| Source and browser-asset key scan | Passed; no provider keys found in 38 scanned files |
| Live provider checks | **14 passed**, including sample questions, internship follow-ups, missing-failure honesty, introduction speech, synthesis and transcription |

## Unit and API integration scope

The tests exercise PCM resampling, WAV structure and limits, conversation shape validation, untrusted role rejection, prompt grounding, origin handling, bounded input reads, rate limits, Redis failure behavior, signed speech tokens, provider request/response contracts, follow-up history, provider authentication/quota/server errors, malformed or truncated output, empty transcription, and network failure.

The provider-mocked round trip calls the actual route functions and adapters, with contract-faithful HTTP responses. It also validates native header serialization, which caught an invalid Unicode application-title header during live testing. A regression test covers the browser hostname versus Next.js internal hostname origin mismatch.

The earlier baseline unit coverage was 73.17% statements and 74.42% lines across its reported modules. That coverage measurement predates the conversation upgrades; it is not a current coverage claim. Browser microphone lifecycle code is exercised in the browser suite and is not instrumented by unit coverage.

## Browser scope

The original browser suite ran against production. The latest expanded 26-test suite ran against the development server, followed by a successful production build, clean production desktop/mobile render checks, and live production API tests on a separate local port. Both viewports passed the original scenarios:

1. Suggested question, follow-up history, transcript export, and conversation reset.
2. Typed input with preserved answers when speech fails.
3. Request failure restores the editable question for retry.
4. Microphone denial leaves typed input usable.
5. Help dialog, AI disclosure, and no horizontal page overflow.
6. Synthesized audio playback, stop, replay, and mute.
7. Reset during a pending answer prevents stale results from returning.
8. AudioWorklet recording produces valid WAV, transcript is reviewed and edited before sending.

The suite uses Chrome's synthetic microphone and deterministic API mocks. Mobile means a mobile-sized Chromium viewport, not actual iOS Safari. Desktop and mobile screenshots were inspected for layout. Screenshots are in `artifacts/room-chromium.png` and `artifacts/room-mobile.png`.

The expanded suite also covers clean CSP hydration, introduction without a model call, manual interruption, context-preserving detail/example actions, automatic send after silence, speech interruption during playback, and microphone release when ending a session or leaving the tab. Hands-free tests inject a controlled Web Audio microphone into the actual AudioWorklet pipeline. Unit tests cover noise/click rejection, onset retention, short pauses, playback thresholds, maximum utterance length, idle timeout, and capture reset. These checks cannot establish acoustic echo cancellation or speech-detection accuracy on every physical device.

## Live providers

The supplied Gnani and OpenRouter credentials worked against the real APIs. The latest production run passed all five assignment questions, unknown-salary handling, a brief internship answer, contextual detail and example follow-ups, honest handling of an unsupplied failure story, introduction synthesis, and a TTS → STT round trip. The speech input for this check was synthesized audio, not the operator's physical microphone. Evidence with timestamps, durations, word counts, output sizes, and pass/fail status is saved in `artifacts/live-check.json`; it contains no keys or audio.

The model responds using Madhav's supplied notes. Missing information handling was checked with a question about an undisclosed salary. That single check and the prompt constraints do not prove resistance to every prompt injection or hallucination.

## Deployment acceptance still required

No Vercel deployment has been created. After deploying, open the public HTTPS URL without being signed in to Vercel and verify one typed question and one physical microphone/speaker conversation. Safari and device-specific permission prompts require a check on the actual target device.

For shared production rate limits, configure the optional Redis variables. The built-in in-memory limiter is per process and is not a distributed spending guarantee. The configured Redis adapter has deterministic contract tests; a real Redis deployment was not available for this run.

## Reproduce

### Development CSP follow-up

The local development server previously emitted React's `eval()` debugging error because the production script policy also applied to development. The configuration now permits `unsafe-eval` only when `NODE_ENV` is `development`. Two additional policy regression tests passed, confirming that production still excludes it. Two additional browser checks passed on the running development server (desktop and mobile Chromium), verifying hydration without eval/CSP console errors. TypeScript also passed. These follow-up checks did not repeat the live provider calls.

```bash
npm ci
npm run verify
npm run profile:check
npm run security:check
npm run test:coverage
npm run test:e2e
npm audit --omit=dev
# With a separately running server and configured .env.local:
npm run test:live
```
