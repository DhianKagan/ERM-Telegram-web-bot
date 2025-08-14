// Форма задачи с адаптивной сеткой
// Модули: React
import React from "react";

export function TaskForm() {
  return (
    <form id="task-form" className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FormField label="Название задачи">
        <input className="input" placeholder="Название" />
      </FormField>
      <FormField label="Дата начала">
        <input type="datetime-local" className="input" />
      </FormField>
      <FormField label="Срок выполнения">
        <input type="datetime-local" className="input" />
      </FormField>
      <FormField label="Статус">
        <select className="input select">
          <option>Новая</option>
          <option>В работе</option>
          <option>Выполнена</option>
        </select>
      </FormField>
      <FormField label="Тип задачи">
        <select className="input select">
          <option>Доставить</option>
          <option>Выполнить</option>
        </select>
      </FormField>
      <FormField label="Исполнитель(и)" hint="Можно выбрать нескольких">
        <select multiple className="input select h-10 md:h-[84px]" />
      </FormField>
      <MapInput label="Старт точка" placeholder="Ссылка из Google Maps" />
      <MapInput label="Финишная точка" placeholder="Ссылка из Google Maps" />
      <FormField label="Тип транспорта">
        <select className="input select">
          <option>Авто</option>
          <option>Пешком</option>
        </select>
      </FormField>
      <FormField label="Способ оплаты">
        <select className="input select">
          <option>Карта</option>
          <option>Наличные</option>
        </select>
      </FormField>
      <FormField label="Задача" className="md:col-span-2">
        <textarea className="input min-h-[120px]" />
      </FormField>
      <FormField label="Комментарий" className="md:col-span-2">
        <textarea className="input min-h-[120px]" />
      </FormField>
      <FormField label="Контролёр">
        <select className="input select" />
      </FormField>
      <FormField label="Прикрепить файл">
        <input
          type="file"
          className="input file:mr-3 file:rounded-md file:border file:px-3 file:py-2"
        />
      </FormField>
    </form>
  );
}

type FieldProps = {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
};

function FormField({ label, children, hint, className = "" }: FieldProps) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

type MapInputProps = { label: string; placeholder: string };

function MapInput({ label, placeholder }: MapInputProps) {
  return (
    <div className="md:col-span-1">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <div className="grid grid-cols-[1fr_auto] items-stretch gap-2">
        <input className="input h-10" placeholder={placeholder} />
        <button type="button" className="btn h-10 px-3">
          Карта
        </button>
      </div>
    </div>
  );
}
