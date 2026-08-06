import { describe, expect, it } from "vitest";
import {
  averageCostPerMessage,
  buildUsageSeries,
  categorizeLedgerEntry,
  estimateRunway,
  formatINR,
  formatLimit,
  isDebit,
  ledgerToCsv,
  meterPercent,
  percentChange,
  spendBetween,
  summarizeUsage,
  type LedgerEntry,
} from "./usage";

/** Build a ledger row at a local time on the given local day. */
function entry(partial: Partial<LedgerEntry> & { created_at: string }): LedgerEntry {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    type: partial.type ?? "deduction",
    amount: partial.amount ?? 1.09,
    balance_after: partial.balance_after ?? 100,
    description: partial.description ?? "WhatsApp marketing message",
    created_at: partial.created_at,
  };
}

describe("categorizeLedgerEntry", () => {
  it("reads the category out of the send routes' description format", () => {
    expect(categorizeLedgerEntry("WhatsApp marketing message to +919999")).toBe("marketing");
    expect(categorizeLedgerEntry("WhatsApp utility message")).toBe("utility");
    expect(categorizeLedgerEntry("WhatsApp authentication message")).toBe("authentication");
    expect(categorizeLedgerEntry("WhatsApp service message")).toBe("service");
  });

  it("matches authentication before any shorter keyword", () => {
    expect(categorizeLedgerEntry("auth OTP send")).toBe("authentication");
  });

  it("falls back to 'other' for rows with no category word", () => {
    expect(categorizeLedgerEntry("Journey bot reply")).toBe("other");
    expect(categorizeLedgerEntry(null)).toBe("other");
    expect(categorizeLedgerEntry(undefined)).toBe("other");
  });
});

describe("isDebit", () => {
  it("recognises spend rows regardless of casing", () => {
    expect(isDebit("deduction")).toBe(true);
    expect(isDebit("DEDUCTION")).toBe(true);
    expect(isDebit("usage")).toBe(true);
  });

  it("treats top-ups as credits", () => {
    expect(isDebit("recharge")).toBe(false);
    expect(isDebit("bonus")).toBe(false);
    expect(isDebit(null)).toBe(false);
  });
});

describe("buildUsageSeries", () => {
  it("keeps a zero bucket for days with no activity", () => {
    const series = buildUsageSeries([], ["2026-08-01", "2026-08-02"]);
    expect(series).toHaveLength(2);
    expect(series[0]).toMatchObject({ day: "2026-08-01", total: 0 });
    expect(series[1].spend.marketing).toBe(0);
  });

  it("buckets debits by local day and category", () => {
    const series = buildUsageSeries(
      [
        entry({ created_at: "2026-08-01T09:00:00", amount: 1.09 }),
        entry({ created_at: "2026-08-01T21:30:00", amount: 1.09 }),
        entry({
          created_at: "2026-08-02T10:00:00",
          amount: 0.145,
          description: "WhatsApp utility message",
        }),
      ],
      ["2026-08-01", "2026-08-02"],
    );

    expect(series[0].spend.marketing).toBeCloseTo(2.18, 5);
    expect(series[0].count.marketing).toBe(2);
    expect(series[1].spend.utility).toBeCloseTo(0.145, 5);
    expect(series[1].total).toBeCloseTo(0.145, 5);
  });

  it("normalises negatively-signed debits into positive spend", () => {
    const series = buildUsageSeries(
      [entry({ created_at: "2026-08-01T09:00:00", amount: -1.09 })],
      ["2026-08-01"],
    );
    expect(series[0].total).toBeCloseTo(1.09, 5);
  });

  it("ignores credits and rows outside the window", () => {
    const series = buildUsageSeries(
      [
        entry({ created_at: "2026-08-01T09:00:00", type: "recharge", amount: 5000 }),
        entry({ created_at: "2026-07-04T09:00:00", amount: 1.09 }),
      ],
      ["2026-08-01"],
    );
    expect(series[0].total).toBe(0);
  });
});

describe("summarizeUsage", () => {
  it("separates spend from top-ups", () => {
    const summary = summarizeUsage([
      entry({ created_at: "2026-08-01T09:00:00", amount: 1.09 }),
      entry({
        created_at: "2026-08-01T10:00:00",
        amount: 0.145,
        description: "WhatsApp utility message",
      }),
      entry({ created_at: "2026-08-01T11:00:00", type: "recharge", amount: 1000 }),
      entry({ created_at: "2026-08-01T11:01:00", type: "bonus", amount: 50 }),
    ]);

    expect(summary.totalSpend).toBeCloseTo(1.235, 5);
    expect(summary.totalCount).toBe(2);
    expect(summary.spend.marketing).toBeCloseTo(1.09, 5);
    expect(summary.count.utility).toBe(1);
    expect(summary.totalTopUp).toBe(1050);
  });

  it("returns zeroes for an empty ledger", () => {
    const summary = summarizeUsage([]);
    expect(summary.totalSpend).toBe(0);
    expect(summary.totalCount).toBe(0);
    expect(summary.totalTopUp).toBe(0);
  });
});

describe("spendBetween", () => {
  it("counts debits inside the half-open interval only", () => {
    const rows = [
      entry({ created_at: "2026-08-01T00:00:00", amount: 2 }),
      entry({ created_at: "2026-08-05T12:00:00", amount: 3 }),
      entry({ created_at: "2026-08-10T00:00:00", amount: 7 }),
    ];
    const total = spendBetween(rows, new Date("2026-08-01T00:00:00"), new Date("2026-08-10T00:00:00"));
    expect(total).toBe(5);
  });
});

describe("percentChange", () => {
  it("computes a rounded delta", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
  });

  it("returns null when there is no baseline", () => {
    expect(percentChange(120, 0)).toBeNull();
  });
});

describe("estimateRunway", () => {
  it("converts a balance into affordable messages per category", () => {
    const runway = estimateRunway(109);
    expect(runway.marketing).toBe(100);
    expect(runway.utility).toBe(751);
  });

  it("returns null for free categories instead of dividing by zero", () => {
    expect(estimateRunway(500).service).toBeNull();
  });

  it("never reports a negative runway", () => {
    expect(estimateRunway(-50).marketing).toBe(0);
  });
});

describe("averageCostPerMessage", () => {
  it("divides spend by billed message count", () => {
    expect(averageCostPerMessage(summarizeUsage([
      entry({ created_at: "2026-08-01T09:00:00", amount: 1 }),
      entry({ created_at: "2026-08-01T09:01:00", amount: 3 }),
    ]))).toBe(2);
  });

  it("is zero when nothing was sent", () => {
    expect(averageCostPerMessage(summarizeUsage([]))).toBe(0);
  });
});

describe("formatting helpers", () => {
  it("formats INR with Indian digit grouping", () => {
    expect(formatINR(100000)).toBe("₹1,00,000.00");
    expect(formatINR(1234.5, 2)).toBe("₹1,234.50");
  });

  it("renders -1 limits as unlimited", () => {
    expect(formatLimit(-1)).toBe("Unlimited");
    expect(formatLimit(5000)).toBe("5,000");
  });

  it("clamps meter fill between 0 and 100", () => {
    expect(meterPercent(50, 100)).toBe(50);
    expect(meterPercent(500, 100)).toBe(100);
    expect(meterPercent(10, -1)).toBe(0);
    expect(meterPercent(0, 0)).toBe(100);
  });
});

describe("ledgerToCsv", () => {
  it("writes a header plus one row per entry with signed amounts", () => {
    const csv = ledgerToCsv([
      entry({ created_at: "2026-08-01T09:00:00Z", amount: 1.09, balance_after: 98.91 }),
      entry({ created_at: "2026-08-01T10:00:00Z", type: "recharge", amount: 1000, balance_after: 1098.91 }),
    ]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('"Amount (INR)"');
    expect(lines[1]).toContain('"-1.090"');
    expect(lines[2]).toContain('"1000.000"');
  });

  it("escapes quotes inside descriptions", () => {
    const csv = ledgerToCsv([
      entry({ created_at: "2026-08-01T09:00:00Z", description: 'Template "Sale" sent' }),
    ]);
    expect(csv).toContain('"Template ""Sale"" sent"');
  });
});
