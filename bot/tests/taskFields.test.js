// Проверка списка полей формы задачи
process.env.NODE_ENV='test'
const fields=require('../shared/taskFields.cjs')

test('содержит все обязательные поля',()=>{
  const names=fields.map(f=>f.name)
  expect(names).toEqual([
    'title','task_type','priority','department','creator','assignees',
    'start_location','transport_type','end_location','payment_method',
    'status','description','comment'
  ])
})

test('поле title обязательно',()=>{
  const title=fields.find(f=>f.name==='title')
  expect(title.required).toBe(true)
})
