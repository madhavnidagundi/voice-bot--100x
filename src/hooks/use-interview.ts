"use client";
import { useEffect, useRef, useState } from "react";
import { VoiceRecorder } from "@/lib/recorder";
import { VoiceActivity } from "@/lib/voice-activity";
import { encodeWav } from "@/lib/audio";
import type { AnswerStyle, Turn } from "@/lib/contracts";

export type Phase =
  | "ready"
  | "permission"
  | "listening"
  | "recording"
  | "transcribing"
  | "thinking"
  | "voicing"
  | "speaking";
type Mode = "review" | "hands-free";
async function failure(response: Response) {
  const data = await response.json().catch(() => ({}));
  return new Error(
    data.error?.message || "The service couldn't respond. Please try again.",
  );
}
export function useInterview(name: string) {
  const [phase, updatePhase] = useState<Phase>("ready");
  const phaseRef = useRef<Phase>("ready");
  const setPhase = (value: Phase) => {
    phaseRef.current = value;
    updatePhase(value);
  };
  const [turns, updateTurns] = useState<Turn[]>([]);
  const turnsRef = useRef<Turn[]>([]);
  const setTurns = (value: Turn[]) => {
    turnsRef.current = value;
    updateTurns(value);
  };
  const [draft, setDraft] = useState("");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [mode, updateMode] = useState<Mode>("review");
  const modeRef = useRef<Mode>("review");
  const [sessionActive, setSessionActive] = useState(false);
  const session = useRef(false);
  const epoch = useRef(0);
  const lock = useRef(false);
  const voiceEnabled = useRef(true);
  const recorder = useRef<VoiceRecorder | null>(null);
  const detector = useRef(new VoiceActivity());
  const rate = useRef(48000);
  const request = useRef<AbortController | null>(null);
  const speechRequest = useRef<AbortController | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef<string | null>(null);
  const pending = useRef<{ turns: Turn[]; question: string } | null>(null);
  const resumeAfter = useRef(0);
  const finishRef = useRef<() => void>(() => {});
  const receiveRef = useRef<(bytes: ArrayBuffer, auto: boolean) => void>(
    () => {},
  );

  function stopPlayback() {
    speechRequest.current?.abort();
    speechRequest.current = null;
    if (player.current) {
      player.current.onended = null;
      player.current.onerror = null;
      player.current.pause();
      player.current.src = "";
      player.current = null;
    }
    if (audioUrl.current) {
      URL.revokeObjectURL(audioUrl.current);
      audioUrl.current = null;
    }
  }
  function releaseMic() {
    session.current = false;
    setSessionActive(false);
    void recorder.current?.cancel();
    recorder.current = null;
    detector.current.reset();
    setLevel(0);
  }
  function ready() {
    detector.current.reset();
    resumeAfter.current = Date.now() + 300;
    setPhase(session.current ? "listening" : "ready");
  }
  function stopSession() {
    epoch.current++;
    request.current?.abort();
    stopPlayback();
    releaseMic();
    lock.current = false;
    if (pending.current) {
      setTurns(pending.current.turns);
      setDraft(pending.current.question);
      pending.current = null;
    }
    setPhase("ready");
  }
  function stopAudio() {
    stopPlayback();
    ready();
  }
  useEffect(() => {
    const visibility = () => {
      if (document.hidden && recorder.current) {
        stopSession();
        setError(
          "Microphone stopped when you left the tab. Start again when you're ready.",
        );
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      epoch.current++;
      request.current?.abort();
      stopPlayback();
      void recorder.current?.cancel();
    };
    // Lifecycle cleanup uses refs so it also covers pending permission prompts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (phase !== "recording") return;
    const start = Date.now();
    setSeconds(0);
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      setSeconds(elapsed);
      if (!session.current && elapsed >= 29) finishRef.current();
    }, 200);
    return () => clearInterval(timer);
  }, [phase]);

  async function playAnswer(turn: Turn, currentEpoch = epoch.current) {
    if (lock.current || !turn.token) return;
    stopPlayback();
    detector.current.reset();
    setPhase("voicing");
    const controller = new AbortController();
    speechRequest.current = controller;
    try {
      const response = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: turn.content, token: turn.token }),
        signal: controller.signal,
      });
      if (!response.ok) throw await failure(response);
      const blob = await response.blob();
      if (epoch.current !== currentEpoch || controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      audioUrl.current = url;
      const audio = new Audio(url);
      player.current = audio;
      audio.onended = () => {
        if (player.current === audio) {
          stopPlayback();
          ready();
        }
      };
      audio.onerror = () => {
        if (player.current === audio) {
          stopPlayback();
          releaseMic();
          setPhase("ready");
          setError(
            "Audio couldn't play. Read the answer or tap its speaker button to retry.",
          );
        }
      };
      await audio.play();
      if (epoch.current !== currentEpoch || controller.signal.aborted) {
        audio.pause();
        return;
      }
      resumeAfter.current = Date.now() + 300;
      setPhase("speaking");
    } catch (err) {
      if (epoch.current !== currentEpoch || controller.signal.aborted) return;
      stopPlayback();
      releaseMic();
      setPhase("ready");
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Your browser paused audio. Tap the speaker beside the answer to listen."
          : err instanceof Error
            ? err.message
            : "Voice is unavailable. Read the answer below.",
      );
    }
  }
  async function ask(
    question: string,
    style: AnswerStyle = "brief",
    introduction = false,
  ) {
    if (lock.current || !question.trim()) return;
    lock.current = true;
    stopPlayback();
    detector.current.reset();
    setError("");
    setReviewing(false);
    setFollowUps([]);
    const currentEpoch = epoch.current;
    const previous = turnsRef.current;
    const user: Turn = {
      id: crypto.randomUUID(),
      role: "user",
      content: question.trim(),
    };
    pending.current = { turns: previous, question };
    setTurns([...previous, user]);
    setDraft("");
    setPhase("thinking");
    const controller = new AbortController();
    request.current = controller;
    try {
      const response = await fetch(
        introduction ? "/api/introduction" : "/api/chat",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify(
            introduction
              ? {}
              : {
                  messages: [...previous.slice(-16), user].map(
                    ({ role, content }) => ({ role, content }),
                  ),
                  style,
                },
          ),
        },
      );
      if (!response.ok) throw await failure(response);
      const data = await response.json();
      if (epoch.current !== currentEpoch || controller.signal.aborted) return;
      const answer: Turn = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer,
        token: data.speechToken,
      };
      setTurns([...previous, user, answer].slice(-60));
      pending.current = null;
      setFollowUps(data.followUps);
      lock.current = false;
      if (voiceEnabled.current || introduction)
        void playAnswer(answer, currentEpoch);
      else ready();
    } catch (err) {
      if (epoch.current === currentEpoch && !controller.signal.aborted) {
        pending.current = null;
        setTurns(previous);
        setDraft(question);
        releaseMic();
        setPhase("ready");
        setError(err instanceof Error ? err.message : "Please try again.");
      }
    } finally {
      if (epoch.current === currentEpoch) lock.current = false;
    }
  }
  async function receiveAudio(bytes: ArrayBuffer, automatic: boolean) {
    const currentEpoch = epoch.current;
    lock.current = true;
    setPhase("transcribing");
    setLevel(0);
    const controller = new AbortController();
    request.current = controller;
    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "audio/wav" },
        body: bytes,
        signal: controller.signal,
      });
      if (!response.ok) throw await failure(response);
      const data = await response.json();
      if (epoch.current !== currentEpoch || controller.signal.aborted) return;
      lock.current = false;
      if (automatic) {
        void ask(data.transcript);
      } else {
        setDraft(data.transcript);
        setReviewing(true);
        ready();
      }
    } catch (err) {
      if (epoch.current !== currentEpoch || controller.signal.aborted) return;
      lock.current = false;
      releaseMic();
      setPhase("ready");
      setError(
        err instanceof Error
          ? err.message
          : "Recording failed. Try typing a question.",
      );
    }
  }
  receiveRef.current = (bytes, auto) => {
    void receiveAudio(bytes, auto);
  };
  async function record() {
    if (lock.current || recorder.current) return;
    lock.current = true;
    stopPlayback();
    setError("");
    setReviewing(false);
    setPhase("permission");
    const automatic = modeRef.current === "hands-free";
    const currentEpoch = epoch.current;
    const capture = new VoiceRecorder();
    recorder.current = capture;
    detector.current.reset();
    try {
      const started = await capture.start(
        setLevel,
        automatic
          ? (chunk, sampleRate) => {
              rate.current = sampleRate;
              if (!session.current || Date.now() < resumeAfter.current) return;
              const state = phaseRef.current;
              if (!["listening", "recording", "speaking"].includes(state)) {
                detector.current.reset();
                return;
              }
              const event = detector.current.push(
                chunk,
                sampleRate,
                state === "speaking",
              );
              if (event.started) {
                stopPlayback();
                setPhase("recording");
              }
              if (event.samples)
                receiveRef.current(encodeWav(event.samples, sampleRate), true);
              if (event.idle) {
                releaseMic();
                setPhase("ready");
                setError(
                  "Hands-free paused after 25 seconds without speech. Start it again whenever you're ready.",
                );
              }
            }
          : undefined,
      );
      if (!started || epoch.current !== currentEpoch) return;
      if (automatic) {
        session.current = true;
        setSessionActive(true);
        lock.current = false;
        ready();
      } else setPhase("recording");
    } catch (err) {
      await capture.cancel();
      if (epoch.current !== currentEpoch) return;
      releaseMic();
      lock.current = false;
      setPhase("ready");
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone access is off. Enable it in your browser, or type your question below."
          : err instanceof DOMException && err.name === "NotFoundError"
            ? "No microphone found. You can type your question below."
            : err instanceof Error
              ? err.message
              : "The microphone couldn't start.",
      );
    }
  }
  async function finishRecording() {
    if (session.current) {
      const event = detector.current.finish();
      if (event.samples)
        receiveRef.current(encodeWav(event.samples, rate.current), true);
      return;
    }
    const capture = recorder.current;
    if (!capture) return;
    recorder.current = null;
    setPhase("transcribing");
    const currentEpoch = epoch.current;
    try {
      const bytes = await capture.stop();
      if (epoch.current === currentEpoch) void receiveAudio(bytes, false);
    } catch (err) {
      if (epoch.current === currentEpoch) {
        lock.current = false;
        setPhase("ready");
        setError(
          err instanceof Error ? err.message : "Please try recording again.",
        );
      }
    }
  }
  finishRef.current = () => {
    void finishRecording();
  };
  function setMode(value: Mode) {
    if (value === modeRef.current) return;
    stopSession();
    modeRef.current = value;
    updateMode(value);
    if (value === "hands-free") {
      voiceEnabled.current = true;
      setMuted(false);
    }
  }
  function reset() {
    stopSession();
    setTurns([]);
    setDraft("");
    setError("");
    setFollowUps([]);
    setReviewing(false);
  }
  function toggleVoice() {
    voiceEnabled.current = !voiceEnabled.current;
    setMuted(!voiceEnabled.current);
    if (
      !voiceEnabled.current &&
      ["speaking", "voicing"].includes(phaseRef.current)
    )
      stopAudio();
  }
  function download() {
    const text = [
      `ECHO · Personal interview`,
      `AI representation of ${name}`,
      `Exported ${new Date().toISOString()}`,
      "",
      ...turnsRef.current.map(
        (t) =>
          `${t.role === "user" ? "INTERVIEWER" : "CANDIDATE AI"}\n${t.content}\n`,
      ),
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "echo-conversation.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const busy = ["permission", "recording", "transcribing", "thinking"].includes(
    phase,
  );
  return {
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
    isAudio: phase === "speaking" || phase === "voicing",
    ask,
    record,
    finishRecording,
    stopSession,
    stopAudio,
    playAnswer,
    reset,
    toggleVoice,
    download,
  };
}
