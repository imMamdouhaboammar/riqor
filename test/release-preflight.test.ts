import { describe, expect, test } from "bun:test";
import { classifyGitHub, classifyNpm, runReleasePreflight } from "../scripts/release-preflight";

describe("release preflight resource classification", () => {
  test("classifyGitHub handles available, owned, conflict, and unreachable", () => {
    expect(classifyGitHub({ exitCode: 1, stderr: "Could not resolve to a Repository" }, "imMamdouhaboammar")).toBe("available");
    expect(classifyGitHub({ exitCode: 0, owner: "imMamdouhaboammar" }, "imMamdouhaboammar")).toBe("owned");
    expect(classifyGitHub({ exitCode: 0, owner: "other-user" }, "imMamdouhaboammar")).toBe("conflict");
    expect(classifyGitHub({ exitCode: 1, stderr: "TLS handshake failed" }, "imMamdouhaboammar")).toBe("unreachable");
  });

  test("classifyNpm handles available, owned, conflict, and unreachable", () => {
    expect(classifyNpm({ status: 404 }, "imMamdouhaboammar")).toBe("available");
    expect(classifyNpm({ status: 200, maintainers: ["imMamdouhaboammar"] }, "imMamdouhaboammar")).toBe("owned");
    expect(classifyNpm({ status: 200, maintainers: ["another-user"] }, "imMamdouhaboammar")).toBe("conflict");
    expect(classifyNpm({ status: 500 }, "imMamdouhaboammar")).toBe("unreachable");
  });

  test("runReleasePreflight checks GitHub and npm credentials without exposing secrets", async () => {
    const report = await runReleasePreflight({ expectedOwner: "imMamdouhaboammar" });
    expect(report.resources).toBeObject();
    expect(report.resources.githubRepo).toBeString();
    expect(report.resources.homebrewTap).toBeString();
    expect(report.resources.npmPackage).toBeString();

    const json = JSON.stringify(report);
    expect(json).not.toMatch(/ghp_[a-zA-Z0-9]+/);
    expect(json).not.toMatch(/npm_[a-zA-Z0-9]+/);
  }, 15000);
});
