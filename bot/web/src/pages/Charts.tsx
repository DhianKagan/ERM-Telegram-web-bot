// Демонстрация графика LineChart из TailAdmin
import React from 'react'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, LineElement, CategoryScale, LinearScale, PointElement } from 'chart.js'

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement)

export default function Charts() {
  const data = {
    labels: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн'],
    datasets: [{
      label: 'Доход',
      data: [3, 4, 6, 4, 8, 10],
      borderColor: '#6366f1',
      fill: false,
    }],
  }
  const options = { responsive: true }
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Charts</h2>
      <Line data={data} options={options} />
    </div>
  )
}
