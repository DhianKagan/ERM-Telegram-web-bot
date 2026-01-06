import {
  useMutation,
  useQuery,
  type QueryKey,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query';
import authFetch from '../utils/authFetch';

type AuthFetchOptions = Parameters<typeof authFetch>[1];

const defaultParseJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const message =
      (await response.text().catch(() => '')) ||
      response.statusText ||
      'Ошибка запроса';
    throw new Error(message);
  }
  return (await response.json().catch(() => undefined)) as T;
};

interface ApiQueryParams<TData, TError = Error>
  extends Omit<
    UseQueryOptions<TData, TError, TData, QueryKey>,
    'queryKey' | 'queryFn'
  > {
  queryKey: QueryKey;
  url?: string;
  request?: AuthFetchOptions;
  parse?: (response: Response) => Promise<TData>;
  queryFn?: () => Promise<TData>;
}

export function useApiQuery<TData, TError = Error>({
  queryKey,
  url,
  request,
  parse,
  queryFn,
  ...options
}: ApiQueryParams<TData, TError>) {
  const fn = queryFn
    ? queryFn
    : async () => {
        if (!url) {
          throw new Error('URL is required when queryFn is not provided');
        }
        const response = await authFetch(url, request);
        const parser = parse ?? defaultParseJson<TData>;
        return parser(response);
      };

  return useQuery<TData, TError>({
    queryKey,
    queryFn: fn,
    ...options,
  });
}

interface ApiMutationParams<TData, TError, TVariables>
  extends Omit<
    UseMutationOptions<TData, TError, TVariables, unknown>,
    'mutationFn'
  > {
  mutationFn?: (variables: TVariables) => Promise<TData>;
  buildRequest?: (variables: TVariables) => {
    url: string;
    options?: AuthFetchOptions;
  };
  parse?: (response: Response) => Promise<TData>;
}

export function useApiMutation<TData, TError = Error, TVariables = void>({
  mutationFn,
  buildRequest,
  parse,
  ...options
}: ApiMutationParams<TData, TError, TVariables>) {
  const fn = mutationFn
    ? mutationFn
    : async (variables: TVariables) => {
        if (!buildRequest) {
          throw new Error('Either mutationFn or buildRequest must be provided');
        }
        const { url, options: requestOptions } = buildRequest(variables);
        const response = await authFetch(url, requestOptions);
        const parser = parse ?? defaultParseJson<TData>;
        return parser(response);
      };

  return useMutation<TData, TError, TVariables>({
    mutationFn: fn,
    ...options,
  });
}
