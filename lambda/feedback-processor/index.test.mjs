import { strict as assert } from "node:assert";
import { describe, it, beforeEach } from "node:test";
import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { handlerWithClient } from "./index.mjs";

// ---------------------------------------------------------------------------
// Stub DynamoDB client — records every send() call
// ---------------------------------------------------------------------------

function makeStubClient() {
  const calls = [];
  return {
    calls,
    send(cmd) {
      calls.push(cmd);
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
    assert.equal(client.calls.length, 1);
    assert.ok(client.calls[0] instanceof UpdateItemCommand);
    const signals = client.calls[0].input.ExpressionAttributeValues[":signals"].L;
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
    assert.equal(client.calls.length, 1);
    const signals = client.calls[0].input.ExpressionAttributeValues[":signals"].L;
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
    assert.equal(client.calls.length, 1);
    const signals = client.calls[0].input.ExpressionAttributeValues[":signals"].L;
    assert.equal(signals.length, 3);
  });
});
