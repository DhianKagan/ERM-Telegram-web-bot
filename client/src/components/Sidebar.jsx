// Боковое меню с разделами и кнопкой админки
export default function Sidebar({sections,selected,onSelect,isAdmin}){
  return(
    <aside className="w-48 bg-gray-50 p-4 flex flex-col gap-2">
      {sections.map(s=>(
        <button key={s.id} onClick={()=>onSelect(s.id)} className={`text-left p-2 rounded ${selected===s.id?'bg-blue-100':''}`}>{s.title}</button>
      ))}
      {isAdmin && <button onClick={()=>onSelect('admin')} className="mt-auto bg-pink-200 p-2 rounded">Администрирование</button>}
    </aside>
  )
}
