/* eslint-disable react/jsx-one-expression-per-line */
/**
 * Назначение: отрисовка меню навигации без внешних ссылок.
 * Модули: React, Navigation от AdminJS.
 */
import React, { FC } from 'react';
import { Navigation } from '@adminjs/design-system';
import { useTranslation, type SidebarResourceSectionProps, useNavigationResources } from 'adminjs';

const SidebarResourceSection: FC<SidebarResourceSectionProps> = ({ resources }) => {
  const elements = useNavigationResources(resources);
  const { translateLabel } = useTranslation();

  // Убираем элементы с внешними ссылками.

  return <Navigation label={translateLabel('navigation')} elements={elements} />;
};

export default SidebarResourceSection;
