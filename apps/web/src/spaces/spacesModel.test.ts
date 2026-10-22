import { describe, expect, it } from "vite-plus/test";

import {
  UNASSIGNED_SPACE_ID,
  assignGroupToSpace,
  createSpace,
  deleteSpace,
  deriveSpacesView,
  editSpace,
  initialSpacesState,
  moveScratchThread,
  moveSpace,
  parseSpacesState,
  presetSpaceColor,
  projectCountInSpace,
  recordProjectCreatedInSpace,
  recordScratchThread,
  serializeSpacesState,
  spacesNeedingAttention,
  unavailableProjects,
  recordSpaceVisit,
  rememberSpacePicker,
  resolveSpaceShortcut,
  resolveSwitchTarget,
  spaceOfThread,
  spacePicker,
  switchSpace,
  type SpacesCatalog,
  type SpacesCatalogGroup,
  type SpacesState,
  type SpacesThreadRef,
} from "./spacesModel";

function group(
  key: string,
  members: ReadonlyArray<{ env: string; path: string; projectId?: string; lastUsedAt?: number }>,
  options: { isScratch?: boolean } = {},
): SpacesCatalogGroup {
  return {
    key,
    isScratch: options.isScratch ?? false,
    members: members.map((member) => ({
      physicalKey: `${member.env}:${member.path}`,
      environmentId: member.env,
      lastUsedAt: member.lastUsedAt ?? 0,
    })),
    projectRefs: members.map((member) => ({
      environmentId: member.env,
      projectId: member.projectId ?? `${key}-${member.env}`,
    })),
  };
}

function catalog(
  groups: readonly SpacesCatalogGroup[],
  overrides: Partial<SpacesCatalog> = {},
): SpacesCatalog {
  return { ready: true, groups, scratchThreadKeys: [], ...overrides };
}

const workRepo = group("repo:work", [{ env: "vps", path: "/srv/work" }]);
const blog = group("repo:blog", [{ env: "mac", path: "/Users/me/blog" }]);

function spaceIdNamed(state: SpacesState, name: string): string {
  const space = state.spaces.find((candidate) => candidate.name === name);
  if (!space) throw new Error(`no space named ${name}`);
  return space.id;
}

describe("first launch", () => {
  it("seeds Work and Personal, puts every project in Unassigned and opens there", () => {
    const state = initialSpacesState();
    const view = deriveSpacesView(state, catalog([workRepo, blog]));

    expect(view.switcher.map((entry) => entry.name)).toEqual(["Work", "Personal", "Unassigned"]);
    expect(view.activeSpaceId).toBe(UNASSIGNED_SPACE_ID);
    expect(view.unassignedGroupKeys).toEqual(["repo:work", "repo:blog"]);
  });
});

describe("Unassigned", () => {
  it("disappears once its last project is sorted, and the app lands in the first space", () => {
    let state = initialSpacesState();
    const work = spaceIdNamed(state, "Work");
    const personal = spaceIdNamed(state, "Personal");
    state = assignGroupToSpace(state, workRepo, work);
    expect(deriveSpacesView(state, catalog([workRepo, blog])).activeSpaceId).toBe(
      UNASSIGNED_SPACE_ID,
    );

    state = assignGroupToSpace(state, blog, personal);
    const view = deriveSpacesView(state, catalog([workRepo, blog]));

    expect(view.switcher.map((entry) => entry.name)).toEqual(["Work", "Personal"]);
    expect(view.activeSpaceId).toBe(work);
  });

  it("stays put while the project catalog is still loading", () => {
    const view = deriveSpacesView(initialSpacesState(), catalog([], { ready: false }));

    expect(view.activeSpaceId).toBe(UNASSIGNED_SPACE_ID);
  });

  it("collects projects that appear later, such as ones created from iOS", () => {
    let state = initialSpacesState();
    const work = spaceIdNamed(state, "Work");
    state = assignGroupToSpace(state, workRepo, work);
    const fromPhone = group("repo:phone", [{ env: "vps", path: "/srv/phone" }]);

    const view = deriveSpacesView(state, catalog([workRepo, fromPhone]));

    expect(view.unassignedGroupKeys).toEqual(["repo:phone"]);
    expect(view.switcher.at(-1)?.id).toBe(UNASSIGNED_SPACE_ID);
  });
});

describe("what a space shows", () => {
  const scratch = group("\0no-project", [{ env: "mac", path: "/scratch", projectId: "scratch" }], {
    isScratch: true,
  });

  it("scopes threads to the projects in the space, with no position showing everything", () => {
    let state = initialSpacesState();
    const work = spaceIdNamed(state, "Work");
    const personal = spaceIdNamed(state, "Personal");
    state = assignGroupToSpace(state, workRepo, work);
    state = assignGroupToSpace(state, blog, personal);
    const view = deriveSpacesView(state, catalog([workRepo, blog]));

    const workThread = { threadKey: "vps:t1", projectRef: workRepo.projectRefs[0]! };
    const blogThread = { threadKey: "mac:t2", projectRef: blog.projectRefs[0]! };

    expect(spaceOfThread(view, state, workThread)).toBe(work);
    expect(spaceOfThread(view, state, blogThread)).toBe(personal);
    expect(view.projectRefKeysBySpace.get(work)).toEqual(new Set(["vps:repo:work-vps"]));
    expect(view.switcher.map((entry) => entry.name)).not.toContain("All");
  });

  it("puts a no-project thread in the space it was created in, and unrecorded ones in Unassigned", () => {
    let state = initialSpacesState();
    const work = spaceIdNamed(state, "Work");
    state = assignGroupToSpace(state, workRepo, work);
    state = recordScratchThread(state, "mac:quick-chat", work);
    const view = deriveSpacesView(
      state,
      catalog([workRepo, scratch], { scratchThreadKeys: ["mac:quick-chat", "mac:from-ios"] }),
    );
    const scratchRef = scratch.projectRefs[0]!;

    expect(
      spaceOfThread(view, state, { threadKey: "mac:quick-chat", projectRef: scratchRef }),
    ).toBe(work);
    expect(spaceOfThread(view, state, { threadKey: "mac:from-ios", projectRef: scratchRef })).toBe(
      UNASSIGNED_SPACE_ID,
    );
    expect(view.unassignedScratchThreadKeys).toEqual(["mac:from-ios"]);
    expect(view.switcher.at(-1)?.id).toBe(UNASSIGNED_SPACE_ID);
  });

  it("keeps the first recorded space for a no-project thread", () => {
    let state = initialSpacesState();
    const work = spaceIdNamed(state, "Work");
    const personal = spaceIdNamed(state, "Personal");
    state = recordScratchThread(state, "mac:quick-chat", work);
    state = recordScratchThread(state, "mac:quick-chat", personal);
    const view = deriveSpacesView(state, catalog([scratch]));

    expect(
      spaceOfThread(view, state, {
        threadKey: "mac:quick-chat",
        projectRef: scratch.projectRefs[0]!,
      }),
    ).toBe(work);
  });
});

describe("regrouping", () => {
  const macCopy = { env: "mac", path: "/Users/me/app", projectId: "app-mac" };
  const vpsCopy = { env: "vps", path: "/srv/app", projectId: "app-vps" };

  it("keeps every physical project in its space when grouping settings change", () => {
    let state = initialSpacesState();
    const work = spaceIdNamed(state, "Work");
    const merged = group("repo:app", [macCopy, vpsCopy]);
    state = assignGroupToSpace(state, merged, work);

    const separated = deriveSpacesView(
      state,
      catalog([group("mac:/Users/me/app", [macCopy]), group("vps:/srv/app", [vpsCopy])]),
    );

    expect(separated.groupSpaceByKey.get("mac:/Users/me/app")).toBe(work);
    expect(separated.groupSpaceByKey.get("vps:/srv/app")).toBe(work);
    expect(separated.unassignedGroupKeys).toEqual([]);
  });

  it("resolves a merged group to the space of its most recently used member and flags it", () => {
    let state = initialSpacesState();
    const work = spaceIdNamed(state, "Work");
    const personal = spaceIdNamed(state, "Personal");
    state = assignGroupToSpace(state, group("mac:/Users/me/app", [macCopy]), personal);
    state = assignGroupToSpace(state, group("vps:/srv/app", [vpsCopy]), work);

    const view = deriveSpacesView(
      state,
      catalog([
        group("repo:app", [
          { ...macCopy, lastUsedAt: 10 },
          { ...vpsCopy, lastUsedAt: 20 },
        ]),
      ]),
    );

    expect(view.groupSpaceByKey.get("repo:app")).toBe(work);
    expect(view.conflictGroupKeys).toEqual(["repo:app"]);
  });

  it("moves a group spanning environments as one unit", () => {
    let state = initialSpacesState();
    const personal = spaceIdNamed(state, "Personal");
    const merged = group("repo:app", [macCopy, vpsCopy]);
    state = assignGroupToSpace(state, merged, personal);

    const view = deriveSpacesView(state, catalog([merged]));

    expect(view.projectRefKeysBySpace.get(personal)).toEqual(
      new Set(["mac:app-mac", "vps:app-vps"]),
    );
    expect(view.conflictGroupKeys).toEqual([]);
  });
});

describe("switching", () => {
  function sortedState() {
    let state = initialSpacesState();
    state = assignGroupToSpace(state, workRepo, spaceIdNamed(state, "Work"));
    state = assignGroupToSpace(state, blog, spaceIdNamed(state, "Personal"));
    return switchSpace(state, spaceIdNamed(state, "Work"));
  }
  const fullCatalog = catalog([workRepo, blog]);

  it("goes to the next and previous space without wrapping around", () => {
    const state = sortedState();
    const view = deriveSpacesView(state, fullCatalog);
    const personal = spaceIdNamed(state, "Personal");

    expect(resolveSpaceShortcut(view, { kind: "next" })).toBe(personal);
    expect(resolveSpaceShortcut(view, { kind: "previous" })).toBeNull();
    const atPersonal = deriveSpacesView(switchSpace(state, personal), fullCatalog);
    expect(resolveSpaceShortcut(atPersonal, { kind: "next" })).toBeNull();
  });

  it("jumps to space N in switcher order, Unassigned included at the end", () => {
    const state = switchSpace(initialSpacesState(), "work");
    const view = deriveSpacesView(state, catalog([workRepo]));

    expect(resolveSpaceShortcut(view, { kind: "index", index: 1 })).toBe("personal");
    expect(resolveSpaceShortcut(view, { kind: "index", index: 2 })).toBe(UNASSIGNED_SPACE_ID);
    expect(resolveSpaceShortcut(view, { kind: "index", index: 0 })).toBeNull();
    expect(resolveSpaceShortcut(view, { kind: "index", index: 8 })).toBeNull();
  });

  describe("restoring where I was", () => {
    const work = "work";
    const personal = "personal";
    const workThread = { environmentId: "vps", threadId: "t-work" };
    const lookup = (known: Record<string, SpacesThreadRef>) => ({
      thread: (ref: { environmentId: string; threadId: string }) =>
        known[`${ref.environmentId}:${ref.threadId}`] ?? null,
      draft: (draftId: string) => known[`draft:${draftId}`] ?? null,
    });
    const workThreadRef = {
      threadKey: "vps:t-work",
      projectRef: workRepo.projectRefs[0]!,
    };

    it("returns to the thread I last had open in that space", () => {
      let state = sortedState();
      state = recordSpaceVisit(state, work, { kind: "thread", ...workThread });
      state = switchSpace(state, personal);
      state = recordSpaceVisit(state, personal, { kind: "draft", draftId: "d1" });
      const view = deriveSpacesView(state, fullCatalog);

      expect(
        resolveSwitchTarget(view, state, work, lookup({ "vps:t-work": workThreadRef })),
      ).toEqual({ kind: "thread", ...workThread });
      expect(
        resolveSwitchTarget(
          view,
          state,
          personal,
          lookup({ "draft:d1": { threadKey: "mac:d1", projectRef: blog.projectRefs[0]! } }),
        ),
      ).toEqual({ kind: "draft", draftId: "d1" });
    });

    it("opens the space's landing state when the last thread is gone", () => {
      let state = sortedState();
      state = recordSpaceVisit(state, work, { kind: "thread", ...workThread });
      const view = deriveSpacesView(state, fullCatalog);

      expect(resolveSwitchTarget(view, state, work, lookup({}))).toEqual({
        kind: "landing",
        projectRef: workRepo.projectRefs[0],
      });
    });

    it("never restores a thread that now belongs to another space", () => {
      let state = sortedState();
      state = recordSpaceVisit(state, work, { kind: "thread", ...workThread });
      state = assignGroupToSpace(state, workRepo, personal);
      const view = deriveSpacesView(state, fullCatalog);

      expect(
        resolveSwitchTarget(view, state, work, lookup({ "vps:t-work": workThreadRef })),
      ).toEqual({ kind: "landing", projectRef: null });
    });

    it("remembers the project picker selection per space", () => {
      let state = sortedState();
      state = rememberSpacePicker(state, work, "repo:work");
      state = rememberSpacePicker(state, personal, null);

      expect(spacePicker(state, work)).toBe("repo:work");
      expect(spacePicker(state, personal)).toBeNull();
    });
  });

  it("ignores a switch to a space that does not exist", () => {
    const state = sortedState();

    expect(switchSpace(state, "nope")).toBe(state);
  });
});

describe("managing spaces", () => {
  it("creates a space at the end with its name, emoji and color", () => {
    const state = createSpace(initialSpacesState(), {
      id: "side",
      name: "  Side projects ",
      emoji: "🧪",
      color: presetSpaceColor("violet"),
    });
    const view = deriveSpacesView(state, catalog([workRepo]));

    expect(view.switcher.map((entry) => [entry.name, entry.emoji, entry.color])).toEqual([
      ["Work", "💼", presetSpaceColor("blue")],
      ["Personal", "🏠", presetSpaceColor("green")],
      ["Side projects", "🧪", presetSpaceColor("violet")],
      ["Unassigned", null, null],
    ]);
  });

  it("has no limit on how many spaces exist", () => {
    let state = initialSpacesState();
    for (let index = 0; index < 20; index += 1) {
      state = createSpace(state, {
        id: `s${index}`,
        name: `S${index}`,
        emoji: null,
        color: presetSpaceColor("red"),
      });
    }

    expect(state.spaces).toHaveLength(22);
  });

  it("rejects an empty name and colors that are not a hue", () => {
    const state = initialSpacesState();

    expect(
      createSpace(state, { id: "x", name: "  ", emoji: null, color: presetSpaceColor("red") }),
    ).toBe(state);
    expect(
      editSpace(state, "work", { color: "chartreuse" as never }).spaces.find(
        (space) => space.id === "work",
      )?.color,
    ).toEqual(presetSpaceColor("blue"));
  });

  it("renames, recolors and changes the emoji of a seeded space", () => {
    const state = editSpace(initialSpacesState(), "work", {
      name: "Job",
      emoji: null,
      color: presetSpaceColor("orange"),
    });

    expect(state.spaces[0]).toEqual({
      id: "work",
      name: "Job",
      emoji: null,
      color: presetSpaceColor("orange"),
    });
  });

  it("keeps any hue with its tint, clamping tint and wrapping hue", () => {
    const state = editSpace(initialSpacesState(), "work", { color: { hue: 380, tint: 2 } });

    expect(state.spaces[0]?.color).toEqual({ hue: 20, tint: 1 });
  });

  it("reads spaces saved with a preset color name", () => {
    const parsed = parseSpacesState({
      version: 1,
      spaces: [{ id: "work", name: "Work", emoji: null, color: "teal" }],
    });

    expect(parsed.spaces[0]?.color).toEqual(presetSpaceColor("teal"));
  });

  it("moves a space left and right without wrapping", () => {
    let state = createSpace(initialSpacesState(), {
      id: "side",
      name: "Side",
      emoji: null,
      color: presetSpaceColor("pink"),
    });
    state = moveSpace(state, "side", -1);
    expect(state.spaces.map((space) => space.id)).toEqual(["work", "side", "personal"]);
    state = moveSpace(state, "work", -1);
    expect(state.spaces.map((space) => space.id)).toEqual(["work", "side", "personal"]);
    state = moveSpace(state, "work", 1);
    expect(state.spaces.map((space) => space.id)).toEqual(["side", "work", "personal"]);
  });

  it("deletes a space by moving its projects and threads to Unassigned", () => {
    let state = initialSpacesState();
    state = assignGroupToSpace(state, workRepo, "work");
    state = assignGroupToSpace(state, blog, "personal");
    state = recordScratchThread(state, "mac:quick", "work");
    state = recordSpaceVisit(state, "work", { kind: "draft", draftId: "d1" });
    state = switchSpace(state, "work");
    const before = deriveSpacesView(state, catalog([workRepo, blog]));
    expect(projectCountInSpace(before, "work")).toBe(1);

    state = deleteSpace(state, "work");
    const view = deriveSpacesView(
      state,
      catalog([workRepo, blog], { scratchThreadKeys: ["mac:quick"] }),
    );

    expect(view.switcher.map((entry) => entry.id)).toEqual(["personal", UNASSIGNED_SPACE_ID]);
    expect(view.unassignedGroupKeys).toEqual(["repo:work"]);
    expect(view.unassignedScratchThreadKeys).toEqual(["mac:quick"]);
    expect(view.groupSpaceByKey.get("repo:blog")).toBe("personal");
    expect(state.activeSpaceId).toBe(UNASSIGNED_SPACE_ID);
  });

  it("moves a single no-project thread between spaces", () => {
    const scratch = group("\0no-project", [{ env: "mac", path: "/scratch", projectId: "s" }], {
      isScratch: true,
    });
    let state = recordScratchThread(initialSpacesState(), "mac:quick", "work");
    state = moveScratchThread(state, "mac:quick", "personal");
    const view = deriveSpacesView(state, catalog([scratch], { scratchThreadKeys: ["mac:quick"] }));
    const ref = { threadKey: "mac:quick", projectRef: scratch.projectRefs[0]! };

    expect(spaceOfThread(view, state, ref)).toBe("personal");
    state = moveScratchThread(state, "mac:quick", UNASSIGNED_SPACE_ID);
    expect(spaceOfThread(deriveSpacesView(state, catalog([scratch])), state, ref)).toBe(
      UNASSIGNED_SPACE_ID,
    );
  });

  it("can delete every space, leaving only Unassigned", () => {
    let state = deleteSpace(initialSpacesState(), "work");
    state = deleteSpace(state, "personal");
    const view = deriveSpacesView(state, catalog([workRepo]));

    expect(view.switcher.map((entry) => entry.id)).toEqual([UNASSIGNED_SPACE_ID]);
    expect(view.activeSpaceId).toBe(UNASSIGNED_SPACE_ID);
  });
});

describe("adding a project", () => {
  const added = { physicalKey: "mac:/Users/me/new", environmentId: "mac" };
  const addedGroup = group("repo:new", [{ env: "mac", path: "/Users/me/new" }]);

  it("joins the space the flow started in, even after switching away before it finishes", () => {
    const startedIn = switchSpace(initialSpacesState(), "personal").activeSpaceId;
    let state = switchSpace(initialSpacesState(), "personal");
    state = switchSpace(state, "work");

    state = recordProjectCreatedInSpace(state, added, startedIn);

    expect(deriveSpacesView(state, catalog([addedGroup])).groupSpaceByKey.get("repo:new")).toBe(
      "personal",
    );
  });

  it("does not move a project that already has a space", () => {
    let state = assignGroupToSpace(initialSpacesState(), addedGroup, "work");
    state = recordProjectCreatedInSpace(state, added, "personal");

    expect(deriveSpacesView(state, catalog([addedGroup])).groupSpaceByKey.get("repo:new")).toBe(
      "work",
    );
  });

  it("lands in Unassigned when the originating space was deleted meanwhile", () => {
    let state = deleteSpace(initialSpacesState(), "personal");
    state = recordProjectCreatedInSpace(state, added, "personal");

    expect(deriveSpacesView(state, catalog([addedGroup])).unassignedGroupKeys).toEqual([
      "repo:new",
    ]);
  });
});

describe("signals", () => {
  function sorted() {
    let state = initialSpacesState();
    state = assignGroupToSpace(state, workRepo, "work");
    state = assignGroupToSpace(state, blog, "personal");
    return switchSpace(state, "work");
  }

  it("flags a space when one of its threads needs me, and not for finished or running work", () => {
    const state = sorted();
    const view = deriveSpacesView(state, catalog([workRepo, blog]));

    const flags = spacesNeedingAttention(view, state, [
      { threadKey: "mac:waiting", projectRef: blog.projectRefs[0]!, needsAttention: true },
      { threadKey: "vps:running", projectRef: workRepo.projectRefs[0]!, needsAttention: false },
    ]);

    expect(flags).toEqual(new Set(["personal"]));
  });

  it("keeps assignments while an environment is offline and counts what is unavailable", () => {
    let state = sorted();
    const second = group("repo:api", [{ env: "vps", path: "/srv/api" }]);
    state = assignGroupToSpace(state, second, "work");
    const environments = [
      { environmentId: "vps", label: "VPS", connected: false },
      { environmentId: "mac", label: "Mac", connected: true },
    ];

    // The offline environment's projects drop out of the catalog.
    const view = deriveSpacesView(state, catalog([blog]));

    expect(unavailableProjects(state, "work", environments)).toEqual([
      { environmentId: "vps", label: "VPS", count: 2 },
    ]);
    expect(unavailableProjects(state, "personal", environments)).toEqual([]);
    expect(view.unassignedGroupKeys).toEqual([]);
    expect(view.projectRefKeysBySpace.get("personal")).toEqual(new Set(["mac:repo:blog-mac"]));
    expect(view.projectRefKeysBySpace.get("work")).toBeUndefined();

    const reconnected = environments.map((environment) => ({ ...environment, connected: true }));
    expect(unavailableProjects(state, "work", reconnected)).toEqual([]);
    expect(
      deriveSpacesView(state, catalog([workRepo, second, blog])).groupSpaceByKey.get("repo:api"),
    ).toBe("work");
  });
});

describe("persistence", () => {
  it("round-trips everything a restart needs", () => {
    let state = initialSpacesState();
    state = createSpace(state, {
      id: "side",
      name: "Side",
      emoji: "🧪",
      color: presetSpaceColor("violet"),
    });
    state = assignGroupToSpace(state, workRepo, "work");
    state = recordScratchThread(state, "mac:quick", "side");
    state = recordSpaceVisit(state, "work", {
      kind: "thread",
      environmentId: "vps",
      threadId: "t1",
    });
    state = rememberSpacePicker(state, "work", "repo:work");
    state = switchSpace(state, "side");

    expect(parseSpacesState(JSON.parse(serializeSpacesState(state)))).toEqual(state);
  });

  it("falls back to the seeded state for missing, corrupt or unknown-version data", () => {
    expect(parseSpacesState(null)).toEqual(initialSpacesState());
    expect(parseSpacesState("garbage")).toEqual(initialSpacesState());
    expect(parseSpacesState({ version: 99, spaces: [] })).toEqual(initialSpacesState());
  });

  it("drops entries that point at spaces that no longer exist and invalid colors", () => {
    const parsed = parseSpacesState({
      version: 1,
      spaces: [
        { id: "work", name: "Work", emoji: "💼", color: "neon" },
        { id: "", name: "Broken", color: presetSpaceColor("red") },
      ],
      membership: {
        "vps:/srv/work": { spaceId: "work", environmentId: "vps" },
        "vps:/srv/gone": { spaceId: "gone", environmentId: "vps" },
      },
      scratchThreadSpaces: { "mac:a": "gone" },
      activeSpaceId: "gone",
      lastTargetBySpace: { work: { kind: "draft", draftId: "d" }, gone: { kind: "nope" } },
      pickerBySpace: { work: "repo:work", gone: "x" },
    });

    expect(parsed).toEqual({
      spaces: [{ id: "work", name: "Work", emoji: "💼", color: presetSpaceColor("blue") }],
      membership: { "vps:/srv/work": { spaceId: "work", environmentId: "vps" } },
      scratchThreadSpaces: {},
      activeSpaceId: UNASSIGNED_SPACE_ID,
      lastTargetBySpace: { work: { kind: "draft", draftId: "d" } },
      pickerBySpace: { work: "repo:work" },
    });
  });
});
