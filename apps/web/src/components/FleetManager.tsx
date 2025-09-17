// Компонент управления флотом, содержит форму с селекторами
// Модули: React
import React from "react";

export type FleetManagerProps = {
  onSubmit: (data: { name: string; token: string }) => void;
};

type FleetManagerComponent = React.FC<FleetManagerProps> & {
  selectors: {
    form: string;
    nameInput: string;
    tokenInput: string;
    toggleTokenButton: string;
    copyTokenButton: string;
  };
};

const FleetManager: FleetManagerComponent = ({ onSubmit }) => {
  const [name, setName] = React.useState("");
  const [token, setToken] = React.useState("");
  const [showToken, setShowToken] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const canCopy = React.useMemo(
    () => typeof navigator !== "undefined" && Boolean(navigator.clipboard),
    [],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, token });
  };

  const handleCopy = async () => {
    if (!canCopy || !token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
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
      <label className="block text-sm font-medium" htmlFor="fleet-token">
        Token
      </label>
      <div className="flex gap-2">
        <input
          id="fleet-token"
          data-testid="fleet-token"
          className="h-10 w-full rounded border px-3"
          type={showToken ? "text" : "password"}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          required
        />
        <button
          type="button"
          data-testid="fleet-toggle-token"
          className="h-10 rounded border px-3"
          onClick={() => setShowToken((prev) => !prev)}
        >
          {showToken ? "Скрыть" : "Показать"}
        </button>
        <button
          type="button"
          data-testid="fleet-copy-token"
          className="h-10 rounded border px-3"
          onClick={handleCopy}
          disabled={!canCopy || !token}
        >
          Копировать
        </button>
      </div>
      {copied && (
        <span className="text-xs text-green-600">Токен скопирован</span>
      )}
      <button type="submit" className="h-8 rounded bg-blue-600 px-3 text-white">
        Сохранить
      </button>
    </form>
  );
};

FleetManager.selectors = {
  form: '[data-testid="fleet-form"]',
  nameInput: '[data-testid="fleet-name"]',
  tokenInput: '[data-testid="fleet-token"]',
  toggleTokenButton: '[data-testid="fleet-toggle-token"]',
  copyTokenButton: '[data-testid="fleet-copy-token"]',
};

export default FleetManager;
