// График количества задач за период
import React, { useEffect, useState } from 'react'
import ReactApexChart from 'react-apexcharts'

export default function TasksChart() {
  const [series, setSeries] = useState([{ data: [] }])
  const [categories, setCategories] = useState([])

  useEffect(() => {
    fetch('/api/tasks/report/chart', {
      headers: { Authorization: localStorage.token ? `Bearer ${localStorage.token}` : '' }
    })
      .then(r => (r.ok ? r.json() : { data: [], labels: [] }))
      .then(({ data, labels }) => {
        setSeries([{ data }])
        setCategories(labels)
      })
      .catch(() => {})
  }, [])

  const options = {
    chart: { height: 200, type: 'line', toolbar: { show: false } },
    stroke: { width: 2, curve: 'smooth' },
    xaxis: { categories }
  }

  return <ReactApexChart series={series} options={options} type="line" height={200} />
}
