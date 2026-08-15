/**
 * The wizard. Four steps, and the canvas stays on screen from step 2 onward —
 * the user should always be able to see the document they're deciding about
 * (DESIGN.md §5).
 */

export type Step = {
  key: 'add' | 'review' | 'purpose' | 'save';
  /** Uppercase label under the step bar. */
  short: string;
  title: string;
  subtitle: string;
};

export const STEPS: readonly Step[] = [
  {
    key: 'add',
    short: 'Add',
    title: 'Add your document',
    subtitle: 'Nothing is uploaded. This runs entirely on your device.',
  },
  {
    key: 'review',
    short: 'Review',
    title: "Review what's hidden",
    subtitle: 'Check every box before you save.',
  },
  {
    key: 'purpose',
    short: 'Purpose',
    title: 'Add a purpose',
    subtitle: "Stamp what this copy is for, so it can't be quietly reused.",
  },
  {
    key: 'save',
    short: 'Save',
    title: 'Save your redacted copy',
    subtitle: 'This is exactly what gets saved.',
  },
] as const;

/**
 * How far the user is allowed to be. Everything past step 1 needs a document,
 * and no step may be skipped forward — the review step in particular is
 * mandatory and can never be auto-advanced (TRD §3).
 */
export function furthestStep(hasDocument: boolean): number {
  return hasDocument ? STEPS.length - 1 : 0;
}
