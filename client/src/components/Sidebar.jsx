// Боковое меню с разделами и кнопкой админки
export default function Sidebar({ sections, selected, onSelect, isAdmin }) {
  return (
    <aside className="w-48 bg-gray-50 p-4 flex flex-col gap-2">
      {sections.map(s => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          className={`flex items-center gap-2 p-2 rounded text-left ${selected === s.id ? 'bg-blue-100' : ''}`}
        >
          <span>{s.icon}</span>
          {s.title}
        </button>
      ))}
      {isAdmin && (
        <button onClick={() => onSelect('admin')} className="mt-auto bg-pink-200 p-2 rounded">
          Администрирование
        </button>
      )}
    </aside>
  )
}
