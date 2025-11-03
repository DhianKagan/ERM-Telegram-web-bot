// Назначение: стаб модуля pmtiles для Jest.
// Основные модули: Uint8Array.

export class Protocol {
  tile(): Promise<{
    data: Uint8Array;
    cacheControl: string | undefined;
    expires: string | undefined;
    etag: string | undefined;
  }> {
    return Promise.resolve({
      data: new Uint8Array(),
      cacheControl: undefined,
      expires: undefined,
      etag: undefined,
    });
  }
}
