// Назначение: предоставляет актуальный переводчик i18n через React ref
// Основные модули: React, i18next
import React from "react";
import type { TFunction } from "i18next";

const useI18nRef = <T extends TFunction>(translate: T) => {
  const ref = React.useRef(translate);

  React.useEffect(() => {
    ref.current = translate;
  }, [translate]);

  return ref;
};

export default useI18nRef;
