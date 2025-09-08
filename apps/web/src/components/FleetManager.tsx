// Компонент управления флотом, содержит форму с селекторами
// Модули: React
import React from "react";

export type FleetManagerProps = {
  onSubmit: (data: { name: string }) => void;
};

type FleetManagerComponent = React.FC<FleetManagerProps> & {
  selectors: {
    form: string;
    nameInput: string;
  };
};

const FleetManager: FleetManagerComponent = ({ onSubmit }) => {
  const [name, setName] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name });
  };

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="fleet-form"
      className="space-y-2"
    >
      <label className="block text-sm font-medium" htmlFor="fleet-name">
        Название флота
      </label>
      <input
        id="fleet-name"
        data-testid="fleet-name"
        className="h-10 w-full rounded border px-3"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <button type="submit" className="h-8 rounded bg-blue-600 px-3 text-white">
        Сохранить
      </button>
    </form>
  );
};

FleetManager.selectors = {
  form: '[data-testid="fleet-form"]',
  nameInput: '[data-testid="fleet-name"]',
};

export default FleetManager;
