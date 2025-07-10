// Страница отображения маршрутов на карте с фильтрами
import React from 'react'
import Breadcrumbs from '../components/Breadcrumbs'
import fetchRoutes from '../services/routes'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface Route {
  _id: string
  startCoordinates?: { lat: number; lng: number }
  finishCoordinates?: { lat: number; lng: number }
  route_distance_km?: number
  status?: string
  departmentId?: string
  createdAt?: string
}

export default function RoutesPage() {
  const [routes, setRoutes] = React.useState<Route[]>([])
  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')
  const [status, setStatus] = React.useState('')
  const [department, setDepartment] = React.useState('')

  const load = React.useCallback(() => {
    fetchRoutes({ from, to, status, department }).then(setRoutes)
  }, [from, to, status, department])

  React.useEffect(load, [load])

  React.useEffect(() => {
    if (!routes.length) return
    const map = L.map('routes-map').setView([48.3794, 31.1656], 6)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map)
    routes.forEach(r => {
      if (r.startCoordinates && r.finishCoordinates) {
        L.polyline([
          [r.startCoordinates.lat, r.startCoordinates.lng],
          [r.finishCoordinates.lat, r.finishCoordinates.lng]
        ], { color: 'blue' }).addTo(map)
      }
    })
    return () => map.remove()
  }, [routes])

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Маршруты' }]} />
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="rounded border px-2 py-1" />
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="rounded border px-2 py-1" />
          <input placeholder="Статус" value={status} onChange={e=>setStatus(e.target.value)} className="rounded border px-2 py-1" />
          <input placeholder="Отдел" value={department} onChange={e=>setDepartment(e.target.value)} className="rounded border px-2 py-1" />
          <button onClick={load} className="btn-blue rounded px-4">Обновить</button>
        </div>
        <div id="routes-map" className="h-96 w-full rounded border" />
      </div>
    </div>
  )
}
