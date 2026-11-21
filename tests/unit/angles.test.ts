import { describe, expect, it } from "vitest";
import { Ema, angleFromVertical, jointAngle, meanVisibility, midpoint, pickSide } from "@/lib/pose/angles";
import { LM, type Landmark } from "@/lib/pose/landmarks";

const P = (x: number, y: number, visibility = 1): Landmark => ({ x, y, visibility });

describe("jointAngle", () => {
  it("returns 90° for a right angle", () => {
    expect(jointAngle(P(0, 0), P(0, 1), P(1, 1))).toBeCloseTo(90, 6);
  });
  it("returns 180° for collinear points", () => {
    expect(jointAngle(P(0, 0), P(0.5, 0.5), P(1, 1))).toBeCloseTo(180, 6);
  });
  it("returns 0° when both rays overlap", () => {
    expect(jointAngle(P(1, 0), P(0, 0), P(2, 0))).toBeCloseTo(0, 6);
  });
  it("returns 45° and 135° correctly", () => {
    expect(jointAngle(P(1, 0), P(0, 0), P(1, 1))).toBeCloseTo(45, 6);
    expect(jointAngle(P(1, 0), P(0, 0), P(-1, 1))).toBeCloseTo(135, 6);
  });
  it("is symmetric in its outer points", () => {
    const a = P(0.2, 0.7);
    const b = P(0.4, 0.5);
    const c = P(0.9, 0.55);
    expect(jointAngle(a, b, c)).toBeCloseTo(jointAngle(c, b, a), 9);
  });
  it("is invariant to translation and uniform scale", () => {
    const base = jointAngle(P(0.1, 0.2), P(0.3, 0.5), P(0.6, 0.4));
    const moved = jointAngle(P(1.1, 3.2), P(1.3, 3.5), P(1.6, 3.4));
    const scaled = jointAngle(P(0.2, 0.4), P(0.6, 1.0), P(1.2, 0.8));
    expect(moved).toBeCloseTo(base, 9);
    expect(scaled).toBeCloseTo(base, 9);
  });
  it("returns NaN for a degenerate segment", () => {
    expect(jointAngle(P(0, 0), P(0, 0), P(1, 1))).toBeNaN();
  });
  it("never leaves [0, 180] under floating-point noise", () => {
    for (let i = 0; i < 200; i++) {
      const a = jointAngle(P(Math.random(), Math.random()), P(Math.random(), Math.random()), P(Math.random(), Math.random()));
      if (!Number.isNaN(a)) {
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(180);
      }
    }
  });
});

describe("angleFromVertical", () => {
  it("is 0 for an upright segment (y grows downward)", () => {
    expect(angleFromVertical(P(0.5, 0.8), P(0.5, 0.3))).toBeCloseTo(0, 6);
  });
  it("is 90 for a horizontal segment either direction", () => {
    expect(angleFromVertical(P(0.2, 0.5), P(0.8, 0.5))).toBeCloseTo(90, 6);
    expect(angleFromVertical(P(0.8, 0.5), P(0.2, 0.5))).toBeCloseTo(90, 6);
  });
  it("is 45 for a diagonal lean", () => {
    expect(angleFromVertical(P(0, 1), P(1, 0))).toBeCloseTo(45, 6);
  });
  it("is 180 when pointing straight down", () => {
    expect(angleFromVertical(P(0.5, 0.2), P(0.5, 0.9))).toBeCloseTo(180, 6);
  });
  it("returns NaN for identical points", () => {
    expect(angleFromVertical(P(0.5, 0.5), P(0.5, 0.5))).toBeNaN();
  });
});

describe("helpers", () => {
  it("midpoint averages coordinates and takes min visibility", () => {
    const m = midpoint(P(0, 0, 0.9), P(1, 2, 0.4));
    expect(m.x).toBe(0.5);
    expect(m.y).toBe(1);
    expect(m.visibility).toBe(0.4);
  });

  it("meanVisibility treats missing landmarks as invisible and undefined as visible", () => {
    const lms: Landmark[] = [{ x: 0, y: 0 }, P(0, 0, 0.5)];
    expect(meanVisibility(lms, [0, 1])).toBeCloseTo(0.75);
    expect(meanVisibility(lms, [0, 5])).toBeCloseTo(0.5);
    expect(meanVisibility(lms, [])).toBe(0);
  });

  it("pickSide prefers the more visible side", () => {
    const lms = Array.from({ length: 33 }, () => P(0.5, 0.5, 0.2));
    lms[LM.RIGHT_HIP] = P(0.5, 0.5, 0.99);
    lms[LM.RIGHT_KNEE] = P(0.5, 0.5, 0.99);
    expect(pickSide(lms, ["hip", "knee"])).toBe("right");
    lms[LM.LEFT_HIP] = P(0.5, 0.5, 1);
    lms[LM.LEFT_KNEE] = P(0.5, 0.5, 1);
    expect(pickSide(lms, ["hip", "knee"])).toBe("left");
  });
});

describe("Ema", () => {
  it("starts at the first sample and converges", () => {
    const e = new Ema(0.5);
    expect(e.next(100)).toBe(100);
    expect(e.next(0)).toBe(50);
    expect(e.next(0)).toBe(25);
  });
  it("ignores NaN samples", () => {
    const e = new Ema(0.5);
    e.next(10);
    expect(e.next(Number.NaN)).toBe(10);
  });
  it("alpha 1 means no smoothing and reset clears state", () => {
    const e = new Ema(1);
    e.next(3);
    expect(e.next(7)).toBe(7);
    e.reset();
    expect(e.current).toBeNull();
  });
  it("rejects invalid alpha", () => {
    expect(() => new Ema(0)).toThrow(RangeError);
    expect(() => new Ema(1.5)).toThrow(RangeError);
  });
});
