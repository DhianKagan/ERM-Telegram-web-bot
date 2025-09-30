// Панель изменения токенов темы
// Модули: React, useTheme
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useTheme } from "../context/useTheme";

export default function ThemePanel() {
  const { tokens, setTokens } = useTheme();
  const [local, setLocal] = useState(tokens);

  const change = (key: keyof typeof tokens, value: string) => {
    setLocal({ ...local, [key]: value });
  };

  const save = () => {
    setTokens(local);
  };

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mr-2">Основной</span>
        <input
          type="color"
          value={local.primary}
          onChange={(e) => change("primary", e.target.value)}
        />
      </label>
      <label className="block">
        <span className="mr-2">Фон</span>
        <input
          type="color"
          value={local.background}
          onChange={(e) => change("background", e.target.value)}
        />
      </label>
      <Button onClick={save}>
        Сохранить
      </Button>
    </div>
  );
}
