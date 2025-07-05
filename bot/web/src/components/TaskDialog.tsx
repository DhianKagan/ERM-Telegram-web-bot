// Общая форма создания и редактирования задач
import React, { useContext } from "react";
import MapSelector from "./MapSelector";
import RichTextEditor from "./RichTextEditor";
import { AuthContext } from "../context/AuthContext";
import fields from "../../../shared/taskFields.cjs";
import { fetchDefaults } from "../services/dicts";
import { createTask, updateTask } from "../services/tasks";
import authFetch from "../utils/authFetch";
import { validateURL } from "../utils/validation";

interface Props {
  onClose: () => void;
  onSave?: (data: any) => void;
  id?: string;
}

export default function TaskDialog({ onClose, onSave, id }: Props) {
  const isEdit = Boolean(id);
  const { user } = useContext(AuthContext);
  const [requestId,setRequestId]=React.useState('');
  const [created,setCreated]=React.useState('');
  const [title, setTitle] = React.useState("");
  const [taskType, setTaskType] = React.useState(fields.find(f=>f.name==='task_type')?.default||"");
  const [description, setDescription] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [priority, setPriority] = React.useState(fields.find(f=>f.name==='priority')?.default||"");
  const [transportType, setTransportType] = React.useState(fields.find(f=>f.name==='transport_type')?.default||"");
  const [paymentMethod, setPaymentMethod] = React.useState(fields.find(f=>f.name==='payment_method')?.default||"");
  const [status, setStatus] = React.useState(fields.find(f=>f.name==='status')?.default||"");
  const [dueDate, setDueDate] = React.useState("");
  const [assignee, setAssignee] = React.useState("");
  const [controller, setController] = React.useState("");
  const [department, setDepartment] = React.useState("");
  const [creator, setCreator] = React.useState("");
  const [assignees, setAssignees] = React.useState<string[]>([]);
  const [start, setStart] = React.useState("");
  const [startLink, setStartLink] = React.useState("");
  const [end, setEnd] = React.useState("");
  const [endLink, setEndLink] = React.useState("");
  const [showStartMap, setShowStartMap] = React.useState(false);
  const [showEndMap, setShowEndMap] = React.useState(false);
  const [types,setTypes]=React.useState<string[]>([]);
  const [priorities,setPriorities]=React.useState<string[]>([]);
  const [transports,setTransports]=React.useState<string[]>([]);
  const [payments,setPayments]=React.useState<string[]>([]);
  const [statuses,setStatuses]=React.useState<string[]>([]);
  const [users,setUsers]=React.useState<any[]>([]);
  const [roles,setRoles]=React.useState<any[]>([]);
  const [groups,setGroups]=React.useState<any[]>([]);
  const [departments,setDepartments]=React.useState<any[]>([]);
  const [attachments,setAttachments]=React.useState<any[]>([]);
  const [files,setFiles]=React.useState<FileList|null>(null);

  React.useEffect(()=>{
    fetchDefaults('task_type').then(v=>{setTypes(v);if(!taskType&&v.length)setTaskType(v[0]);});
    fetchDefaults('priority').then(v=>{setPriorities(v);if(!priority&&v.length)setPriority(v[0]);});
    fetchDefaults('transport_type').then(v=>{setTransports(v);if(!transportType&&v.length)setTransportType(v[0]);});
    fetchDefaults('payment_method').then(v=>{setPayments(v);if(!paymentMethod&&v.length)setPaymentMethod(v[0]);});
    fetchDefaults('status').then(v=>{setStatuses(v);if(!status&&v.length)setStatus(v[0]);});
  },[]);

  React.useEffect(()=>{
    if(isEdit&&id){
      authFetch(`/api/v1/tasks/${id}`).then(r=>r.ok?r.json():null).then(t=>{
        if(!t) return;
        setRequestId(t.request_id);
        setCreated(new Date(t.createdAt).toISOString().slice(0,10));
      });
    }else{
      setCreated(new Date().toISOString().slice(0,10));
      authFetch('/api/v1/tasks/report/summary')
        .then(r=>r.ok?r.json():{count:0})
        .then(s=>{
          const num=String((s.count||0)+1).padStart(6,'0');
          setRequestId(`ERM_${num}`);
        });
    }
  },[id,isEdit]);

  React.useEffect(()=>{
    authFetch('/api/users').then(r=>r.ok?r.json():[]).then(list=>{setUsers(list);if(user) setCreator(user.telegram_id);});
    authFetch('/api/groups').then(r=>r.ok?r.json():[]).then(setGroups);
    authFetch('/api/roles').then(r=>r.ok?r.json():[]).then(setRoles);
    authFetch('/api/departments').then(r=>r.ok?r.json():[]).then(setDepartments);
  },[user]);

  React.useEffect(()=>{
    if(!end){setEnd(start);setEndLink(startLink);} },[start,startLink,end]);

  React.useEffect(()=>{
    if(!isEdit||!id) return;
    authFetch(`/api/v1/tasks/${id}`).then(r=>r.ok?r.json():null).then(t=>{
      if(!t) return;
      setTitle(t.title||"");
      setTaskType(t.task_type||taskType);
      setDescription(t.task_description||"");
      setComment(t.comment||"");
      setPriority(t.priority||priority);
      setTransportType(t.transport_type||transportType);
      setPaymentMethod(t.payment_method||paymentMethod);
      setStatus(t.status||status);
      setDepartment(t.departmentId||"");
      setCreator(String(t.created_by||""));
      setAssignees(t.assignees||[]);
      setStart(t.start_location||"");
      setStartLink(t.start_location_link||"");
      setEnd(t.end_location||"");
      setEndLink(t.end_location_link||"");
      setDueDate(t.due_date?new Date(t.due_date).toISOString().slice(0,16):"");
      setAssignee(String(t.assigned_user_id||""));
      setController(String(t.controller_user_id||""));
      setAttachments(t.attachments||[]);
    });
  },[id,isEdit]);

  const addTag=(e,setter)=>{const val=e.target.value;if(!val)return;let tag="";if(val.startsWith('group:')){const g=groups.find(r=>`group:${r._id}`===val);if(g)tag=`<span data-group="${g._id}">${g.name}</span>`;}else if(val.startsWith('role:')){const r=roles.find(ro=>`role:${ro._id}`===val);if(r)tag=`<span data-role="${r._id}">${r.name}</span>`;}else{const u=users.find(u=>String(u.telegram_id)===val);if(u)tag=`<a href="tg://user?id=${u.telegram_id}">${u.name||u.username}</a>`;}if(tag){setter(d=>`${d} ${tag} `);e.target.value="";}};

  const submit=async()=>{
    const payload={title,task_type:taskType,task_description:description,comment,priority,transport_type:transportType,payment_method:paymentMethod,status,departmentId:department||undefined,created_by:creator,assignees,start_location:start,start_location_link:startLink,end_location:end,end_location_link:endLink,due_date:dueDate||undefined,assigned_user_id:assignee||undefined,controller_user_id:controller||undefined,files:files?Array.from(files).map(f=>f.name):undefined};
    let data;
    if(isEdit&&id){data=await updateTask(id,payload);}else{data=await createTask(payload);} 
    if(data&&onSave) onSave(data);
    onClose();
  };

  return(
    <div className="bg-opacity-30 animate-fade-in fixed inset-0 flex items-center justify-center bg-black">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto space-y-4 rounded-xl bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{requestId} {created}</h3>
          <div>
            <label className="mr-2 text-sm">Приоритет</label>
            <select value={priority} onChange={e=>setPriority(e.target.value)} className="rounded border px-2 py-1">
              {priorities.map(p=>(<option key={p} value={p}>{p}</option>))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium">Отдел</label>
          <select value={department} onChange={e=>setDepartment(e.target.value)} className="w-full rounded border px-2 py-1">
            <option value="">Отдел</option>
            {departments.map(d=>(<option key={d._id} value={d._id}>{d.name}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Название задачи</label>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Название" className="w-full rounded-lg border bg-gray-100 px-3 py-2 text-sm focus:border-accentPrimary focus:outline-none focus:ring focus:ring-brand-200" />
        </div>
        <div>
          <label className="block text-sm font-medium">Тип задачи</label>
          <select value={taskType} onChange={e=>setTaskType(e.target.value)} className="w-full rounded border px-2 py-1">
            {types.map(t=>(<option key={t} value={t}>{t}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Задачу создал</label>
          <select value={creator} onChange={e=>setCreator(e.target.value)} className="w-full rounded border px-2 py-1">
            <option value="">автор</option>
            {users.map(u=>(<option key={u.telegram_id} value={u.telegram_id}>{u.name||u.username}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Исполнител(и)ь</label>
          <select multiple value={assignees} onChange={e=>setAssignees(Array.from(e.target.selectedOptions).map(o=>o.value))} className="w-full rounded border px-2 py-1">
            {users.map(u=>(<option key={u.telegram_id} value={u.telegram_id}>{u.name||u.username}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Старт точка</label>
          {startLink?(<a href={startLink} target="_blank" rel="noopener" className="text-accentPrimary underline">{start||'ссылка'}</a>):(<span className="text-gray-500">не выбрано</span>)}
          <button type="button" onClick={()=>setShowStartMap(true)} className="btn-blue ml-2 rounded-full">Карта</button>
        </div>
        {showStartMap&&(<MapSelector onSelect={({link,address})=>{setStart(address);setStartLink(link);}} onClose={()=>setShowStartMap(false)} />)}
        <div>
          <label className="block text-sm font-medium">Тип транспорта</label>
          <select value={transportType} onChange={e=>setTransportType(e.target.value)} className="w-full rounded border px-2 py-1">
            {transports.map(t=>(<option key={t} value={t}>{t}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Финальная точка</label>
          {endLink?(<a href={endLink} target="_blank" rel="noopener" className="text-accentPrimary underline">{end||'ссылка'}</a>):(<span className="text-gray-500">не выбрано</span>)}
          <button type="button" onClick={()=>setShowEndMap(true)} className="btn-blue ml-2 rounded-full">Карта</button>
        </div>
        {showEndMap&&(<MapSelector onSelect={({link,address})=>{setEnd(address);setEndLink(validateURL(link));}} onClose={()=>setShowEndMap(false)} />)}
        <div>
          <label className="block text-sm font-medium">Способ оплаты</label>
          <select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)} className="w-full rounded border px-2 py-1">
            {payments.map(p=>(<option key={p} value={p}>{p}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">🔨 Задача</label>
          <RichTextEditor value={description} onChange={setDescription} />
          <select onChange={e=>addTag(e,setDescription)} className="mt-2 w-full rounded border px-2 py-1">
            <option value="">@ упомянуть</option>
            <optgroup label="Пользователи">
              {users.map(u=>(<option key={u.telegram_id} value={u.telegram_id}>{u.name||u.username}</option>))}
            </optgroup>
            <optgroup label="Группы">
              {groups.map(g=>(<option key={g._id} value={`group:${g._id}`}>{g.name}</option>))}
            </optgroup>
            <optgroup label="Роли">
              {roles.map(r=>(<option key={r._id} value={`role:${r._id}`}>{r.name}</option>))}
            </optgroup>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Комментарий</label>
          <RichTextEditor value={comment} onChange={setComment} />
          <select onChange={e=>addTag(e,setComment)} className="mt-2 w-full rounded border px-2 py-1">
            <option value="">@ упомянуть</option>
            <optgroup label="Пользователи">
              {users.map(u=>(<option key={u.telegram_id} value={u.telegram_id}>{u.name||u.username}</option>))}
            </optgroup>
            <optgroup label="Группы">
              {groups.map(g=>(<option key={g._id} value={`group:${g._id}`}>{g.name}</option>))}
            </optgroup>
            <optgroup label="Роли">
              {roles.map(r=>(<option key={r._id} value={`role:${r._id}`}>{r.name}</option>))}
            </optgroup>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Срок выполнения</label>
          <input type="datetime-local" value={dueDate} onChange={e=>setDueDate(e.target.value)} className="w-full rounded border px-2 py-1" />
        </div>
        <div>
          <label className="block text-sm font-medium">Статус</label>
          <select value={status} onChange={e=>setStatus(e.target.value)} className="w-full rounded border px-2 py-1">
            {statuses.map(s=>(<option key={s} value={s}>{s}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Ответственный</label>
          <select value={assignee} onChange={e=>setAssignee(e.target.value)} className="w-full rounded border px-2 py-1">
            <option value="">назначить</option>
            {users.map(u=>(<option key={u.telegram_id} value={u.telegram_id}>{u.name||u.username}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Контролёр</label>
          <select value={controller} onChange={e=>setController(e.target.value)} className="w-full rounded border px-2 py-1">
            <option value="">назначить</option>
            {users.map(u=>(<option key={u.telegram_id} value={u.telegram_id}>{u.name||u.username}</option>))}
          </select>
        </div>
        {attachments.length>0&&(
          <div>
            <label className="block text-sm font-medium">Вложения</label>
            <ul className="list-disc pl-4">
              {attachments.map(a=>(<li key={a.url}><a href={a.url} target="_blank" rel="noopener" className="text-accentPrimary underline">{a.name}</a></li>))}
            </ul>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium">Прикрепить файл</label>
          <input type="file" multiple className="mt-1 w-full" onChange={e=>setFiles(e.target.files)} />
        </div>
        <div className="flex justify-end space-x-2">
          <button className="btn-gray rounded-full" onClick={onClose}>Отмена</button>
          <button className="btn-blue rounded-full" onClick={submit}>{isEdit?'Сохранить':'Создать'}</button>
        </div>
      </div>
    </div>
  );
}
