// Панель фильтров логов
// Модули: React
import React from 'react';
import { FormGroup } from '@/components/ui/form-group';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { LogFilters } from '../hooks/useLogsQuery';

interface Props {
  filters: LogFilters;
  onChange: (f: LogFilters) => void;
}

export default function FiltersPanel({ filters, onChange }: Props) {
  const noCsrfId = React.useId();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <FormGroup label="Уровень" htmlFor="log-level">
        <Select
          id="log-level"
          aria-label="Уровень"
          name="level"
          value={filters.level || ''}
          onChange={(e) => onChange({ ...filters, level: e.target.value })}
        >
          <option value="">Все уровни</option>
          <option value="debug">debug</option>
          <option value="info">info</option>
          <option value="warn">warn</option>
          <option value="error">error</option>
          <option value="log">log</option>
        </Select>
      </FormGroup>
      <FormGroup label="Метод" htmlFor="log-method">
        <Input
          id="log-method"
          placeholder="Метод"
          name="method"
          value={filters.method || ''}
          onChange={(e) => onChange({ ...filters, method: e.target.value })}
        />
      </FormGroup>
      <FormGroup label="Endpoint" htmlFor="log-endpoint">
        <Input
          id="log-endpoint"
          placeholder="Endpoint"
          name="endpoint"
          value={filters.endpoint || ''}
          onChange={(e) => onChange({ ...filters, endpoint: e.target.value })}
        />
      </FormGroup>
      <FormGroup label="Статус" htmlFor="log-status">
        <Input
          id="log-status"
          placeholder="Статус"
          name="status"
          value={filters.status || ''}
          onChange={(e) =>
            onChange({
              ...filters,
              status: Number(e.target.value) || undefined,
            })
          }
        />
      </FormGroup>
      <FormGroup label="Содержит текст" htmlFor="log-message">
        <Input
          id="log-message"
          placeholder="Содержит текст"
          name="message"
          value={filters.message || ''}
          onChange={(e) => onChange({ ...filters, message: e.target.value })}
        />
      </FormGroup>
      <FormGroup label="От" htmlFor="log-from">
        <Input
          id="log-from"
          type="date"
          name="from"
          value={filters.from || ''}
          onChange={(e) => onChange({ ...filters, from: e.target.value })}
        />
      </FormGroup>
      <FormGroup label="До" htmlFor="log-to">
        <Input
          id="log-to"
          type="date"
          name="to"
          value={filters.to || ''}
          onChange={(e) => onChange({ ...filters, to: e.target.value })}
        />
      </FormGroup>
      <FormGroup label="no-csrf" htmlFor={noCsrfId}>
        <label className="flex items-center gap-2 text-sm">
          <input
            id={noCsrfId}
            name="noCsrf"
            type="checkbox"
            checked={filters.noCsrf || false}
            onChange={(e) => onChange({ ...filters, noCsrf: e.target.checked })}
          />
          <span>Включить фильтр</span>
        </label>
      </FormGroup>
    </div>
  );
}
