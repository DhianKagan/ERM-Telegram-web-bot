// Назначение: заглушка для импорта стилей Leaflet в клиенте
// Основные модули: Leaflet, CSS

declare module "leaflet/dist/leaflet.css";
declare module "leaflet/dist/leaflet.css?url" {
  const href: string;
  export default href;
}
