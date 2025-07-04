// Форма создания универсальной заявки с основными полями
import React from "react";
import MapSelector from "./MapSelector";
import RichTextEditor from "./RichTextEditor";
import { createUniversalTask } from "../services/universalTasks";
import { fetchDefaults } from "../services/dicts";

interface Props {
  onClose: () => void;
  onCreate?: (data: unknown) => void;
}

export default function UniversalTaskForm({ onClose, onCreate }: Props) {
  const [requestId, setRequestId] = React.useState("");
  const [start, setStart] = React.useState("");
  const [end, setEnd] = React.useState("");
  const [showStartMap, setShowStartMap] = React.useState(false);
  const [showEndMap, setShowEndMap] = React.useState(false);
  const [priority, setPriority] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [priorities, setPriorities] = React.useState<string[]>([]);
  const [statuses, setStatuses] = React.useState<string[]>([]);
  const [description, setDescription] = React.useState("");

  React.useEffect(() => {
    fetchDefaults("priority").then((v) => {
      setPriorities(v);
      if (!priority && v.length) setPriority(v[0]);
    });
    fetchDefaults("status").then((v) => {
      setStatuses(v);
      if (!status && v.length) setStatus(v[0]);
    });
  }, []);

  const submit = async () => {
    const data = await createUniversalTask({
      request_id: requestId,
      logistics_details: {
        start_location: start,
        end_location: end,
      },
      priority,
      status,
      work_details: { description },
    });
    if (data && onCreate) onCreate(data);
    onClose();
  };

  return (
    <div className="bg-opacity-30 animate-fade-in fixed inset-0 flex items-center justify-center bg-black">
      <div className="w-96 max-h-[90vh] overflow-y-auto space-y-4 rounded-xl bg-white p-6 shadow-lg transition-all duration-150">
        <h3 className="text-lg font-semibold">Новая заявка</h3>
        <input
          value={requestId}
          onChange={(e) => setRequestId(e.target.value)}
          placeholder="ID заявки"
          className="w-full rounded border px-2 py-1"
        />
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full rounded border px-2 py-1">
          {priorities.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded border px-2 py-1">
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <div>
          <label className="block text-sm font-medium">Начальная точка</label>
          <input
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full rounded border px-2 py-1"
          />
          <button type="button" onClick={() => setShowStartMap(true)} className="btn-blue mt-1 rounded-full">
            Карта
          </button>
        </div>
        {showStartMap && (
          <MapSelector
            onSelect={({ address }) => {
              setStart(address);
            }}
            onClose={() => setShowStartMap(false)}
          />
        )}
        <div>
          <label className="block text-sm font-medium">Конечная точка</label>
          <input
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full rounded border px-2 py-1"
          />
          <button type="button" onClick={() => setShowEndMap(true)} className="btn-blue mt-1 rounded-full">
            Карта
          </button>
        </div>
        {showEndMap && (
          <MapSelector
            onSelect={({ address }) => {
              setEnd(address);
            }}
            onClose={() => setShowEndMap(false)}
          />
        )}
        <div>
          <label className="block text-sm font-medium">Описание работ</label>
          <RichTextEditor value={description} onChange={setDescription} />
        </div>
        <div className="flex justify-end space-x-2">
          <button className="btn-gray rounded-full" onClick={onClose}>
            Отмена
          </button>
          <button className="btn-blue rounded-full" onClick={submit}>
            Создать
          </button>
        </div>
      </div>
    </div>
  );
}
