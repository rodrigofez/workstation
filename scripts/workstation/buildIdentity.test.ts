import { describe, expect, it } from "vite-plus/test";

import { applyWorkstationBuildIdentity } from "./buildIdentity.ts";

const officialStagePackage = {
  name: "t3code",
  version: "0.1.1",
  build: {
    appId: "com.t3tools.t3code",
    productName: "T3 Code (Beta)",
    artifactName: "T3-Code-${version}-${arch}.${ext}",
    publish: [{ provider: "github", owner: "pingdotgg", repo: "t3code" }],
    mac: { target: ["dmg", "zip"], icon: "icon.icns" },
    dmg: { title: "T3 Code (Beta) 0.1.1 Installer" },
  },
};

describe("applyWorkstationBuildIdentity", () => {
  it("gives the bundle its own name and id", () => {
    const { build } = applyWorkstationBuildIdentity(officialStagePackage);

    expect(build.appId).toBe("com.rodrigofez.workstation");
    expect(build.productName).toBe("Workstation");
    expect(build.artifactName).toBe("Workstation-${version}-${arch}.${ext}");
  });

  it("drops every update feed so no app-update.yml is written", () => {
    const { build } = applyWorkstationBuildIdentity({
      ...officialStagePackage,
      build: { ...officialStagePackage.build, channel: "nightly" },
    });

    expect(build.publish).toBeNull();
    expect(build).not.toHaveProperty("channel");
  });

  it("marks the packaged app so the runtime knows it is Workstation", () => {
    const stagePackage = applyWorkstationBuildIdentity(officialStagePackage);

    expect(stagePackage.t3codeWorkstation).toBe(true);
    expect(stagePackage.version).toBe("0.1.1");
  });
});
