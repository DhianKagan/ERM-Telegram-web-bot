// Назначение файла: типы для модулей pdfmake без официальных деклараций
// Основные модули: pdfmake
declare module 'pdfmake/build/vfs_fonts' {
  const fonts: {
    pdfMake: {
      vfs: Record<string, string>;
    };
  };
  export default fonts;
}
