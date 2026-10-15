import { describe, expect, it } from "vitest";
import { hueFor } from "./ProjectIcon";

describe("hueFor", () => {
  it("is stable for a name and stays on the colour wheel", () => {
    expect(hueFor("adt-studio")).toBe(hueFor("adt-studio"));
    expect(hueFor("adt-studio")).toBeGreaterThanOrEqual(0);
    expect(hueFor("adt-studio")).toBeLessThan(360);
  });

  it("differs between projects", () => {
    expect(hueFor("adt-studio")).not.toBe(hueFor("vm-companion"));
  });
});
