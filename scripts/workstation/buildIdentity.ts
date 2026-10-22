// apps/desktop/src/workstation/WorkstationBuild.ts reads the marker and product name at
// runtime and install-mac.sh uses the bundle id. Scripts cannot import app sources, so
// keep these copies in step.
const WORKSTATION_APP_ID = "com.rodrigofez.workstation";
const WORKSTATION_PRODUCT_NAME = "Workstation";
const WORKSTATION_PACKAGE_MARKER = "t3codeWorkstation";

export const WORKSTATION_MAC_ICON_PNG = "assets/workstation/workstation-macos-1024.png";

/**
 * Rebrands the staged electron-builder package as Workstation. A distinct
 * bundle id keeps the official app's Squirrel updater away from it, and a null
 * `publish` means electron-builder writes no app-update.yml, so the desktop
 * updater reports "no update feed" and never contacts official release feeds.
 */
export function applyWorkstationBuildIdentity<
  StagePackage extends { readonly build: Record<string, unknown> },
>(stagePackage: StagePackage) {
  const { channel: _channel, ...build } = stagePackage.build;
  const workstationBuild: Record<string, unknown> = {
    ...build,
    appId: WORKSTATION_APP_ID,
    productName: WORKSTATION_PRODUCT_NAME,
    artifactName: `${WORKSTATION_PRODUCT_NAME}-\${version}-\${arch}.\${ext}`,
    publish: null,
  };
  return {
    ...stagePackage,
    [WORKSTATION_PACKAGE_MARKER]: true as const,
    build: workstationBuild,
  };
}
