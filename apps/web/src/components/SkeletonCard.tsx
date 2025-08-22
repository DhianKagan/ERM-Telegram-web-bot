// Карточка-заглушка во время загрузки
export default function SkeletonCard() {
  return (
    <div className="border-stroke bg-gray animate-pulse rounded border p-4">
      <div className="bg-gray-2 mb-4 h-6 w-1/3 rounded" />
      <div className="bg-gray-2 mb-2 h-4 w-full rounded" />
      <div className="bg-gray-2 mb-2 h-4 w-full rounded" />
      <div className="bg-gray-2 h-4 w-2/3 rounded" />
    </div>
  );
}
