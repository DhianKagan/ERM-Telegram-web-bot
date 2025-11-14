// Назначение файла: сопоставление задач с текстовым запросом для глобального поиска
// Модули: taskColumns (тип TaskRow)
import type { TaskRow } from '../columns/taskColumns';

type UserLike = Record<string, unknown>;

const normalizeCandidate = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return [] as string[];
  const collapsed = trimmed.replace(/[\s\-_/]+/g, '');
  if (collapsed && collapsed !== trimmed) {
    return [trimmed, collapsed];
  }
  return [trimmed];
};

const pushCandidate = (target: Set<string>, value: unknown) => {
  if (typeof value === 'string') {
    normalizeCandidate(value).forEach((candidate) => target.add(candidate));
    return;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const text = String(value);
    normalizeCandidate(text).forEach((candidate) => target.add(candidate));
  }
};

const collectNestedValues = (
  value: unknown,
  target: Set<string>,
  depth = 0,
) => {
  if (depth > 2 || value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectNestedValues(item, target, depth + 1));
    return;
  }
  if (value instanceof Date) {
    pushCandidate(target, value.toISOString());
    return;
  }
  if (typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((item) =>
      collectNestedValues(item, target, depth + 1),
    );
    return;
  }
  pushCandidate(target, value);
};

const addUserCandidates = (user: UserLike | undefined, target: Set<string>) => {
  if (!user) return;
  const fields = [
    user.name,
    user.username,
    (user as Record<string, unknown>).telegram_username,
    (user as Record<string, unknown>).telegramId,
    (user as Record<string, unknown>).telegram_id,
    user.phone,
    (user as Record<string, unknown>).mobNumber,
    user.email,
  ];
  fields.forEach((value) => pushCandidate(target, value));
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const collectTaskSearchValues = (
  task: TaskRow,
  users: Record<number, UserLike>,
): string[] => {
  const candidates = new Set<string>();
  const directFields: unknown[] = [
    task.id,
    task._id,
    task.request_id,
    task.task_number,
    task.title,
    task.task_description,
    task.location,
    (task as Record<string, unknown>).start_location,
    (task as Record<string, unknown>).end_location,
    task.project,
    task.comment,
    task.status,
    task.priority,
    task.task_type,
    (task as Record<string, unknown>).route_distance_km,
  ];
  directFields.forEach((value) => pushCandidate(candidates, value));

  const userIds = new Set<number>();
  const appendUserId = (value: unknown) => {
    const parsed = toNumber(value);
    if (parsed !== undefined) {
      userIds.add(parsed);
      pushCandidate(candidates, parsed);
    } else if (typeof value === 'string') {
      pushCandidate(candidates, value);
    }
  };

  appendUserId(task.created_by ?? task.creator ?? task.createdBy);
  appendUserId(task.assigned_user_id);
  appendUserId((task as Record<string, unknown>).controller_user_id);
  (task.assignees || []).forEach((id) => appendUserId(id));
  (
    (task as Record<string, unknown>).controllers as unknown[] | undefined
  )?.forEach((id) => appendUserId(id));

  userIds.forEach((id) => addUserCandidates(users[id], candidates));

  collectNestedValues((task as Record<string, unknown>).custom, candidates);
  collectNestedValues((task as Record<string, unknown>).applicant, candidates);
  collectNestedValues(
    (task as Record<string, unknown>).logistics_details,
    candidates,
  );
  collectNestedValues(
    (task as Record<string, unknown>).procurement_details,
    candidates,
  );
  collectNestedValues(
    (task as Record<string, unknown>).work_details,
    candidates,
  );

  return Array.from(candidates);
};

const tokenize = (query: string): string[] =>
  query.trim().toLowerCase().split(/\s+/).filter(Boolean);

export default function matchTaskQuery(
  task: TaskRow,
  query: string,
  users: Record<number, UserLike>,
): boolean {
  const tokens = tokenize(query);
  if (!tokens.length) return true;
  const haystack = collectTaskSearchValues(task, users);
  if (!haystack.length) return false;
  return tokens.every((token) => {
    const variations = normalizeCandidate(token);
    return variations.some((variant) =>
      haystack.some((candidate) => candidate.includes(variant)),
    );
  });
}

export { collectTaskSearchValues };
