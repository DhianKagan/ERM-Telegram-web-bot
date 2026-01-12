// Страница просмотра логов
import React from 'react';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import LogViewer from '../components/LogViewer';
import SettingsSectionHeader from './Settings/SettingsSectionHeader';

export default function Logs() {
  return (
    <div className="space-y-6 p-4">
      <SettingsSectionHeader
        title="Логи"
        description="Журнал действий и событий"
        icon={DocumentTextIcon}
      />
      <LogViewer />
    </div>
  );
}
