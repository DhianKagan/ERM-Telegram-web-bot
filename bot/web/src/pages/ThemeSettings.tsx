// Страница настройки темы
// Модули: React, ThemePanel
import ThemePanel from "../components/ThemePanel";

export default function ThemeSettings() {
  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-semibold">Настройка темы</h1>
      <ThemePanel />
    </div>
  );
}
