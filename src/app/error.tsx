"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="error-page">
      <div className="brand">
        echo<span>↗</span>
      </div>
      <h1>Let's try that again.</h1>
      <p>The room couldn't load. Your microphone has not been activated.</p>
      <button className="primary-button" onClick={reset}>
        Reload the room
      </button>
    </main>
  );
}
