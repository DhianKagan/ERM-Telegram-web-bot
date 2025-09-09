// Страница управления коллекциями (флоты, департаменты, сотрудники)
// Основные модули: React, Breadcrumbs.
import React from "react";
import Breadcrumbs from "../components/Breadcrumbs";

export default function CollectionsPage() {
  return (
    <div className="space-y-6 p-4">
      <Breadcrumbs
        items={[{ label: "Задачи", href: "/tasks" }, { label: "Коллекции" }]}
      />
      <div>Управление коллекциями</div>
    </div>
  );
}
