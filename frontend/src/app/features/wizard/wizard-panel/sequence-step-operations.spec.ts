import { computeStepDepths, deleteSteps, moveSteps, reverseAsReplies } from './sequence-step-operations';
import { SequenceStep } from './wizard-model';

/**
 * Pins the step-list surgery behind drag-reorder and the context-menu
 * commands. The lists here are deliberately allowed to be unbalanced --
 * that is the flat-marker model's whole bargain -- so these functions must
 * stay order-preserving and orphan-tolerant.
 */
describe('sequence-step-operations', () => {
  function msg(id: string, fromId = 'A', toId = 'B', arrow: '->' | '-->' | '->>' = '->', label = ''): SequenceStep {
    return { id, kind: 'message', fromId, toId, arrow, label };
  }

  function open(id: string, label = ''): SequenceStep {
    return { id, kind: 'group-open', groupKind: 'alt', label };
  }

  function elseStep(id: string, label = ''): SequenceStep {
    return { id, kind: 'group-else', label };
  }

  function end(id: string): SequenceStep {
    return { id, kind: 'group-end' };
  }

  function ids(steps: readonly SequenceStep[]): string[] {
    return steps.map((step) => step.id);
  }

  describe('computeStepDepths', () => {
    it('indents rows inside a group and steps back out at the end marker', () => {
      const steps = [msg('1'), open('2'), msg('3'), elseStep('4'), msg('5'), end('6'), msg('7')];

      expect(computeStepDepths(steps)).toEqual([0, 0, 1, 0, 1, 0, 0]);
    });

    it('nests one level per open group', () => {
      const steps = [open('1'), open('2'), msg('3'), end('4'), end('5')];

      expect(computeStepDepths(steps)).toEqual([0, 1, 2, 1, 0]);
    });

    it('clamps orphan else and end markers at depth zero instead of going negative', () => {
      const steps = [end('1'), elseStep('2'), msg('3'), open('4'), msg('5')];

      expect(computeStepDepths(steps)).toEqual([0, 0, 0, 0, 1]);
    });
  });

  describe('moveSteps', () => {
    const steps = [msg('1'), msg('2'), msg('3'), msg('4'), msg('5')];

    it('moves a step up, before the step at the given index', () => {
      expect(ids(moveSteps(steps, new Set(['4']), 1))).toEqual(['1', '4', '2', '3', '5']);
    });

    it('moves a step down, accounting for the gap it leaves behind', () => {
      expect(ids(moveSteps(steps, new Set(['2']), 4))).toEqual(['1', '3', '4', '2', '5']);
    });

    it('moves a non-contiguous selection as one block, keeping its relative order', () => {
      expect(ids(moveSteps(steps, new Set(['1', '3']), 5))).toEqual(['2', '4', '5', '1', '3']);
    });

    it('moves to the very end when the index is the list length', () => {
      expect(ids(moveSteps(steps, new Set(['1']), 5))).toEqual(['2', '3', '4', '5', '1']);
    });

    it('leaves the list unchanged when a block is dropped onto itself', () => {
      expect(ids(moveSteps(steps, new Set(['2', '3']), 2))).toEqual(['1', '2', '3', '4', '5']);
      expect(ids(moveSteps(steps, new Set(['2', '3']), 3))).toEqual(['1', '2', '3', '4', '5']);
    });

    it('returns the same list when nothing identified is present', () => {
      expect(moveSteps(steps, new Set(['missing']), 0)).toBe(steps);
    });
  });

  describe('deleteSteps', () => {
    it('removes every identified step and nothing else', () => {
      const steps = [msg('1'), open('2'), msg('3')];

      expect(ids(deleteSteps(steps, new Set(['1', '3'])))).toEqual(['2']);
    });
  });

  describe('reverseAsReplies', () => {
    let counter: number;
    const nextId = () => `r${(counter += 1)}`;

    beforeEach(() => {
      counter = 0;
    });

    it('unwinds the selected calls as dashed replies in reverse order, after the last selected row', () => {
      const steps = [msg('1', 'A', 'B'), msg('2', 'B', 'C'), msg('3', 'C', 'D')];

      const result = reverseAsReplies(steps, new Set(['1', '2']), nextId);

      expect(ids(result)).toEqual(['1', '2', 'r1', 'r2', '3']);
      expect(result[2]).toEqual({ id: 'r1', kind: 'message', fromId: 'C', toId: 'B', arrow: '-->', label: '' });
      expect(result[3]).toEqual({ id: 'r2', kind: 'message', fromId: 'B', toId: 'A', arrow: '-->', label: '' });
    });

    it('ignores selected rows that are not solid calls', () => {
      const steps = [msg('1', 'A', 'B'), msg('2', 'B', 'A', '-->'), msg('3', 'A', 'C', '->>'), open('4')];

      const result = reverseAsReplies(steps, new Set(['1', '2', '3', '4']), nextId);

      // Only the solid call answers; the reply still lands after the whole selection.
      expect(ids(result)).toEqual(['1', '2', '3', '4', 'r1']);
      expect(result[4]).toEqual({ id: 'r1', kind: 'message', fromId: 'B', toId: 'A', arrow: '-->', label: '' });
    });

    it('returns the same list when no selected row is a solid call', () => {
      const steps = [msg('1', 'A', 'B', '-->'), open('2')];

      expect(reverseAsReplies(steps, new Set(['1', '2']), nextId)).toBe(steps);
    });
  });
});
