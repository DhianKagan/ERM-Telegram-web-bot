// Назначение: страница списка задач
// Основные модули: React, контексты аутентификации и уведомлений
import React from 'react';

import { Button } from '@/components/ui/button';
import Breadcrumbs from '../components/Breadcrumbs';
import Pagination from '../components/Pagination';
import SkeletonCard from '../components/SkeletonCard';
import Spinner from '../components/Spinner';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';
import { TaskRequestError, useCreateTaskMutation } from '../services/tasks';
import { useApiQuery } from '../hooks/useApiQuery';
import type { Task } from 'shared';

type TaskWithDesc = Task & { task_description: string };

export default function Tasks() {
  const [text, setText] = React.useState('');
  const [page, setPage] = React.useState(1);
  const perPage = 10;
  const { addToast } = useToast();
  const { user } = useAuth();
  const isManager = user?.role === 'manager' || user?.role === 'admin';
  const {
    data: tasks = [],
    isFetching,
    isLoading,
    refetch,
  } = useApiQuery<TaskWithDesc[]>({
    queryKey: ['tasks', 'simple'],
    url: '/api/v1/tasks',
    parse: async (response) => {
      if (!response.ok) return [];
      const payload = (await response.json().catch(() => [])) as unknown;
      return Array.isArray(payload) ? (payload as TaskWithDesc[]) : [];
    },
  });

  const { mutateAsync: submitTask, isPending } = useCreateTaskMutation({
    onSuccess: () => {
      setText('');
      addToast('Задача создана');
      void refetch();
    },
  });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await submitTask({
        data: { title: text, task_description: text },
      });
    } catch (error) {
      if (error instanceof TaskRequestError) {
        addToast(`Не удалось создать задачу: ${error.message}`);
      } else if (error instanceof Error) {
        addToast(`Не удалось создать задачу: ${error.message}`);
      } else {
        addToast('Не удалось создать задачу');
      }
    }
  };

  const showSkeleton = isLoading && tasks.length === 0;

  const totalPages = Math.ceil(tasks.length / perPage);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[{ label: 'Задачи', href: '/tasks' }, { label: 'Задачи' }]}
      />
      <h2 className="text-xl font-semibold">Задачи</h2>
      {!isManager && (
        <p className="text-sm text-foreground dark:text-foreground">
          Для создания задач необходима роль manager. Обратитесь к
          администратору.
        </p>
      )}
      <form onSubmit={add} className="flex flex-wrap gap-2">
        <input
          id="task-create-description"
          name="taskDescription"
          aria-label="Описание задачи"
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
          className="min-h-[var(--touch-target)] flex-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--color-muted)] placeholder-[var(--color-muted)] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)]"
          placeholder="Описание"
        />
        <Button type="submit" className="xsm:w-full">
          {isPending ? <Spinner /> : 'Создать'}
        </Button>
      </form>
      {showSkeleton ? (
        <SkeletonCard />
      ) : (
        <>
          {isFetching ? (
            <div className="flex justify-center">
              <Spinner className="h-5 w-5 text-[color:var(--color-brand-500)]" />
            </div>
          ) : null}
          <ul className="space-y-2">
            {tasks.slice((page - 1) * 10, page * 10).map((t) => (
              <li
                key={t._id}
                className="rounded-lg border border-border dark:border-border bg-card dark:bg-card p-3 shadow-sm"
              >
                {t.task_description}
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <Pagination total={totalPages} page={page} onChange={setPage} />
          )}
        </>
      )}
    </div>
  );
}
