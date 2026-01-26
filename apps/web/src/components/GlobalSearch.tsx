// Глобальный модуль поиска
// Модули: React, i18next, ui
import React from 'react';
import { useTranslation } from 'react-i18next';
import useTasks from '../context/useTasks';
import UnifiedSearch from './UnifiedSearch';

export type GlobalSearchHandle = {
  search: () => void;
  reset: () => void;
};

type GlobalSearchProps = {
  showActions?: boolean;
  className?: string;
};

const GlobalSearch = React.forwardRef<GlobalSearchHandle, GlobalSearchProps>(
  ({ showActions = true, className }, forwardedRef) => {
    const { query, setQuery } = useTasks();
    const { t } = useTranslation();
    const [value, setValue] = React.useState(query);

    const clear = () => {
      setValue('');
      setQuery('');
    };

    const search = () => {
      setQuery(value);
    };

    React.useImperativeHandle(forwardedRef, () => ({
      search,
      reset: clear,
    }));

    return (
      <UnifiedSearch
        value={value}
        onChange={setValue}
        onSearch={search}
        onReset={clear}
        placeholder={t('search')}
        ariaLabel={t('search')}
        className={className}
        showActions={showActions}
      />
    );
  },
);

GlobalSearch.displayName = 'GlobalSearch';

export default GlobalSearch;
