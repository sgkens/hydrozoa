import { describe, expect, it } from "vitest";
import {
  buildMirrorDescription,
  DEFAULT_MIRROR_DESCRIPTION
} from "./mirror-description.js";

describe("buildMirrorDescription", () => {
  it("appends the default template to the source description", () => {
    expect(buildMirrorDescription(
      "Source project",
      "https://git.example/source/project",
      "source/project",
      "default",
      null
    )).toBe("Source project — Managed by Hydrozoa — mirrored from https://git.example/source/project");
    expect(DEFAULT_MIRROR_DESCRIPTION).toContain("{url}");
  });

  it("supports custom URL and repository placeholders", () => {
    expect(buildMirrorDescription(
      "Source project",
      "https://git.example/source/project",
      "source/project",
      "custom",
      "Replica of {repo} ({url})"
    )).toBe("Source project — Replica of source/project (https://git.example/source/project)");
  });

  it("can omit the mirror suffix", () => {
    expect(buildMirrorDescription("Source project", undefined, "source/project", "none", null))
      .toBe("Source project");
  });

  it("removes control characters, avoids duplicates, and enforces provider limits", () => {
    const first = buildMirrorDescription("Source\nproject", undefined, "source/project", "custom", "Mirror\t{repo}");
    expect(first).toBe("Source project — Mirror source/project");
    expect(buildMirrorDescription(first, undefined, "source/project", "custom", "Mirror {repo}"))
      .toBe(first);
    expect(buildMirrorDescription("x".repeat(300), undefined, "source/project", "none", null))
      .toHaveLength(255);
  });
});
