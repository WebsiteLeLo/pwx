import React from "react";

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Unhandled application render error", error, info.componentStack);
  }

  private reload = () => {
    window.location.reload();
  };

  private goHome = () => {
    window.location.assign("/pw");
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main
        style={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#0a0a0f",
          color: "#f4f4fb",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <section
          role="alert"
          style={{
            width: "min(100%, 520px)",
            padding: "28px",
            border: "1px solid rgba(248,113,113,.35)",
            borderRadius: "16px",
            background: "rgba(24,24,32,.92)",
            textAlign: "center",
          }}
        >
          <h1 style={{ margin: "0 0 10px", fontSize: "1.35rem" }}>
            This page could not be loaded
          </h1>
          <p style={{ margin: "0 0 20px", color: "#a1a1b5", lineHeight: 1.5 }}>
            The batch service returned incomplete data. Please retry, or return
            to the batch list.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
            <button
              type="button"
              onClick={this.reload}
              style={{
                border: 0,
                borderRadius: "8px",
                padding: "10px 16px",
                background: "#7c3aed",
                color: "white",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.goHome}
              style={{
                border: "1px solid rgba(255,255,255,.18)",
                borderRadius: "8px",
                padding: "10px 16px",
                background: "transparent",
                color: "#ddd6fe",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Back to batches
            </button>
          </div>
        </section>
      </main>
    );
  }
}