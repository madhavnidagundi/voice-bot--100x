"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUp,
  AudioLines,
  Check,
  ChevronRight,
  CircleHelp,
  Code2,
  ExternalLink,
  Fingerprint,
  Headphones,
  Keyboard,
  LoaderCircle,
  MessageCircle,
  Mic,
  Plus,
  ShieldCheck,
  Sparkles,
  Square,
  TrendingUp,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { STARTERS, type AnswerStyle } from "@/lib/contracts";
import { useInterview, type Phase } from "@/hooks/use-interview";
import type { publicProfile } from "@/lib/profile";

type Profile = typeof publicProfile;
const descriptions: Record<Phase, [string, string]> = {
  ready: [
    "A conversation starts with hello.",
    "Ask anything. Get to know the person behind the work.",
  ],
  listening: [
    "Your turn. I’m listening.",
    "Speak naturally. I’ll answer when you finish.",
  ],
  permission: [
    "Let's connect your microphone.",
    "Allow microphone access in your browser to continue.",
  ],
  recording: [
    "I'm listening.",
    "Ask your question, then tap the button to finish.",
  ],
  transcribing: [
    "Getting every word.",
    "Turning your question into text. You'll review it before sending.",
  ],
  thinking: ["A thoughtful question.", "Putting the answer into words…"],
  voicing: ["Finding my voice.", "The answer is ready. Preparing audio…"],
  speaking: [
    "Here's a little about me.",
    "Listen along, or read the full answer below.",
  ],
};

export function InterviewRoom({ profile }: { profile: Profile }) {
  const voice = useInterview(profile.name);
  const {
    phase,
    turns,
    draft,
    setDraft,
    muted,
    error,
    setError,
    followUps,
    seconds,
    level,
    reviewing,
    mode,
    setMode,
    sessionActive,
    busy,
    isAudio,
    record,
    finishRecording,
    stopSession,
    stopAudio,
    playAnswer,
    toggleVoice,
    download,
  } = voice;
  const [tab, setTab] = useState<"conversation" | "about">("conversation");
  const textarea = useRef<HTMLTextAreaElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const help = useRef<HTMLDialogElement>(null);
  function ask(question: string, style: AnswerStyle = "brief", intro = false) {
    setTab("conversation");
    return voice.ask(question, style, intro);
  }
  function reset() {
    voice.reset();
    setTab("conversation");
  }
  useEffect(() => {
    if (turns.length)
      bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns.length]);
  useEffect(() => {
    if (textarea.current) {
      textarea.current.style.height = "auto";
      textarea.current.style.height =
        Math.min(textarea.current.scrollHeight, 120) + "px";
    }
  }, [draft]);
  useEffect(() => {
    if (reviewing) textarea.current?.focus();
  }, [reviewing]);
  const state = descriptions[phase];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#question">
        Skip to question
      </a>
      <header className="topbar">
        <a className="brand" href="/" aria-label="Echo home">
          echo<span>↗</span>
        </a>
        <div className="topbar-caption">
          <span className="divider" />A little more human.
        </div>
        <div className="topbar-right">
          <span className="assessment-label">
            BUILT FOR <b>100x</b>
          </span>
          <button
            className="help-button"
            onClick={() => help.current?.showModal()}
          >
            <CircleHelp size={16} />
            <span>How it works</span>
          </button>
        </div>
      </header>
      <main className="workspace">
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              <span /> THE PERSONAL INTERVIEW
            </div>
            <h1>
              Meet the person
              <br className="mobile-break" /> behind the work<span>.</span>
            </h1>
            <p>Get to know Madhav. One question at a time.</p>
          </div>
        </div>
        {!profile.complete && (
          <div className="profile-notice">
            <Fingerprint size={15} />
            <span>
              Profile preview · Project answers are ready. Personal background
              is still being added.
            </span>
          </div>
        )}
        <div className="room-grid">
          <section className="conversation-panel" aria-label="Interview room">
            <div className="panel-toolbar">
              <div className="tabs" role="tablist" aria-label="Room view">
                <button
                  role="tab"
                  id="conversation-tab"
                  aria-controls="conversation-view"
                  aria-selected={tab === "conversation"}
                  onClick={() => setTab("conversation")}
                >
                  <MessageCircle size={15} />
                  Conversation
                </button>
                <button
                  role="tab"
                  id="about-tab"
                  aria-controls="about-view"
                  aria-selected={tab === "about"}
                  onClick={() => setTab("about")}
                >
                  <Fingerprint size={15} />
                  About this agent
                </button>
              </div>
              <div className="toolbar-actions">
                <button
                  className="icon-button"
                  aria-label={
                    muted ? "Turn spoken answers on" : "Turn spoken answers off"
                  }
                  aria-pressed={!muted}
                  onClick={toggleVoice}
                >
                  {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
                </button>
                <button
                  className="icon-button"
                  aria-label="Start a new conversation"
                  onClick={reset}
                >
                  <Plus size={19} />
                </button>
              </div>
            </div>
            {tab === "conversation" ? (
              <div
                role="tabpanel"
                id="conversation-view"
                aria-labelledby="conversation-tab"
              >
                <div className="conversation-options">
                  <div
                    className="mode-switch"
                    role="group"
                    aria-label="Voice conversation mode"
                  >
                    <button
                      aria-pressed={mode === "review"}
                      onClick={() => setMode("review")}
                    >
                      Review first
                    </button>
                    <button
                      aria-pressed={mode === "hands-free"}
                      onClick={() => setMode("hands-free")}
                    >
                      Hands-free
                    </button>
                  </div>
                  <span>
                    {sessionActive
                      ? "Microphone on · speak to interrupt"
                      : mode === "hands-free"
                        ? "Auto-send after a pause · headphones recommended"
                        : "Edit your transcript before sending"}
                  </span>
                </div>
                <div
                  className={`voice-stage state-${phase} ${turns.length ? "compact" : ""}`}
                >
                  <div className="stage-label">
                    <span className="tiny-dot" />
                    {phase === "recording"
                      ? `LISTENING · 0:${String(seconds).padStart(2, "0")} / 0:29`
                      : phase === "speaking"
                        ? "SPEAKING"
                        : phase === "listening"
                          ? "MICROPHONE ON · YOUR TURN"
                          : phase === "ready"
                            ? "HERE, WHEN YOU'RE READY"
                            : "ONE MOMENT"}
                  </div>
                  <div
                    className="orb-scene"
                    aria-hidden="true"
                    style={{ "--level": level } as React.CSSProperties}
                  >
                    <div className="orb-orbit orbit-one" />
                    <div className="orb-orbit orbit-two" />
                    <div className="orb-halo" />
                    <div className="orb">
                      <div className="orb-sheen" />
                      <div className="orb-ribbons" />
                    </div>
                    <div className="orb-shadow" />
                    <div className="orb-glyph">
                      <AudioLines size={22} strokeWidth={1.5} />
                    </div>
                  </div>
                  <h2 aria-live="polite">{state[0]}</h2>
                  <p className="stage-description">
                    {mode === "hands-free" && phase === "recording"
                      ? "Pause for a moment when you’re done. Your question will send automatically."
                      : mode === "hands-free" && phase === "transcribing"
                        ? "Turning your question into text and sending it automatically."
                        : sessionActive && phase === "speaking"
                          ? "Start speaking to interrupt me and ask your next question."
                          : state[1]}
                  </p>
                  <div className="voice-actions">
                    {phase === "recording" ? (
                      <button
                        className="primary-button recording-button"
                        onClick={() => void finishRecording()}
                      >
                        <Square size={15} fill="currentColor" />
                        Finish recording
                        <span
                          className="record-level"
                          style={{ opacity: 0.3 + level }}
                        />
                      </button>
                    ) : phase === "listening" ? (
                      <button className="primary-button" onClick={stopSession}>
                        <Square size={14} fill="currentColor" />
                        Stop hands-free
                      </button>
                    ) : isAudio ? (
                      <>
                        <button
                          className="primary-button"
                          onClick={() => {
                            stopAudio();
                          }}
                        >
                          <Square size={14} fill="currentColor" />
                          Stop audio
                        </button>
                        {!sessionActive && (
                          <button
                            className="interrupt-button"
                            onClick={() => void record()}
                          >
                            <Mic size={15} />
                            Interrupt & ask
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        className="primary-button"
                        disabled={busy}
                        onClick={() => void record()}
                      >
                        {busy ? (
                          <LoaderCircle className="spin" size={17} />
                        ) : (
                          <Mic size={17} />
                        )}
                        {phase === "permission"
                          ? "Connecting microphone"
                          : phase === "thinking"
                            ? "Thinking…"
                            : phase === "transcribing"
                              ? "Transcribing…"
                              : mode === "hands-free"
                                ? "Start hands-free"
                                : turns.length
                                  ? "Ask another question"
                                  : "Let's talk"}
                        {!busy && <ArrowRight size={17} />}
                      </button>
                    )}
                  </div>
                  {sessionActive && phase !== "listening" && (
                    <button className="session-stop" onClick={stopSession}>
                      End voice session
                    </button>
                  )}
                  {phase === "permission" && (
                    <button className="session-stop" onClick={stopSession}>
                      Cancel microphone
                    </button>
                  )}
                  {!turns.length && phase === "ready" && (
                    <button
                      className="intro-button"
                      onClick={() =>
                        void ask(
                          "Please give me your quick introduction.",
                          "brief",
                          true,
                        )
                      }
                    >
                      <Volume2 size={15} />
                      Hear my 1-minute introduction
                      <ArrowRight size={14} />
                    </button>
                  )}
                  <div className="stage-footnote">
                    {phase === "recording" ? (
                      "Recording stops automatically after 29 seconds"
                    ) : (
                      <>
                        <Headphones size={12} />
                        {muted
                          ? "Spoken answers off · text is always available"
                          : "Sound on for the full experience"}
                      </>
                    )}
                  </div>
                </div>
                {turns.length > 0 && (
                  <div
                    className="transcript"
                    role="log"
                    aria-label="Conversation transcript"
                    aria-live="polite"
                    aria-relevant="additions"
                  >
                    <div className="transcript-heading">
                      <span>THE CONVERSATION</span>
                      <span>
                        {Math.floor(turns.length / 2)}{" "}
                        {Math.floor(turns.length / 2) === 1
                          ? "answer"
                          : "answers"}
                      </span>
                    </div>
                    {turns.map((turn) => (
                      <div className={`turn turn-${turn.role}`} key={turn.id}>
                        <div className="turn-avatar">
                          {turn.role === "user" ? (
                            <Users size={14} />
                          ) : (
                            <AudioLines size={15} />
                          )}
                        </div>
                        <div className="turn-body">
                          <div className="turn-author">
                            {turn.role === "user" ? "You" : profile.name}
                            <span>
                              {turn.role === "assistant" && "AI VOICE"}
                            </span>
                          </div>
                          <p>{turn.content}</p>
                        </div>
                        {turn.role === "assistant" && (
                          <button
                            className="icon-button replay"
                            aria-label="Play this answer"
                            disabled={busy}
                            onClick={() => {
                              setError("");
                              void playAnswer(turn);
                            }}
                          >
                            <Volume2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    <div ref={bottom} />
                  </div>
                )}
                {turns.at(-1)?.role === "assistant" && (
                  <div
                    className="answer-depth"
                    role="group"
                    aria-label="Explore the last answer"
                  >
                    <span>A little more?</span>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void ask(
                          "Tell me more about your last answer.",
                          "detail",
                        )
                      }
                    >
                      Tell me more
                      <Plus size={13} />
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void ask(
                          "Can you give me a real example related to your last answer?",
                          "example",
                        )
                      }
                    >
                      Give me an example
                      <ArrowRight size={13} />
                    </button>
                  </div>
                )}
                {followUps.length > 0 && (
                  <div className="followups">
                    <span>GO A LITTLE DEEPER</span>
                    <div>
                      {followUps.map((question) => (
                        <button
                          key={question}
                          disabled={busy}
                          onClick={() => void ask(question)}
                        >
                          {question}
                          <ArrowUp size={13} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                role="tabpanel"
                id="about-view"
                aria-labelledby="about-tab"
                className="about-content"
              >
                <div className="about-icon">
                  <AudioLines size={28} />
                </div>
                <div className="eyebrow">A DIGITAL INTRODUCTION</div>
                <h2>
                  A real conversation.
                  <br />
                  An AI voice.
                </h2>
                <p>
                  This is an AI representation of the applicant, built for the
                  first stage of the 100x AI Agent Team interview.
                </p>
                <div className="about-feature">
                  <ShieldCheck size={20} />
                  <div>
                    <b>Grounded in a personal profile</b>
                    <p>
                      Answers use supplied facts. If a detail hasn't been
                      shared, the agent will say so.
                    </p>
                  </div>
                </div>
                <div className="about-feature">
                  <Mic size={20} />
                  <div>
                    <b>Your voice, your choice</b>
                    <p>
                      Use Review first to edit a transcript, or Hands-free to
                      send after a pause. In Hands-free, speak over an answer to
                      interrupt. Each question is limited to 29 seconds.
                    </p>
                  </div>
                </div>
                <div className="about-feature">
                  <Fingerprint size={20} />
                  <div>
                    <b>A session that stays yours</b>
                    <p>
                      Conversation history lives in this tab's memory. Audio is
                      processed by Gnani and questions by OpenRouter. Closing or
                      refreshing the tab clears the conversation here; providers
                      may retain data under their policies.
                    </p>
                  </div>
                </div>
                <button
                  className="text-button"
                  onClick={() => setTab("conversation")}
                >
                  Back to the conversation
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
            <div className="composer-area">
              {error && (
                <div className="error-notice" role="alert">
                  <span>{error}</span>
                  <button
                    className="icon-button"
                    aria-label="Dismiss message"
                    onClick={() => setError("")}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              {reviewing && (
                <div className="review-notice">
                  <Check size={14} />
                  Your question is ready. Edit it if needed, then send.
                </div>
              )}
              <form
                className="composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  void ask(draft);
                }}
              >
                <Keyboard size={18} className="composer-icon" />
                <textarea
                  id="question"
                  ref={textarea}
                  aria-label="Your question"
                  placeholder="More of a typer? Ask me anything…"
                  value={draft}
                  maxLength={2000}
                  rows={1}
                  disabled={busy}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      void ask(draft);
                    }
                  }}
                />
                <button
                  type="submit"
                  className="send-button"
                  aria-label="Send question"
                  disabled={busy || !draft.trim()}
                >
                  <ArrowUp size={19} />
                </button>
              </form>
              <div className="composer-footer">
                <span>
                  <ShieldCheck size={11} />
                  No sign-up. Just a conversation.
                </span>
                <span>
                  {draft.length > 1800
                    ? `${draft.length}/2000`
                    : "Enter to send"}
                </span>
              </div>
            </div>
          </section>
          <aside className="sidebar">
            <section className="profile-card">
              <div className="profile-top">
                <span className="small-label">ON THE OTHER SIDE</span>
                <span className="profile-decoration">✳</span>
              </div>
              <div className="avatar">
                {profile.initials}
                <span />
              </div>
              <h2>{profile.name}</h2>
              <p className="profile-role">{profile.role}</p>
              <p className="profile-headline">{profile.headline}</p>
              <div className="profile-tags">
                <span>
                  <Code2 size={12} />
                  AI & voice
                </span>
                <span>
                  <Sparkles size={12} />
                  Curious by default
                </span>
              </div>
              <div className="profile-divider" />
              <div className="personal-note">
                <span className="quote-mark">“</span>
                <p>{profile.intro}</p>
              </div>
              <span className="ai-disclosure">
                <span />
                AI representation · not a live call
              </span>
            </section>
            <section className="starters-card">
              <div className="sidebar-heading">
                <h2>A place to start</h2>
                <span>01—05</span>
              </div>
              <p>Good questions open good conversations.</p>
              <div className="starter-list">
                {STARTERS.map((starter, index) => {
                  const Icon = [
                    Fingerprint,
                    Sparkles,
                    TrendingUp,
                    Users,
                    ArrowUp,
                  ][index];
                  return (
                    <button
                      key={starter.label}
                      disabled={busy}
                      onClick={() => void ask(starter.question)}
                      title={starter.question}
                    >
                      <span className="starter-icon">
                        <Icon size={16} />
                      </span>
                      <span>{starter.label}</span>
                      <ChevronRight size={15} />
                    </button>
                  );
                })}
              </div>
              <button
                className="project-question"
                disabled={busy}
                onClick={() =>
                  void ask(
                    "Tell me about the Local Interviewer project you built.",
                  )
                }
              >
                <Code2 size={15} />
                <span>Or, ask about my projects</span>
                <ArrowRight size={14} />
              </button>
            </section>
            <button
              className="export-button"
              disabled={!turns.length || busy}
              onClick={download}
            >
              <ArrowDownToLine size={15} />
              Save conversation<span>.txt</span>
            </button>
          </aside>
        </div>
        <footer className="page-footer">
          <span>
            <AudioLines size={14} />
            Made to be heard. Built to be human.
          </span>
          <span>
            VOICE BY GNANI<span className="footer-dot">·</span>THOUGHT BY
            OPENROUTER
          </span>
        </footer>
      </main>
      <dialog
        ref={help}
        className="help-dialog"
        aria-labelledby="help-title"
        onClick={(event) => {
          if (event.target === help.current) help.current.close();
        }}
      >
        <button
          className="icon-button dialog-close"
          aria-label="Close help"
          onClick={() => help.current?.close()}
        >
          <X size={19} />
        </button>
        <div className="eyebrow">YOUR QUICK INTRODUCTION</div>
        <h2 id="help-title">Three ways to say hello.</h2>
        <div className="help-step">
          <span>01</span>
          <div>
            <b>Tap “Let's talk”</b>
            <p>
              In Review first, finish recording, edit the text, then send. In
              Hands-free, start the session and pause after each question. Speak
              to interrupt an answer. Use headphones for the best results.
            </p>
          </div>
        </div>
        <div className="help-step">
          <span>02</span>
          <div>
            <b>Type what's on your mind</b>
            <p>
              Use the question box. Press Enter to send, or Shift + Enter for a
              new line.
            </p>
          </div>
        </div>
        <div className="help-step">
          <span>03</span>
          <div>
            <b>Borrow a good question</b>
            <p>
              Choose a topic from “A place to start”. Then explore a suggested
              follow-up.
            </p>
          </div>
        </div>
        <p className="help-privacy">
          This is an AI representation, with a synthetic voice. Audio goes to
          Gnani; your questions and conversation context go to OpenRouter. No
          recording is saved by this app. Provider retention policies apply.{" "}
          <a
            href="https://openrouter.ai/privacy"
            target="_blank"
            rel="noreferrer"
          >
            OpenRouter privacy
            <ExternalLink size={11} />
          </a>{" "}
          <a
            href="https://www.gnani.ai/privacy-policy"
            target="_blank"
            rel="noreferrer"
          >
            Gnani privacy
            <ExternalLink size={11} />
          </a>
        </p>
        <button
          className="primary-button"
          onClick={() => help.current?.close()}
        >
          Let's get to know each other
          <ArrowRight size={16} />
        </button>
      </dialog>
    </div>
  );
}
