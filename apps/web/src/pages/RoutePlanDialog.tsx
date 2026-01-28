// Диалог создания и редактирования маршрутных листов
// Основные модули: React, routePlans, ui/dialog
import React from 'react';
import type { RoutePlan } from 'shared';

import { Button } from '@/components/ui/button';
import { FormGroup } from '@/components/ui/form-group';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  createRoutePlan,
  getRoutePlan,
  updateRoutePlan,
  type RoutePlanCreatePayload,
} from '../services/routePlans';

type RoutePlanDialogProps = {
  open: boolean;
  planId?: string | null;
  onClose: () => void;
  onSaved: (plan: RoutePlan) => void;
};

const normalizePayload = (
  title: string,
  notes: string,
): RoutePlanCreatePayload => {
  const trimmedTitle = title.trim();
  const trimmedNotes = notes.trim();
  return {
    ...(trimmedTitle ? { title: trimmedTitle } : {}),
    notes: trimmedNotes ? trimmedNotes : null,
  };
};

export default function RoutePlanDialog({
  open,
  planId,
  onClose,
  onSaved,
}: RoutePlanDialogProps) {
  const [title, setTitle] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isEdit = Boolean(planId);

  React.useEffect(() => {
    if (!open) {
      setTitle('');
      setNotes('');
      setLoading(false);
      setSaving(false);
      setError(null);
      return;
    }
    if (!planId) {
      setTitle('');
      setNotes('');
      setLoading(false);
      setSaving(false);
      setError(null);
      return;
    }

    let isActive = true;
    setLoading(true);
    setError(null);
    void getRoutePlan(planId)
      .then((plan) => {
        if (!isActive) return;
        setTitle(plan.title ?? '');
        setNotes(plan.notes ?? '');
      })
      .catch((err) => {
        if (!isActive) return;
        const message =
          err instanceof Error
            ? err.message
            : 'Не удалось загрузить маршрутный лист';
        setError(message);
      })
      .finally(() => {
        if (!isActive) return;
        setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [open, planId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = normalizePayload(title, notes);
      const plan = planId
        ? await updateRoutePlan(planId, payload)
        : await createRoutePlan(payload);
      onSaved(plan);
      onClose();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Не удалось сохранить маршрутный лист';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? 'Редактировать маршрутный лист'
              : 'Создать маршрутный лист'}
          </DialogTitle>
          <DialogDescription>
            Укажите название и описание маршрутного листа. Поле названия можно
            оставить пустым — оно будет заполнено автоматически.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <FormGroup label="Название" htmlFor="route-plan-title">
            <Input
              id="route-plan-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="LOG_00001 или произвольное название"
              disabled={loading || saving}
            />
          </FormGroup>
          <FormGroup label="Описание" htmlFor="route-plan-notes">
            <textarea
              id="route-plan-notes"
              className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-[96px] w-full rounded-md border px-4 py-2 text-sm shadow-xs transition-colors focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Краткое описание маршрута"
              disabled={loading || saving}
            />
          </FormGroup>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {loading ? (
            <p className="text-sm text-muted-foreground">Загрузка данных…</p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={saving || loading}>
              {saving ? 'Сохраняем…' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
