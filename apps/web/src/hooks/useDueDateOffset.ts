/* eslint-disable @typescript-eslint/no-unused-vars */
// Назначение: синхронизирует срок выполнения с датой начала и отслеживает смещение
// Основные модули: React, react-hook-form
import React from 'react';
import type { Path, PathValue, UseFormSetValue } from 'react-hook-form';

interface FormValuesWithDueDate {
  dueDate?: string;
}

interface UseDueDateOffsetParams<TFormValues extends FormValuesWithDueDate> {
  startDateValue?: string;
  setValue: UseFormSetValue<TFormValues>;
  formatInputDate: (value: Date) => string;
  defaultOffsetMs: number;
  autoSync?: boolean;
}

interface UseDueDateOffsetResult<TFormValues extends FormValuesWithDueDate> {
  dueOffset: number;
  setDueOffset: React.Dispatch<React.SetStateAction<number>>;
  handleDueDateChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const useDueDateOffset = <TFormValues extends FormValuesWithDueDate>(
  params: UseDueDateOffsetParams<TFormValues>,
): UseDueDateOffsetResult<TFormValues> => {
  const {
    startDateValue,
    setValue,
    formatInputDate,
    defaultOffsetMs,
    autoSync = true,
  } = params;
  const [dueOffset, setDueOffset] = React.useState(defaultOffsetMs);

  React.useEffect(() => {
    if (!autoSync) return;
    if (!startDateValue) return;
    if (!Number.isFinite(dueOffset)) return;
    const start = new Date(startDateValue);
    const startTime = start.getTime();
    if (Number.isNaN(startTime)) return;
    const nextDue = new Date(startTime + dueOffset);
    if (Number.isNaN(nextDue.getTime())) return;
    setValue(
      'dueDate' as Path<TFormValues>,
      formatInputDate(nextDue) as PathValue<TFormValues, Path<TFormValues>>,
    );
  }, [startDateValue, dueOffset, setValue, formatInputDate, autoSync]);

  const handleDueDateChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setValue(
        'dueDate' as Path<TFormValues>,
        value as PathValue<TFormValues, Path<TFormValues>>,
      );
      if (!startDateValue) return;
      const startMs = new Date(startDateValue).getTime();
      const dueMs = new Date(value).getTime();
      if (Number.isNaN(startMs) || Number.isNaN(dueMs)) return;
      setDueOffset(dueMs - startMs);
    },
    [setValue, startDateValue],
  );

  return { dueOffset, setDueOffset, handleDueDateChange };
};

export default useDueDateOffset;
