import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const REDIRECT_SECONDS = 3;

export default function ErrorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [secondsLeft, setSecondsLeft] = React.useState(REDIRECT_SECONDS);
  const from = searchParams.get('from') || '';

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      navigate('/index', { replace: true });
    }, REDIRECT_SECONDS * 1000);

    const tick = window.setInterval(() => {
      setSecondsLeft((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(tick);
    };
  }, [navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-900">
      <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow dark:border-slate-700 dark:bg-slate-800">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Ошибка 404
        </h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          Такой страницы не существует или ссылка устарела.
        </p>
        {from && (
          <p className="mt-2 break-all text-sm text-slate-500 dark:text-slate-400">
            Запрошенный адрес: <span className="font-mono">{from}</span>
          </p>
        )}
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
          Автоматический переход на главную через {secondsLeft} сек.
        </p>
        <button
          type="button"
          onClick={() => navigate('/index', { replace: true })}
          className="mt-5 inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          Перейти сейчас
        </button>
      </section>
    </main>
  );
}
