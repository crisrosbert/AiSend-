"use client";

import React from "react";

interface State { error: Error | null; info: string }

/* Wrap the dashboard so any render/runtime error shows ON SCREEN
 * with the real message + stack, instead of Next's generic
 * "This page couldn't load". Remove once the bug is found. */
export class DashboardErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null, info: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error, info: "" };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ error, info: info.componentStack ?? "" });
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 24, margin: 16, borderRadius: 12,
          background: "#fef2f2", border: "1px solid #fecaca",
          fontFamily: "monospace", fontSize: 13, color: "#7f1d1d",
          whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>
            🐛 Dashboard crashed — here is the real error:
          </div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            {this.state.error.name}: {this.state.error.message}
          </div>
          <div style={{ opacity: 0.8, fontSize: 12 }}>
            {this.state.error.stack}
          </div>
          {this.state.info && (
            <div style={{ marginTop: 12, opacity: 0.7, fontSize: 12 }}>
              Component stack:{this.state.info}
            </div>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
