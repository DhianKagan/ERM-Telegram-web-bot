# Пример верстки Dashboard в стиле TailAdmin

В этом документе представлены фрагменты кода, повторяющие элементы демо [TailAdmin](https://demo.tailadmin.com). Компоненты располагаются в каталоге `bot/web`.

## Dashboard.jsx
```jsx
// Страница Dashboard с метриками и графиком TailAdmin
import React from 'react'
import MetricCard from '../components/MetricCard'
import TasksChart from '../components/TasksChart'
import RecentTable from '../components/RecentTable'

export default function Dashboard() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-title-lg font-semibold text-black dark:text-white">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard type="total" title="Total" value={42} />
        <MetricCard type="new" title="New" value={8} />
        <MetricCard type="progress" title="In Progress" value={12} />
        <MetricCard type="done" title="Completed" value={22} />
      </div>
      <TasksChart />
      <RecentTable />
    </div>
  )
}
```

## Header
```jsx
// Шапка со строкой поиска, иконками и профилем
import {
  BellIcon,
  EnvelopeIcon,
  MagnifyingGlassIcon,
  SunIcon,
  MoonIcon
} from '@heroicons/react/24/outline'

export default function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-stroke bg-white px-4 shadow-sm dark:border-strokedark dark:bg-boxdark">
      <div className="flex items-center gap-2">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-body" />
        <input className="h-10 w-72 rounded-lg border border-stroke bg-gray px-10 text-sm placeholder:text-body focus:outline-none dark:border-strokedark dark:bg-boxdark" placeholder="Поиск" />
      </div>
      <div className="flex items-center gap-4">
        <button className="relative p-2 hover:text-primary">
          <BellIcon className="h-6 w-6" />
          <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-danger" />
        </button>
        <button className="p-2 hover:text-primary">
          <EnvelopeIcon className="h-6 w-6" />
        </button>
        <button className="p-2 hover:text-primary">
          <SunIcon className="hidden h-6 w-6 dark:block" />
          <MoonIcon className="h-6 w-6 dark:hidden" />
        </button>
        <div className="relative">
          <img className="h-8 w-8 cursor-pointer rounded-full" src="/img/avatar.png" />
          {/* выпадающее меню */}
        </div>
      </div>
    </header>
  )
}
```

## Sidebar
```jsx
import { Link, useLocation } from 'react-router-dom'
import { SidebarItems } from '../data/sidebar'

export default function Sidebar({ open }) {
  const { pathname } = useLocation()
  return (
    <aside className={`fixed left-0 top-0 z-30 h-full w-60 bg-white shadow-md transition-all dark:bg-boxdark ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
      <div className="flex h-16 items-center justify-between px-4">
        <img src="/img/logo.svg" alt="logo" className="h-8" />
      </div>
      <nav className="mt-4 space-y-1 px-2 text-sm">
        {SidebarItems.map(item => (
          <Link
            key={item.to}
            to={item.to}
            className={`flex items-center gap-3 rounded-md px-3 py-2 font-medium hover:bg-gray dark:hover:bg-meta-4 ${pathname === item.to ? 'bg-gray dark:bg-meta-4' : ''}`}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
      </nav>
      <footer className="absolute bottom-0 w-full p-4">
        <img src="/img/logo.svg" className="mx-auto h-8" />
      </footer>
    </aside>
  )
}
```

## Tailwind config
```js
// tailwind.config.js
import defaultTheme from 'tailwindcss/defaultTheme'
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    fontFamily: {
      inter: ['Inter', ...defaultTheme.fontFamily.sans],
      poppins: ['Poppins', ...defaultTheme.fontFamily.sans],
      roboto: ['Roboto', ...defaultTheme.fontFamily.sans]
    },
    extend: {}
  }
}
```

Карточки метрик и таблица реализованы в компонентах `MetricCard` и `RecentTable`. Таблица использует `overflow-auto` для скролла и сортировку на клиенте.
