/**
 * Назначение файла: проверки работы parseGoogleAddress.
 * Основные модули: parseGoogleAddress.
 */
import parseGoogleAddress from "./parseGoogleAddress";

describe("parseGoogleAddress", () => {
  test("возвращает короткий адрес", () => {
    const url = "https://www.google.com/maps/place/Some+Place/@0,0,17z";
    expect(parseGoogleAddress(url)).toBe("Some Place");
  });

  test("возвращает пустую строку при пустой строке", () => {
    expect(parseGoogleAddress("")).toBe("");
  });

  test("возвращает исходное значение при некорректном URL", () => {
    const invalid = "not a url";
    expect(parseGoogleAddress(invalid)).toBe(invalid);
  });

  test("возвращает заглушку, когда название не найдено", () => {
    const coordsUrl = "https://www.google.com/maps/@50.4501,30.5234,17z";
    expect(parseGoogleAddress(coordsUrl)).toBe("Тока на карте");
  });
});
