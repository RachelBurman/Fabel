import { strict as assert } from "node:assert";
import { describe, it, beforeEach } from "node:test";
import { UpdateItemCommand, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { handlerWithClient } from "./index.mjs";

// ---------------------------------------------------------------------------
// Stub DynamoDB client — records every send() call
// ---------------------------------------------------------------------------

function makeStubClient({ getItemResult = null, failInsights = false } = {}) {
  const calls = [];
  return {
    calls,
    send(cmd) {
      calls.push(cmd);
      if (failInsights && (cmd instanceof GetItemCommand || cmd instanceof PutItemCommand)) {
        return Promise.reject(new Error("Simulated insights failure"));
      }
      if (cmd instanceof GetItemCommand) {
        return Promise.resolve(getItemResult ?? {});
      }
      return Promise.resolve({});
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRecord({ eventName = "INSERT", image = null } = {}) {
  return {
    eventName,
    eventID: "evt-" + Math.random(),
    dynamodb: image ? { NewImage: image } : {},
  };
}

const threeIngredientImage = {
  userId: { S: "u1" },
  liked: { BOOL: true },
  recipeIngredients: { L: [{ S: "garlic" }, { S: "lemon" }, { S: "thyme" }] },
};

const dislikedImage = {
  userId: { S: "u4" },
  liked: { BOOL: false },
  recipeIngredients: { L: [{ S: "cilantro" }] },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("fable-feedback-processor", () => {
  let client;

  beforeEach(() => {
    client = makeStubClient();
  });

  it("skips REMOVE events", async () => {
    await handlerWithClient(
      { Records: [makeRecord({ eventName: "REMOVE", image: threeIngredientImage })] },
      client
    );
    assert.equal(client.calls.length, 0);
  });

  it("skips records missing userId", async () => {
    const image = {
      liked: { BOOL: true },
      recipeIngredients: { L: [{ S: "garlic" }] },
    };
    await handlerWithClient({ Records: [makeRecord({ image })] }, client);
    assert.equal(client.calls.length, 0);
  });

  it("skips records missing recipeIngredients", async () => {
    const image = { userId: { S: "u2" }, liked: { BOOL: true } };
    await handlerWithClient({ Records: [makeRecord({ image })] }, client);
    assert.equal(client.calls.length, 0);
  });

  it("writes 3 positive signals for a liked recipe with 3 ingredients", async () => {
    await handlerWithClient({ Records: [makeRecord({ image: threeIngredientImage })] }, client);
    const updateCalls = client.calls.filter((c) => c instanceof UpdateItemCommand);
    assert.equal(updateCalls.length, 1);
    const signals = updateCalls[0].input.ExpressionAttributeValues[":signals"].L;
    assert.equal(signals.length, 3);
    for (const s of signals) {
      assert.equal(s.M.liked.BOOL, true);
    }
    const keys = signals.map((s) => s.M.ingredientKey.S).sort();
    assert.deepEqual(keys, ["garlic", "lemon", "thyme"]);
  });

  it("writes 3 negative signals for a disliked recipe with 3 ingredients", async () => {
    const image = {
      userId: { S: "u3" },
      liked: { BOOL: false },
      recipeIngredients: { L: [{ S: "cilantro" }, { S: "mint" }, { S: "basil" }] },
    };
    await handlerWithClient({ Records: [makeRecord({ image })] }, client);
    const updateCalls = client.calls.filter((c) => c instanceof UpdateItemCommand);
    assert.equal(updateCalls.length, 1);
    const signals = updateCalls[0].input.ExpressionAttributeValues[":signals"].L;
    assert.equal(signals.length, 3);
    for (const s of signals) {
      assert.equal(s.M.liked.BOOL, false);
    }
  });

  it("processes the good record when a batch contains one bad and one good record", async () => {
    const badRecord = makeRecord({
      image: { liked: { BOOL: true }, recipeIngredients: { L: [{ S: "x" }] } },
    });
    const goodRecord = makeRecord({ image: threeIngredientImage });

    await handlerWithClient({ Records: [badRecord, goodRecord] }, client);
    const updateCalls = client.calls.filter((c) => c instanceof UpdateItemCommand);
    assert.equal(updateCalls.length, 1);
    const signals = updateCalls[0].input.ExpressionAttributeValues[":signals"].L;
    assert.equal(signals.length, 3);
  });

  // ── Insights extension ──────────────────────────────────────────────────────

  it("writes to insights table for a liked recipe (GetItem + PutItem per time window)", async () => {
    await handlerWithClient({ Records: [makeRecord({ image: threeIngredientImage })] }, client);
    const getCalls = client.calls.filter((c) => c instanceof GetItemCommand);
    const putCalls = client.calls.filter((c) => c instanceof PutItemCommand);
    // Two time windows: current week + all-time
    assert.equal(getCalls.length, 2);
    assert.equal(putCalls.length, 2);
  });

  it("does NOT write to insights for a disliked recipe", async () => {
    await handlerWithClient({ Records: [makeRecord({ image: dislikedImage })] }, client);
    const getCalls = client.calls.filter((c) => c instanceof GetItemCommand);
    const putCalls = client.calls.filter((c) => c instanceof PutItemCommand);
    assert.equal(getCalls.length, 0);
    assert.equal(putCalls.length, 0);
  });

  it("uses allergenProfile from the feedback record when present", async () => {
    const image = {
      userId: { S: "u5" },
      liked: { BOOL: true },
      recipeIngredients: { L: [{ S: "rice noodles" }] },
      allergenProfile: { S: "gluten-free" },
    };
    await handlerWithClient({ Records: [makeRecord({ image })] }, client);
    const putCalls = client.calls.filter((c) => c instanceof PutItemCommand);
    assert.ok(putCalls.length > 0);
    const key = putCalls[0].input.Item.allergenProfile;
    assert.equal(key.S, "gluten-free");
  });

  it("falls back to 'global' allergenProfile when not present in record", async () => {
    await handlerWithClient({ Records: [makeRecord({ image: threeIngredientImage })] }, client);
    const putCalls = client.calls.filter((c) => c instanceof PutItemCommand);
    assert.ok(putCalls.length > 0);
    const key = putCalls[0].input.Item.allergenProfile;
    assert.equal(key.S, "global");
  });

  it("excludes Safe Foods Mode placeholders from trendingIngredients", async () => {
    const image = {
      userId: { S: "u6" },
      liked: { BOOL: true },
      recipeIngredients: {
        L: [{ S: "chicken breast" }, { S: "seasoning of choice" }, { S: "liquid of choice" }],
      },
    };
    await handlerWithClient({ Records: [makeRecord({ image })] }, client);
    const putCalls = client.calls.filter((c) => c instanceof PutItemCommand);
    assert.ok(putCalls.length > 0);
    // Unmarshal the trendingIngredients from the first PutItem call
    const written = putCalls[0].input.Item.trendingIngredients.L.map((e) => e.M.key.S);
    assert.ok(written.includes("chicken breast"), "real ingredient should be included");
    assert.ok(!written.includes("seasoning of choice"), "placeholder must be excluded");
    assert.ok(!written.includes("liquid of choice"), "placeholder must be excluded");
  });

  it("is non-fatal when insights write fails — preferenceSignals still written", async () => {
    const failClient = makeStubClient({ failInsights: true });
    // Should not throw even though GetItem/PutItem fail
    await handlerWithClient({ Records: [makeRecord({ image: threeIngredientImage })] }, failClient);
    const updateCalls = failClient.calls.filter((c) => c instanceof UpdateItemCommand);
    assert.equal(updateCalls.length, 1);
  });
});
