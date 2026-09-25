import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { embedSecretMatches } from "../lib/embed-auth.ts";

describe("embedSecretMatches", () => {
  it("allows every request while no secret is configured", () => {
    assert.equal(embedSecretMatches(undefined, null), true);
    assert.equal(embedSecretMatches("", "anything"), true);
  });

  it("requires the exact secret once configured", () => {
    assert.equal(embedSecretMatches("s3cret", "s3cret"), true);
    assert.equal(embedSecretMatches("s3cret", null), false);
    assert.equal(embedSecretMatches("s3cret", ""), false);
    assert.equal(embedSecretMatches("s3cret", "s3cre"), false);
    assert.equal(embedSecretMatches("s3cret", "s3cret "), false);
  });
});
