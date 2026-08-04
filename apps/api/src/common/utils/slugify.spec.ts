import { slugify } from "./slugify";

describe("slugify", () => {
  it("normalizes accents and spaces", () => {
    expect(slugify("GB Systems")).toBe("gb-systems");
    expect(slugify("Empresa São Paulo")).toBe("empresa-sao-paulo");
  });

  it("strips invalid characters", () => {
    expect(slugify("Foo!!! Bar@@@")).toBe("foo-bar");
  });
});
