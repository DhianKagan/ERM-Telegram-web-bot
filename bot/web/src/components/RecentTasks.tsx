// Таблица последних задач
import React, { useEffect, useState } from "react";
import authFetch from "../utils/authFetch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Task {
  _id: string;
  title: string;
  status: string;
  request_id: string;
  createdAt: string;
}

export default function RecentTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    authFetch("/api/v1/tasks?limit=5")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setTasks(data);
        setLoading(false);
      })
      .catch(() => {
        setTasks([]);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-4 w-full animate-pulse rounded bg-gray-200"
          />
        ))}
      </div>
    );
  }

  return (
    <Table className="text-sm">
      <TableHeader>
        <TableRow>
          <TableHead className="text-left">Название</TableHead>
          <TableHead className="text-center">Статус</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((t) => {
          const name = t.title.replace(/^ERM_\d+\s*/, "");
          const date = t.createdAt?.slice(0, 10);
          return (
            <TableRow key={t._id} className="border-b">
              <TableCell>{`${t.request_id} ${date} ${name}`}</TableCell>
              <TableCell className="text-center">{t.status}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
