import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import * as NodePath from "@effect/platform-node/NodePath";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

import * as DesktopConfig from "../app/DesktopConfig.ts";
import * as DesktopEnvironment from "../app/DesktopEnvironment.ts";
import * as DesktopUserData from "../app/DesktopUserData.ts";
import { readIsWorkstationBuild } from "./WorkstationBuild.ts";

const makeAppPath = (packageJson: string | undefined) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const appPath = yield* fs.makeTempDirectoryScoped({ prefix: "workstation-app-" });
    if (packageJson !== undefined) {
      yield* fs.writeFileString(path.join(appPath, "package.json"), packageJson);
    }
    return appPath;
  });

describe("readIsWorkstationBuild", () => {
  it.effect("recognizes a packaged Workstation build", () =>
    Effect.gen(function* () {
      const appPath = yield* makeAppPath('{"name":"t3code","t3codeWorkstation":true}');

      assert.isTrue(yield* readIsWorkstationBuild({ appPath, isPackaged: true }));
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("treats official builds and unreadable metadata as official", () =>
    Effect.gen(function* () {
      const official = yield* makeAppPath('{"name":"t3code"}');
      const broken = yield* makeAppPath("not json");
      const missing = yield* makeAppPath(undefined);

      for (const appPath of [official, broken, missing]) {
        assert.isFalse(yield* readIsWorkstationBuild({ appPath, isPackaged: true }));
      }
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("ignores the marker in unpackaged runs", () =>
    Effect.gen(function* () {
      const appPath = yield* makeAppPath('{"t3codeWorkstation":true}');

      assert.isFalse(yield* readIsWorkstationBuild({ appPath, isPackaged: false }));
    }).pipe(Effect.provide(NodeServices.layer)),
  );
});

const makeEnvironment = (input: {
  readonly isWorkstation: boolean;
  readonly env?: Record<string, string | undefined>;
}) =>
  DesktopEnvironment.DesktopEnvironment.pipe(
    Effect.provide(
      DesktopEnvironment.layer({
        dirname:
          "/Applications/Workstation.app/Contents/Resources/app.asar/apps/desktop/dist-electron",
        homeDirectory: "/Users/alice",
        platform: "darwin",
        processArch: "arm64",
        appVersion: "0.1.1",
        appPath: "/Applications/Workstation.app/Contents/Resources/app.asar",
        isPackaged: true,
        resourcesPath: "/Applications/Workstation.app/Contents/Resources",
        runningUnderArm64Translation: false,
        isWorkstation: input.isWorkstation,
      }).pipe(
        Layer.provide(
          Layer.mergeAll(
            NodeServices.layer,
            NodePath.layerPosix,
            DesktopConfig.layerTest(input.env ?? {}),
          ),
        ),
      ),
    ),
  );

describe("Workstation desktop environment", () => {
  it.effect("names the app Workstation and keeps its own Electron profile", () =>
    Effect.gen(function* () {
      const environment = yield* makeEnvironment({ isWorkstation: true });

      assert.equal(environment.displayName, "Workstation");
      assert.equal(environment.branding.baseName, "Workstation");
      assert.equal(
        yield* DesktopUserData.resolveUserDataPath(environment),
        "/Users/alice/Library/Application Support/workstation",
      );
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("shares the official T3 home", () =>
    Effect.gen(function* () {
      const environment = yield* makeEnvironment({ isWorkstation: true });

      assert.equal(environment.baseDir, "/Users/alice/.t3");
      assert.equal(environment.stateDir, "/Users/alice/.t3/userdata");
    }),
  );

  it.effect("leaves official builds on the upstream identity", () =>
    Effect.gen(function* () {
      const environment = yield* makeEnvironment({ isWorkstation: false });

      assert.equal(environment.displayName, "T3 Code (Beta)");
      assert.equal(
        yield* DesktopUserData.resolveUserDataPath(environment),
        "/Users/alice/Library/Application Support/t3code-v2",
      );
    }).pipe(Effect.provide(NodeServices.layer)),
  );
});
