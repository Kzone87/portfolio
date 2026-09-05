import {
  PROMPTS,
  TASK_STATUS,
  RUN_STATUS,
  applyHumanReview,
  nextTaskStatus,
  runGeneration,
  validateTaskInput,
  validateStructuredOutput
} from '../engine.mjs';

export class DomainError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = 'DomainError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return structuredClone(value);
}

export function createStore() {
  const state = {
    taskSeq: 3,
    runSeq: 1,
    reviewSeq: 1,
    tasks: [
      {
        id: 1,
        title: 'Invoice correction request',
        content: 'A customer says the latest invoice contains a duplicate charge and asks for a refund review.',
        status: TASK_STATUS.PENDING,
        version: 1,
        output: null,
        evaluation: null,
        createdAt: nowIso(),
        updatedAt: nowIso()
      },
      {
        id: 2,
        title: 'Production access issue',
        content: 'URGENT: a staff member cannot login to the production account after a permission change.',
        status: TASK_STATUS.PENDING,
        version: 1,
        output: null,
        evaluation: null,
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
    ],
    runs: [],
    reviews: []
  };

  function findTask(id) {
    return state.tasks.find((task) => task.id === Number(id));
  }

  function requireTask(id) {
    const task = findTask(id);
    if (!task) throw new DomainError(404, 'TASK_NOT_FOUND', 'task not found');
    return task;
  }

  return {
    listPrompts() {
      return Object.values(PROMPTS).map(clone);
    },

    listTasks() {
      return state.tasks.map(clone);
    },

    listRuns() {
      return state.runs.map(clone).reverse();
    },

    listReviews() {
      return state.reviews.map(clone).reverse();
    },

    createTask(input) {
      let normalized;
      try {
        normalized = validateTaskInput(input);
      } catch (error) {
        throw new DomainError(400, 'INVALID_TASK', error instanceof Error ? error.message : 'invalid task');
      }
      const timestamp = nowIso();
      const task = {
        id: state.taskSeq++,
        ...normalized,
        status: TASK_STATUS.PENDING,
        version: 1,
        output: null,
        evaluation: null,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      state.tasks.push(task);
      return clone(task);
    },

    generateTask(id, options = {}) {
      const task = requireTask(id);
      if ([TASK_STATUS.APPROVED, TASK_STATUS.REJECTED].includes(task.status)) {
        throw new DomainError(409, 'TASK_FINALIZED', 'reviewed task cannot be regenerated');
      }

      const run = runGeneration(task, options);
      const timestamp = nowIso();
      const runRecord = {
        id: state.runSeq++,
        taskId: task.id,
        status: run.status,
        providerId: run.providerId,
        promptVersion: run.promptVersion,
        output: run.output,
        evaluation: run.evaluation,
        attempts: run.attempts,
        createdAt: timestamp
      };
      state.runs.push(runRecord);

      task.version += 1;
      task.updatedAt = timestamp;
      if (run.status === RUN_STATUS.SUCCESS) {
        task.output = run.output;
        task.evaluation = run.evaluation;
        task.status = nextTaskStatus(run);
      } else {
        task.output = null;
        task.evaluation = run.evaluation;
        task.status = TASK_STATUS.PENDING;
      }

      return { task: clone(task), run: clone(runRecord) };
    },

    reviewTask(id, input = {}) {
      const task = requireTask(id);
      const expectedVersion = Number(input.expectedVersion);
      if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
        throw new DomainError(400, 'EXPECTED_VERSION_REQUIRED', 'expectedVersion must be a positive integer');
      }
      if (task.version !== expectedVersion) {
        throw new DomainError(409, 'STALE_REVIEW', `task version changed from ${expectedVersion} to ${task.version}`);
      }
      const decision = String(input.decision ?? '').toUpperCase();
      let editedOutput = input.editedOutput ?? null;
      if (editedOutput && !validateStructuredOutput(editedOutput)) {
        throw new DomainError(400, 'INVALID_OUTPUT', 'editedOutput does not match the structured output schema');
      }

      let reviewed;
      try {
        reviewed = applyHumanReview(task, decision, editedOutput);
      } catch (error) {
        throw new DomainError(409, 'INVALID_REVIEW_STATE', error instanceof Error ? error.message : 'invalid review state');
      }

      const timestamp = nowIso();
      Object.assign(task, reviewed, { updatedAt: timestamp });
      const review = {
        id: state.reviewSeq++,
        taskId: task.id,
        decision,
        reviewer: String(input.reviewer ?? 'demo-reviewer').slice(0, 80),
        taskVersion: task.version,
        edited: Boolean(editedOutput),
        output: clone(task.output),
        createdAt: timestamp
      };
      state.reviews.push(review);
      return { task: clone(task), review: clone(review) };
    }
  };
}
