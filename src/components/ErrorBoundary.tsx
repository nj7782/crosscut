"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-start justify-center gap-4 px-6">
        <p className="text-[0.65rem] uppercase tracking-[0.28em] text-sky">
          CrossCut hiccup
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-extrabold text-paper">
          That round crashed.
        </h1>
        <p className="text-sm leading-relaxed text-dim">
          {this.state.error.message || "Something went wrong rendering the game."}
        </p>
        <button
          type="button"
          className="btn-solid rounded-2xl px-5 py-3 text-sm"
          onClick={() => {
            try {
              localStorage.removeItem("crosscut-session");
            } catch {
              /* ignore */
            }
            window.location.href = "/";
          }}
        >
          Clear session & reload
        </button>
      </main>
    );
  }
}
