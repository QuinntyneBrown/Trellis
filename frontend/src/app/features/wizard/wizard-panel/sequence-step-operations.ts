import { SequenceMessageStep, SequenceStep } from './wizard-model';

/**
 * List surgery for the sequence step list. Pure and side-effect free like
 * build-wizard-plantuml.ts, so drag-reorder and the context-menu commands --
 * the behaviour that makes the list worth having -- are pinned by unit tests
 * without a TestBed.
 *
 * These functions never validate group nesting: the list is allowed to be
 * unbalanced while the user shuffles it, and buildSequenceDiagram repairs the
 * balance at emission. What they do preserve is order -- a moved selection
 * keeps its own relative order wherever it lands.
 */

/**
 * The display indent for each row: inside an open group rows step in one
 * level, an `else` hangs at its group's own depth, an `end` steps back out.
 * Orphan markers clamp at zero rather than going negative -- the row still has
 * to be drawn somewhere while the user is mid-rearrangement.
 */
export function computeStepDepths(steps: readonly SequenceStep[]): number[] {
  const depths: number[] = [];
  let depth = 0;

  for (const step of steps) {
    switch (step.kind) {
      case 'group-open':
        depths.push(depth);
        depth += 1;
        break;
      case 'group-else':
        depths.push(Math.max(0, depth - 1));
        break;
      case 'group-end':
        depth = Math.max(0, depth - 1);
        depths.push(depth);
        break;
      default:
        depths.push(depth);
        break;
    }
  }
  return depths;
}

/**
 * Moves the identified steps, as one block in their current relative order, to
 * sit before the step currently at `insertBeforeIndex` (steps.length means the
 * end). The index is read against the list as it is now -- the caller computed
 * it from rendered rows -- so the insertion point is located by counting the
 * unmoved steps ahead of it, which also makes dropping a block onto itself a
 * no-op instead of an off-by-the-block-length shift.
 */
export function moveSteps(
  steps: readonly SequenceStep[],
  movedIds: ReadonlySet<string>,
  insertBeforeIndex: number,
): readonly SequenceStep[] {
  const moved = steps.filter((step) => movedIds.has(step.id));
  if (moved.length === 0) {
    return steps;
  }

  const remaining: SequenceStep[] = [];
  let insertAt = 0;
  steps.forEach((step, index) => {
    if (movedIds.has(step.id)) {
      return;
    }
    if (index < insertBeforeIndex) {
      insertAt += 1;
    }
    remaining.push(step);
  });

  return [...remaining.slice(0, insertAt), ...moved, ...remaining.slice(insertAt)];
}

export function deleteSteps(
  steps: readonly SequenceStep[],
  ids: ReadonlySet<string>,
): readonly SequenceStep[] {
  return steps.filter((step) => !ids.has(step.id));
}

/**
 * The context menu's "Reverse as replies": for the selected solid calls, in
 * list order, insert the dashed replies that would unwind that call stack --
 * last call answered first -- immediately after the last selected row. Reply
 * labels are left empty for the user to fill in (or not; a bare `B --> A` is
 * fine PlantUML). Selected rows that are not solid calls are ignored, and with
 * no qualifying call the list comes back untouched.
 */
export function reverseAsReplies(
  steps: readonly SequenceStep[],
  selectedIds: ReadonlySet<string>,
  nextId: () => string,
): readonly SequenceStep[] {
  const calls = steps.filter(
    (step): step is SequenceMessageStep =>
      selectedIds.has(step.id) && step.kind === 'message' && step.arrow === '->',
  );
  if (calls.length === 0) {
    return steps;
  }

  const replies: SequenceMessageStep[] = [...calls].reverse().map((call) => ({
    id: nextId(),
    kind: 'message',
    fromId: call.toId,
    toId: call.fromId,
    arrow: '-->',
    label: '',
  }));

  let lastSelectedIndex = -1;
  steps.forEach((step, index) => {
    if (selectedIds.has(step.id)) {
      lastSelectedIndex = index;
    }
  });

  return [...steps.slice(0, lastSelectedIndex + 1), ...replies, ...steps.slice(lastSelectedIndex + 1)];
}
