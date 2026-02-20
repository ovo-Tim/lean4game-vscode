export interface GameHint {
  text: string;
  hidden: boolean;
  strict: boolean;
}

export interface LevelData {
  /** Absolute path to the source .lean file in Game/Levels/ */
  sourceFilePath: string;
  /** Absolute path to the generated solution file in Solutions/ */
  solutionFilePath: string;
  world: string;
  level: number;
  title: string;
  introduction: string;
  statementDocstring: string;
  /** Everything from "Statement" up to and including ":= by" */
  statementSignature: string;
  hints: GameHint[];
  conclusion: string;
}

export type CompletionStatus = 'incomplete' | 'has-errors' | 'complete';

export interface Hypothesis {
  names: string[];
  type: string;
  val?: string;
}

export interface GoalState {
  hypotheses: Hypothesis[];
  goalType: string;
  userName?: string;
}

export interface LevelProgress {
  level: number;
  title: string;
  filePath: string;
  status: CompletionStatus;
  isNext: boolean;  // the first non-complete level in the game
}

export interface WorldProgress {
  world: string;
  levels: LevelProgress[];
  completed: number;
  total: number;
}

export interface WorldEdge {
  from: string;  // prerequisite world
  to: string;    // dependent world
}

export interface GameProgress {
  worlds: WorldProgress[];
  totalCompleted: number;
  total: number;
  nextFilePath: string | null;
}

export interface TreeData {
  worlds: WorldProgress[];
  edges: WorldEdge[];
  nextFilePath: string | null;
}
