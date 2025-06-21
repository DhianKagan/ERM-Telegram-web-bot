/**
 * Назначение: страница списка задач, загружаемых из MongoDB.
 * Основные модули: React, Next.js, Tailwind.
 */
"use client";

import { useEffect, useState } from "react";
import SectionMain from "../_components/Section/Main";
import SectionTitleLineWithButton from "../_components/Section/TitleLineWithButton";
import { mdiTable } from "@mdi/js";
import { getTasks } from "../../_lib/api";

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  useEffect(() => {
    getTasks().then(setTasks).catch(console.error);
  }, []);

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiTable} title="Tasks" main />
      <ul className="space-y-2">
        {tasks.map((t) => (
          <li key={t._id} className="border p-2 rounded">
            {t.task_description} – {t.status}
          </li>
        ))}
      </ul>
    </SectionMain>
  );
}
