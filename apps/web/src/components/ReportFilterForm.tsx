// Форма фильтрации отчётов по диапазону дат
import React from 'react';

import { Button } from '@/components/ui/button';

interface ReportFilterFormProps {
  onChange?: (period: { from: string; to: string }) => void;
}

export default function ReportFilterForm({ onChange }: ReportFilterFormProps) {
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const submit = (e) => {
    e.preventDefault();
    onChange && onChange({ from, to });
  };
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <input
        type="date"
        id="report-from"
        name="reportFrom"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className="focus:border-accentPrimary focus:ring-brand-200 rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-800 focus:ring focus:outline-none"
      />
      <input
        type="date"
        id="report-to"
        name="reportTo"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className="focus:border-accentPrimary focus:ring-brand-200 rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-800 focus:ring focus:outline-none"
      />
      <Button type="submit">Применить</Button>
    </form>
  );
}
