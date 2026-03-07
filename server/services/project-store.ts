import { v4 as uuid } from "uuid";
import type { ProjectState, Asset, Commit, TimelineDiff, CommitSource } from "../../shared/types.ts";
import { createEmptyProject } from "../../shared/types.ts";
import { applyDiff } from "../../shared/diff-ops.ts";

let state: ProjectState = createEmptyProject(uuid(), "Untitled Project");
let commits: Commit[] = [];

export function getState(): ProjectState {
  return state;
}

export function setState(newState: ProjectState): void {
  state = newState;
}

export function addAsset(asset: Asset): void {
  state = {
    ...state,
    assets: [...state.assets, asset],
    updatedAt: Date.now(),
  };
}

export function addCommit(diff: TimelineDiff, source: CommitSource): Commit {
  const snapshotBefore = JSON.stringify(state);
  state = applyDiff(state, diff);
  const commit: Commit = {
    id: uuid(),
    diff,
    snapshotBefore,
    source,
    createdAt: Date.now(),
  };
  commits.push(commit);
  return commit;
}

export function revertCommit(commitId: string): ProjectState | null {
  const idx = commits.findIndex((c) => c.id === commitId);
  if (idx === -1) return null;
  const commit = commits[idx]!;
  state = JSON.parse(commit.snapshotBefore) as ProjectState;
  commits = commits.slice(0, idx);
  return state;
}

export function getCommits(): Commit[] {
  return commits;
}
