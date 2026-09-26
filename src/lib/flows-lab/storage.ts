// src/lib/flows-lab/storage.ts
//
// Lab flows persist in localStorage while this section is BETA. The
// rest of the app talks to Supabase; putting Lab flows in the same
// tables would mean writing a schema, RLS policies and migrations for
// something we might delete. localStorage keeps the blast radius at
// zero and every field lands in the browser's devtools where a tester
// can inspect it.
//
// The trade-off — flows don't sync across devices — is fine for a
// testing playground. When Lab graduates, this file gets replaced by
// a Supabase adapter with the same signatures and nothing else has
// to move.

import type { FlowDefinition, FlowResponse } from "./types";

const STORAGE_KEY = "aisend.flows_lab.flows.v1";
const RESPONSES_KEY = "aisend.flows_lab.responses.v1";

function readAll<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeAll<T>(key: string, items: T[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(items));
}

// ── FLOWS ──────────────────────────────────────────────────────────

export function listFlows(userId: string): FlowDefinition[] {
  return readAll<FlowDefinition>(STORAGE_KEY)
    .filter((f) => f.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getFlow(id: string): FlowDefinition | null {
  return readAll<FlowDefinition>(STORAGE_KEY).find((f) => f.id === id) ?? null;
}

export function saveFlow(flow: FlowDefinition): void {
  const flows = readAll<FlowDefinition>(STORAGE_KEY);
  const idx = flows.findIndex((f) => f.id === flow.id);
  flow.updatedAt = new Date().toISOString();
  if (idx >= 0) flows[idx] = flow;
  else flows.push(flow);
  writeAll(STORAGE_KEY, flows);
}

export function deleteFlow(id: string): void {
  const flows = readAll<FlowDefinition>(STORAGE_KEY).filter((f) => f.id !== id);
  writeAll(STORAGE_KEY, flows);
  // Cascade — throw away captured test runs too.
  const responses = readAll<FlowResponse>(RESPONSES_KEY).filter((r) => r.flowId !== id);
  writeAll(RESPONSES_KEY, responses);
}

export function duplicateFlow(id: string): FlowDefinition | null {
  const original = getFlow(id);
  if (!original) return null;
  const now = new Date().toISOString();
  const copy: FlowDefinition = {
    ...original,
    id: crypto.randomUUID(),
    name: `${original.name} (copy)`,
    version: 1,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    metrics: { started: 0, completed: 0 },
  };
  saveFlow(copy);
  return copy;
}

// ── RESPONSES ──────────────────────────────────────────────────────

export function listResponses(flowId: string): FlowResponse[] {
  return readAll<FlowResponse>(RESPONSES_KEY)
    .filter((r) => r.flowId === flowId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function saveResponse(response: FlowResponse): void {
  const all = readAll<FlowResponse>(RESPONSES_KEY);
  const idx = all.findIndex((r) => r.id === response.id);
  if (idx >= 0) all[idx] = response;
  else all.push(response);
  writeAll(RESPONSES_KEY, all);

  // Update flow metrics inline so the list can show them without a
  // second read.
  const flow = getFlow(response.flowId);
  if (flow) {
    const started = readAll<FlowResponse>(RESPONSES_KEY).filter((r) => r.flowId === flow.id).length;
    const completed = readAll<FlowResponse>(RESPONSES_KEY).filter(
      (r) => r.flowId === flow.id && r.status === "completed",
    ).length;
    flow.metrics = { started, completed, lastTestedAt: new Date().toISOString() };
    saveFlow(flow);
  }
}

export function clearResponses(flowId: string): void {
  const all = readAll<FlowResponse>(RESPONSES_KEY).filter((r) => r.flowId !== flowId);
  writeAll(RESPONSES_KEY, all);
  const flow = getFlow(flowId);
  if (flow) {
    flow.metrics = { started: 0, completed: 0 };
    saveFlow(flow);
  }
}
