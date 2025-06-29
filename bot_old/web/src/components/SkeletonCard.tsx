// Карточка-заглушка во время загрузки
export default function SkeletonCard() {
  return (
    <div className="animate-pulse rounded border border-stroke bg-gray p-4">
      <div className="mb-4 h-6 w-1/3 rounded bg-gray-2" />
      <div className="mb-2 h-4 w-full rounded bg-gray-2" />
      <div className="mb-2 h-4 w-full rounded bg-gray-2" />
      <div className="h-4 w-2/3 rounded bg-gray-2" />
    </div>
  )
}
