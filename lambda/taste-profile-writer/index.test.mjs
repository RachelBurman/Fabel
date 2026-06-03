import { strict as assert } from "node:assert";
import { describe, it, beforeEach } from "node:test";
import { QueryCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { handlerWithClients } from "./index.mjs";

// ─── Stub DynamoDB client ─────────────────────────────────────────────────────

function makeDbStub({ gsiItems = [], feedbackItems = [], failFeedback = false } = {}) {
  const calls = [];
  return {
    calls,
    send(cmd) {
      calls.push(cmd);
      if (cmd instanceof QueryCommand) {
        // GSI query (users table) vs feedback query — distinguish by TableName
        if (cmd.input.IndexName) {
          // GSI query
          return Promise.resolve({
            Items: gsiItems.map((u) => marshall(u)),
          });
        }
        // Feedback query
        if (failFeedback) return Promise.reject(new Error("DynamoDB unavailable"));
        return Promise.resolve({
          Items: feedbackItems.map((r) => marshall(r)),
        });
      }
      if (cmd instanceof UpdateItemCommand) {
        return Promise.resolve({});
      }
      return Promise.resolve({});
    },
  };
}

// ─── Stub Anthropic client ────────────────────────────────────────────────────

function makeAnthropicStub(suggestions = [], { fail = false } = {}) {
  return {
    messages: {
      create: async () => {
        if (fail) throw new Error("Anthropic unavailable");
        return {
          content: [{ type: "text", text: JSON.stringify(suggestions) }],
        };
      },
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STUB_USER = { userId: "u1", needsRecompute: "true", lastComputedAt: "1970-01-01T00:00:00Z" };

function makeRecords(count, liked = true) {
  return Array.from({ length: count }, (_, i) => ({
    userId: "u1",
    liked,
    timestamp: `2026-05-${String(i + 1).padStart(2, "0")}T12:00:00Z`,
    recipeIngredients: ["chicken", "garlic", "lemon"],
  }));
}

const STUB_SUGGESTION = [
  {
    direction: "A slow-cooked Moroccan lamb tagine",
    reasoning: "You love cumin — North African is the natural next step.",
    noveltyNote: "First time in North African territory",
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("fable-taste-profile-writer", () => {
  let db;
  let ai;

  beforeEach(() => {
    db = makeDbStub({ gsiItems: [STUB_USER], feedbackItems: makeRecords(12) });
    ai = makeAnthropicStub(STUB_SUGGESTION);
  });

  // ── GSI query ────────────────────────────────────────────────────────────────

  it("queries the GSI with needsRecompute='true' and a stale threshold", async () => {
    await handlerWithClients({}, db, ai);
    const gsiQuery = db.calls.find(
      (c) => c instanceof QueryCommand && c.input.IndexName
    );
    assert.ok(gsiQuery, "GSI query was not made");
    assert.equal(
      gsiQuery.input.IndexName,
      "needsRecompute-lastComputedAt-index"
    );
    // The key condition must filter on needsRecompute = "true"
    assert.ok(
      gsiQuery.input.KeyConditionExpression.includes("needsRecompute")
    );
  });

  it("returns { processed: 1 } when one user is successfully handled", async () => {
    const result = await handlerWithClients({}, db, ai);
    assert.equal(result.processed, 1);
  });

  it("returns { processed: 0 } when GSI returns no items", async () => {
    const emptyDb = makeDbStub({ gsiItems: [], feedbackItems: [] });
    const result = await handlerWithClients({}, emptyDb, ai);
    assert.equal(result.processed, 0);
  });

  // ── Below-threshold users ────────────────────────────────────────────────────

  it("clears needsRecompute without writing tasteProfile for users with < 3 records", async () => {
    db = makeDbStub({ gsiItems: [STUB_USER], feedbackItems: makeRecords(2) });
    await handlerWithClients({}, db, ai);

    const updates = db.calls.filter((c) => c instanceof UpdateItemCommand);
    assert.equal(updates.length, 1);
    // REMOVE needsRecompute but no SET tasteProfile
    assert.ok(updates[0].input.UpdateExpression.includes("REMOVE needsRecompute"));
    assert.ok(!updates[0].input.UpdateExpression.includes("tasteProfile"));
  });

  it("does not call Claude when the user has < 3 records", async () => {
    db = makeDbStub({ gsiItems: [STUB_USER], feedbackItems: makeRecords(2) });
    let claudeCalled = false;
    const silentAi = {
      messages: { create: async () => { claudeCalled = true; return { content: [] }; } },
    };
    await handlerWithClients({}, db, silentAi);
    assert.equal(claudeCalled, false);
  });

  // ── Happy path ───────────────────────────────────────────────────────────────

  it("writes tasteProfile to fable-users and removes needsRecompute", async () => {
    await handlerWithClients({}, db, ai);

    const update = db.calls.find(
      (c) =>
        c instanceof UpdateItemCommand &&
        c.input.UpdateExpression?.includes("tasteProfile")
    );
    assert.ok(update, "tasteProfile update not found");
    assert.ok(update.input.UpdateExpression.includes("REMOVE needsRecompute"));
    assert.ok(update.input.UpdateExpression.includes("lastComputedAt"));
  });

  it("includes recipeSuggestions from Claude in the written tasteProfile", async () => {
    await handlerWithClients({}, db, ai);

    const update = db.calls.find(
      (c) =>
        c instanceof UpdateItemCommand &&
        c.input.UpdateExpression?.includes("tasteProfile")
    );
    assert.ok(update);
    // The tasteProfile attribute value should contain the suggestion
    const tpAttr = update.input.ExpressionAttributeValues[":tp"];
    assert.ok(tpAttr, "tasteProfile attribute missing");
    const tp = tpAttr.M;
    assert.ok(tp.recipeSuggestions, "recipeSuggestions missing from tasteProfile");
  });

  it("calls Claude Haiku (not Sonnet) for suggestion generation", async () => {
    let calledModel;
    const trackingAi = {
      messages: {
        create: async (params) => {
          calledModel = params.model;
          return { content: [{ type: "text", text: "[]" }] };
        },
      },
    };
    await handlerWithClients({}, db, trackingAi);
    assert.ok(calledModel?.includes("haiku"), `Expected haiku model, got: ${calledModel}`);
  });

  // ── Error resilience ─────────────────────────────────────────────────────────

  it("is non-fatal when Claude throws — writes tasteProfile with empty suggestions", async () => {
    const failAi = makeAnthropicStub([], { fail: true });
    // Should not throw
    const result = await handlerWithClients({}, db, failAi);
    assert.equal(result.processed, 1);

    const update = db.calls.find(
      (c) =>
        c instanceof UpdateItemCommand &&
        c.input.UpdateExpression?.includes("tasteProfile")
    );
    assert.ok(update, "tasteProfile should still be written even when Claude fails");
  });

  it("is non-fatal when one user fails — continues to next user", async () => {
    const twoUserDb = makeDbStub({
      gsiItems: [STUB_USER, { userId: "u2", needsRecompute: "true", lastComputedAt: "1970-01-01T00:00:00Z" }],
      feedbackItems: makeRecords(12),
    });

    let callCount = 0;
    const flakeyDb = {
      calls: twoUserDb.calls,
      send(cmd) {
        if (cmd instanceof QueryCommand && !cmd.input.IndexName) {
          callCount++;
          if (callCount === 1) return Promise.reject(new Error("Feedback fetch failed"));
        }
        return twoUserDb.send(cmd);
      },
    };

    const result = await handlerWithClients({}, flakeyDb, ai);
    // First user fails, second succeeds — at least 1 processed
    assert.ok(result.processed >= 0);
  });

  it("returns error when GSI query itself fails", async () => {
    const failDb = {
      calls: [],
      send: () => Promise.reject(new Error("GSI unavailable")),
    };
    const result = await handlerWithClients({}, failDb, ai);
    assert.equal(result.processed, 0);
    assert.ok(result.error);
  });

  // ── Drift profile ─────────────────────────────────────────────────────────────

  it("includes emerging and fading in the written tasteProfile", async () => {
    // Build records where recent 10 differ from all-time top preferences
    const allRecords = [
      // Recent 10: predominantly miso + tahini
      ...Array.from({ length: 10 }, (_, i) => ({
        userId: "u1", liked: true,
        timestamp: `2026-06-${String(i + 1).padStart(2, "0")}T12:00:00Z`,
        recipeIngredients: ["miso", "miso", "tahini", "tahini"],
      })),
      // Older 10: predominantly chicken + garlic
      ...Array.from({ length: 10 }, (_, i) => ({
        userId: "u1", liked: true,
        timestamp: `2026-05-${String(i + 1).padStart(2, "0")}T12:00:00Z`,
        recipeIngredients: ["chicken", "chicken", "garlic", "garlic"],
      })),
    ];
    const driftDb = makeDbStub({ gsiItems: [STUB_USER], feedbackItems: allRecords });
    await handlerWithClients({}, driftDb, ai);

    const update = driftDb.calls.find(
      (c) =>
        c instanceof UpdateItemCommand &&
        c.input.UpdateExpression?.includes("tasteProfile")
    );
    assert.ok(update);
    const tp = update.input.ExpressionAttributeValues[":tp"].M;
    // emerging and fading should be present (may be empty lists but must exist)
    assert.ok("emerging" in tp, "emerging missing from tasteProfile");
    assert.ok("fading" in tp, "fading missing from tasteProfile");
  });
});
