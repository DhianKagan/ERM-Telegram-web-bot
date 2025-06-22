// Страница отчётов с фильтром по датам
import React from "react"
import ReportFilterForm from "../components/ReportFilterForm"
import KPIOverview from "../components/KPIOverview"

export default function Reports() {
  const [kpi,setKpi] = React.useState({count:0,time:0})
  const load = (f?:{from?:string,to?:string}) => {
    const q = new URLSearchParams(f as any).toString()
    fetch(`/api/tasks/report/summary${q?`?${q}`:""}`, { headers:{ Authorization: localStorage.token ? `Bearer ${localStorage.token}` : "" } })
      .then(r=>r.ok?r.json():{count:0,time:0}).then(setKpi)
  }
  React.useEffect(()=>load(),[])
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Отчёты</h2>
      <ReportFilterForm onChange={load} />
      <KPIOverview count={kpi.count} time={kpi.time} />
    </div>
  )
}
