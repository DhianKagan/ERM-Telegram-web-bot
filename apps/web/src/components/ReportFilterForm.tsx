// Форма фильтрации отчётов по диапазону дат
import React from 'react';

import { Button } from '@/components/ui/button';
import { FormGroup } from '@/components/ui/form-group';
import { Input } from '@/components/ui/input';

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
    <form
      onSubmit={submit}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      <FormGroup label="От" htmlFor="report-from">
        <Input
          type="date"
          id="report-from"
          name="reportFrom"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </FormGroup>
      <FormGroup label="До" htmlFor="report-to">
        <Input
          type="date"
          id="report-to"
          name="reportTo"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </FormGroup>
      <div className="flex flex-wrap justify-end gap-2 sm:col-span-2 lg:col-span-3">
        <Button type="submit" variant="primary">
          Применить
        </Button>
      </div>
    </form>
  );
}
