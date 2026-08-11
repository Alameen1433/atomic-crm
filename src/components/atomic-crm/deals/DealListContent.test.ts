import { getHorizontalAutoScrollSpeed } from "./dealAutoScroll";

describe("getHorizontalAutoScrollSpeed", () => {
  it("does not scroll while the pointer is away from the edges", () => {
    expect(getHorizontalAutoScrollSpeed(500, 0, 1000)).toBe(0);
  });

  it("scrolls left when the pointer approaches the left edge", () => {
    expect(getHorizontalAutoScrollSpeed(10, 0, 1000)).toBeLessThan(0);
  });

  it("scrolls right when the pointer approaches the right edge", () => {
    expect(getHorizontalAutoScrollSpeed(990, 0, 1000)).toBeGreaterThan(0);
  });

  it("caps the scroll speed when the pointer moves outside the pipeline", () => {
    expect(getHorizontalAutoScrollSpeed(-100, 0, 1000)).toBe(-20);
    expect(getHorizontalAutoScrollSpeed(1100, 0, 1000)).toBe(20);
  });
});
