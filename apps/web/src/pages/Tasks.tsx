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
import { createTask, TaskRequestError } from '../services/tasks';
import authFetch from '../utils/authFetch';
import type { Task } from 'shared';

type TaskWithDesc = Task & { task_description: string };

export default function Tasks() {
  const [tasks, setTasks] = React.useState<TaskWithDesc[]>([]);
  const [text, setText] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [posting, setPosting] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const perPage = 10;
  const { addToast } = useToast();
  const { user } = useAuth();
  const isManager = user?.role === 'manager' || user?.role === 'admin';

  React.useEffect(() => {
    authFetch('/api/v1/tasks')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setTasks(data);
        setLoading(false);
      });
  }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosting(true);
    try {
      const res = await createTask({ title: text, task_description: text });
      if (res) {
        setText('');
        addToast('Задача создана');
        setTasks([...tasks, res]);
      }
    } catch (error) {
      if (error instanceof TaskRequestError) {
        addToast(`Не удалось создать задачу: ${error.message}`);
      } else if (error instanceof Error) {
        addToast(`Не удалось создать задачу: ${error.message}`);
      } else {
        addToast('Не удалось создать задачу');
      }
    } finally {
      setPosting(false);
    }
  };

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
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
          className="h-10 flex-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--color-muted)] placeholder-[var(--color-muted)] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-400)]"
          placeholder="Описание"
        />
        <Button type="submit" className="xsm:w-full">
          {posting ? <Spinner /> : 'Создать'}
        </Button>
      </form>
      {loading ? (
        <SkeletonCard />
      ) : (
        <>
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
