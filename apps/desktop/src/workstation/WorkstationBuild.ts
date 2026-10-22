import type { DesktopAppBranding } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

// scripts/workstation/buildIdentity.ts stamps the marker and product name at build time.
const WORKSTATION_PRODUCT_NAME = "Workstation";
export const WORKSTATION_USER_DATA_DIRECTORY = "workstation";

const WorkstationPackageMetadata = Schema.Struct({
  t3codeWorkstation: Schema.optional(Schema.Boolean),
});
const decodeWorkstationPackageMetadata = Schema.decodeEffect(
  Schema.fromJsonString(WorkstationPackageMetadata),
);

/** The fork build stamps the packaged package.json; anything unreadable is an official build. */
export const readIsWorkstationBuild = Effect.fn("desktop.workstation.readIsWorkstationBuild")(
  function* (input: { readonly appPath: string; readonly isPackaged: boolean }) {
    if (!input.isPackaged) return false;
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    return yield* fs.readFileString(path.join(input.appPath, "package.json")).pipe(
      Effect.flatMap(decodeWorkstationPackageMetadata),
      Effect.map((metadata) => metadata.t3codeWorkstation === true),
      Effect.orElseSucceed(() => false),
    );
  },
);

export const toWorkstationBranding = (branding: DesktopAppBranding): DesktopAppBranding => ({
  ...branding,
  baseName: WORKSTATION_PRODUCT_NAME,
  displayName: WORKSTATION_PRODUCT_NAME,
});
