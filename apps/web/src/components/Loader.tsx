// Назначение: индикатор загрузки приложения, модули: React
import Spinner from "./Spinner";

export default function Loader() {
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      data-testid="loader"
    >
      <Spinner />
    </div>
  );
}
