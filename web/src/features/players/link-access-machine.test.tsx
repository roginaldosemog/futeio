import { AccessError } from "@/lib/api-client";
import { writeFailure } from "@/lib/write-outcome";
import {
  initialLinkAccess,
  linkAccessTransition,
  type LinkAccessEvent,
  type LinkAccessState,
} from "./link-access-machine";

const url = "https://futeio.example.test/acesso/jogador#token=private-fixture";
const run = (events: LinkAccessEvent[], from: LinkAccessState = initialLinkAccess) =>
  events.reduce(linkAccessTransition, from);

describe("link access machine", () => {
  it("reaches the server only through an explicit confirmation", () => {
    expect(run([{ type: "confirm" }])).toBe(initialLinkAccess);
    expect(run([{ type: "choose", action: "rotate" }, { type: "cancel" }])).toEqual({
      status: "idle",
    });
    expect(run([{ type: "choose", action: "revoke" }, { type: "confirm" }])).toEqual({
      status: "submitting",
      action: "revoke",
    });
  });

  it("ignores every user event while a request is in flight", () => {
    const submitting = run([{ type: "choose", action: "rotate" }, { type: "confirm" }]);
    const events: LinkAccessEvent[] = [
      { type: "confirm" },
      { type: "cancel" },
      { type: "choose", action: "revoke" },
      { type: "hide" },
      { type: "copied" },
    ];
    for (const event of events) expect(linkAccessTransition(submitting, event)).toBe(submitting);
  });

  it("accepts an outcome only from the request that is in flight", () => {
    for (const state of [initialLinkAccess, run([{ type: "choose", action: "rotate" }])]) {
      expect(linkAccessTransition(state, { type: "rotated", url })).toBe(state);
      expect(linkAccessTransition(state, { type: "revoked" })).toBe(state);
      expect(linkAccessTransition(state, { type: "failed" })).toBe(state);
    }
  });

  it("holds the link only while it is displayed", () => {
    const rotated = run([
      { type: "choose", action: "rotate" },
      { type: "confirm" },
      { type: "rotated", url },
    ]);
    expect(rotated).toEqual({ status: "rotated", url, copy: "idle" });
    expect(linkAccessTransition(rotated, { type: "copied" })).toEqual({
      status: "rotated",
      url,
      copy: "copied",
    });
    expect(linkAccessTransition(rotated, { type: "copyUnavailable" })).toEqual({
      status: "rotated",
      url,
      copy: "unavailable",
    });
    expect(linkAccessTransition(rotated, { type: "hide" })).toEqual({ status: "idle" });
    expect(linkAccessTransition(rotated, { type: "choose", action: "revoke" })).toEqual({
      status: "confirming",
      action: "revoke",
    });
  });

  it("keeps a failed confirmation open for a retry until it is cancelled", () => {
    const failed = run([
      { type: "choose", action: "rotate" },
      { type: "confirm" },
      { type: "failed" },
    ]);
    expect(failed).toEqual({ status: "failed", action: "rotate" });
    expect(linkAccessTransition(failed, { type: "confirm" })).toEqual({
      status: "submitting",
      action: "rotate",
    });
    const dismissed = linkAccessTransition(failed, { type: "cancel" });
    expect(dismissed).toEqual({ status: "failed", action: null });
    expect(linkAccessTransition(dismissed, { type: "confirm" })).toBe(dismissed);
  });
});

describe("write failure", () => {
  it("lets a refused request be corrected and sent again", () => {
    for (const status of [400, 401, 403, 404, 409])
      expect(writeFailure(new AccessError(status))).toBe("rejected");
  });

  it("treats anything the server may have recorded as uncertain", () => {
    for (const status of [429, 500, 502, 503])
      expect(writeFailure(new AccessError(status))).toBe("uncertain");
    expect(writeFailure(new Error("offline"))).toBe("uncertain");
    expect(writeFailure(undefined)).toBe("uncertain");
  });
});
