/** @jest-environment jsdom */
// Назначение файла: проверяет сброс поиска при переключении вкладок настроек.
// Основные модули: React, @testing-library/react, CollectionsPage.
import React from "react";
import "@testing-library/jest-dom";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import CollectionsPage from "./CollectionsPage";
import { MemoryRouter } from "react-router-dom";
import type { CollectionItem } from "../../services/collections";
import {
  fetchCollectionItems,
  fetchAllCollectionItems,
  createCollectionItem,
} from "../../services/collections";
import { settingsUserColumns } from "../../columns/settingsUserColumns";
import { settingsEmployeeColumns } from "../../columns/settingsEmployeeColumns";
import { fetchUsers } from "../../services/users";
import type { User } from "../../types/user";

jest.mock("../../services/roles", () => ({
  fetchRoles: jest.fn().mockResolvedValue([]),
}));

const extractHeaderText = (header: unknown): string => {
  if (typeof header === "string") return header;
  if (React.isValidElement(header)) {
    const element = header as React.ReactElement;
    return React.Children.toArray(element.props.children)
      .map((child) => (typeof child === "string" ? child : ""))
      .join("");
  }
  return "";
};

jest.mock("../../services/collections", () => ({
  fetchCollectionItems: jest.fn(),
  fetchAllCollectionItems: jest.fn(),
  createCollectionItem: jest.fn(),
  updateCollectionItem: jest.fn(),
  removeCollectionItem: jest.fn(),
}));

jest.mock("../../services/users", () => ({
  fetchUsers: jest.fn().mockResolvedValue([]),
  createUser: jest.fn(),
  updateUser: jest.fn(),
}));

jest.mock("./FleetVehiclesTab", () => () => <div data-testid="fleet-tab" />);

jest.mock("../../components/DataTable", () => ({
  __esModule: true,
  default: ({
    data,
    columns = [],
    onRowClick,
  }: {
    data: Array<Record<string, unknown>>;
    columns?: Array<{
      header?: React.ReactNode;
      accessorKey?: string;
      cell?: (context: {
        row: { original: Record<string, unknown> };
        getValue: () => unknown;
      }) => React.ReactNode;
    }>;
    onRowClick?: (row: Record<string, unknown>) => void;
  }) => (
    <div data-testid="data-table">
      <div data-testid="data-table-headers">
        {columns.map((column, index) => (
          <span data-testid="column-header" key={`header-${index}`}>
            {extractHeaderText(column.header)}
          </span>
        ))}
      </div>
      <div data-testid="data-table-rows">
        {data.map((row, rowIndex) => (
          <div
            key={rowIndex}
            role="button"
            tabIndex={0}
            data-testid={`data-table-row-${rowIndex}`}
            onClick={() => onRowClick?.(row)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onRowClick?.(row);
              }
            }}
          >
            {columns.map((column, columnIndex) => {
              const key = `cell-${rowIndex}-${columnIndex}`;
              if (typeof column.cell === "function") {
                const value = column.cell({
                  row: { original: row },
                  getValue: () =>
                    column.accessorKey
                      ? (row as Record<string, unknown>)[column.accessorKey]
                      : undefined,
                });
                return (
                  <span data-testid={key} key={key}>
                    {value}
                  </span>
                );
              }
              if (column.accessorKey) {
                return (
                  <span data-testid={key} key={key}>
                    {(row as Record<string, unknown>)[
                      column.accessorKey
                    ] as React.ReactNode}
                  </span>
                );
              }
              return <span data-testid={key} key={key} />;
            })}
          </div>
        ))}
      </div>
    </div>
  ),
}));

jest.mock("../../components/Tabs", () => {
  type TabsContextValue = {
    value: string;
    onValueChange: (next: string) => void;
  };

  const TabsContext = React.createContext<TabsContextValue>({
    value: "",
    onValueChange: () => {},
  });

  const Tabs = ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (next: string) => void;
    children: React.ReactNode;
  }) => (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div>{children}</div>
    </TabsContext.Provider>
  );

  const TabsList = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );

  const TabsTrigger = ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => {
    const ctx = React.useContext(TabsContext);
    const isActive = ctx.value === value;
    return (
      <button
        type="button"
        role="tab"
        aria-selected={isActive}
        onClick={() => ctx.onValueChange(value)}
      >
        {children}
      </button>
    );
  };

  const TabsContent = ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => {
    const ctx = React.useContext(TabsContext);
    if (ctx.value !== value) return null;
    return (
      <div role="tabpanel" data-testid={`tab-content-${value}`}>
        {children}
      </div>
    );
  };

  return { Tabs, TabsList, TabsTrigger, TabsContent };
});

jest.mock("../../components/EmployeeCardForm", () => () => <div />);

jest.mock("../../components/Modal", () => ({
  __esModule: true,
  default: ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
  }) => (open ? <div data-testid="modal">{children}</div> : null),
}));

jest.mock("./CollectionForm", () => ({
  __esModule: true,
  default: ({
    form,
    onChange,
    onSubmit,
    readonly,
  }: {
    form: { _id?: string; name: string; value?: string };
    onChange: (next: { _id?: string; name: string; value?: string }) => void;
    onSubmit: () => void;
    readonly?: boolean;
    readonlyNotice?: string;
  }) => (
    <form
      data-testid="collection-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!readonly) onSubmit();
      }}
    >
      <input
        data-testid="collection-name"
        id="test-collection-name"
        name="collectionName"
        value={form?.name ?? ""}
        onChange={(event) =>
          onChange({ ...(form ?? { name: "", value: "" }), name: event.target.value })
        }
        disabled={readonly}
      />
      <input
        data-testid="collection-value"
        id="test-collection-value"
        name="collectionValue"
        value={form?.value ?? ""}
        onChange={(event) =>
          onChange({ ...(form ?? { name: "", value: "" }), value: event.target.value })
        }
        disabled={readonly}
      />
      <button type="submit">Сохранить</button>
    </form>
  ),
}));

jest.mock("./UserForm", () => ({ form }: { form: { name: string } }) => (
  <div data-testid="user-form">{form?.name}</div>
));

describe("CollectionsPage", () => {
  const mockedFetch = fetchCollectionItems as jest.MockedFunction<
    typeof fetchCollectionItems
  >;
  const mockedFetchAll = fetchAllCollectionItems as jest.MockedFunction<
    typeof fetchAllCollectionItems
  >;
  const mockedCreate = createCollectionItem as jest.MockedFunction<
    typeof createCollectionItem
  >;
  const mockedFetchUsers = fetchUsers as jest.MockedFunction<typeof fetchUsers>;
  const dataset: Record<
    string,
    Record<string, { items: CollectionItem[]; total: number }>
  > = {
    departments: {
      "": {
        items: [
          {
            _id: "dep-1",
            type: "departments",
            name: "Главный департамент",
            value: "",
          },
        ],
        total: 1,
      },
      финансы: {
        items: [
          {
            _id: "dep-2",
            type: "departments",
            name: "Финансовый департамент",
            value: "",
          },
        ],
        total: 1,
      },
    },
    divisions: {
      "": {
        items: [
          {
            _id: "div-1",
            type: "divisions",
            name: "Отдел снабжения",
            value: "",
          },
        ],
        total: 1,
      },
      финансы: { items: [], total: 0 },
    },
    employees: {
      "": {
        items: [
          {
            _id: "emp-1",
            type: "employees",
            name: "Иван Тестовый",
            value: JSON.stringify({
              telegram_id: 101,
              telegram_username: "testuser",
              phone: "+380000000000",
              email: "test@example.com",
              departmentId: "dep-1",
            }),
            meta: {
              departmentId: "dep-1",
              divisionId: "div-1",
            },
          },
        ],
        total: 1,
      },
    },
  };

  beforeEach(() => {
    mockedFetch.mockReset();
    mockedFetchAll.mockReset();
    mockedCreate.mockReset();
    mockedFetchUsers.mockReset();
    mockedFetch.mockImplementation(async (type: string, search = "") => {
      const byType = dataset[type] ?? {};
      const key = search || "";
      return byType[key] ?? byType[""] ?? { items: [], total: 0 };
    });
    mockedFetchAll.mockImplementation(async (type: string) => {
      const byType = dataset[type] ?? {};
      const defaultEntry = byType[""] ?? { items: [] };
      return (defaultEntry.items ?? []) as CollectionItem[];
    });
    mockedFetchUsers.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderCollectionsPage = () =>
    render(
      <MemoryRouter initialEntries={["/cp/settings"]}>
        <CollectionsPage />
      </MemoryRouter>,
    );

  it("возвращает список при смене вкладки, не перенося предыдущий фильтр", async () => {
    renderCollectionsPage();

    await screen.findByText("Главный департамент");

    const searchInput = screen.getByPlaceholderText("Название или значение");
    fireEvent.change(searchInput, { target: { value: "финансы" } });
    fireEvent.click(screen.getByText("Искать"));

    await waitFor(() =>
      expect(mockedFetch).toHaveBeenCalledWith("departments", "финансы", 1, 10),
    );

    const divisionsTab = screen.getByRole("tab", { name: "Отдел" });
    fireEvent.click(divisionsTab);

    await waitFor(() =>
      expect(mockedFetch).toHaveBeenCalledWith("divisions", "", 1, 10),
    );

    await screen.findByText("Отдел снабжения");

    const divisionsPanel = screen.getByTestId("tab-content-divisions");
    const activeSearch = within(divisionsPanel).getByPlaceholderText(
      "Название или значение",
    ) as HTMLInputElement;
    expect(activeSearch.value).toBe("");
  });

  it("сохраняет все отделы департамента после переключения вкладок", async () => {
    const department: CollectionItem = {
      _id: "dep-full",
      type: "departments",
      name: "Департамент развития",
      value: "div-legacy,div-new",
    };
    const legacyDivision: CollectionItem = {
      _id: "div-legacy",
      type: "divisions",
      name: "Отдел Легаси",
      value: "dep-full",
      meta: { legacy: true },
    };
    const newDivision: CollectionItem = {
      _id: "div-new",
      type: "divisions",
      name: "Отдел Новый",
      value: "dep-full",
    };
    mockedFetchAll.mockImplementation(async (type: string) => {
      if (type === "departments") return [department];
      if (type === "divisions") return [legacyDivision, newDivision];
      if (type === "positions") return [];
      return [];
    });
    mockedFetch.mockImplementation(async (type: string) => {
      if (type === "departments") {
        return { items: [department], total: 1 };
      }
      if (type === "divisions") {
        return { items: [newDivision], total: 2 };
      }
      return { items: [], total: 0 };
    });

    renderCollectionsPage();

    const departmentsPanel = await screen.findByTestId(
      "tab-content-departments",
    );
    const departmentRow = within(departmentsPanel).getByTestId(
      "data-table-row-0",
    );
    expect(departmentRow).toHaveTextContent("Отдел Легаси");
    expect(departmentRow).toHaveTextContent("Отдел Новый");

    fireEvent.click(screen.getByRole("tab", { name: "Отдел" }));

    await screen.findByText("Отдел Новый");

    fireEvent.click(screen.getByRole("tab", { name: "Департамент" }));

    const departmentsPanelAfter = await screen.findByTestId(
      "tab-content-departments",
    );
    const departmentRowAfter = within(departmentsPanelAfter).getByTestId(
      "data-table-row-0",
    );
    expect(
      within(departmentRowAfter).queryByText("div-legacy"),
    ).not.toBeInTheDocument();
    expect(departmentRowAfter).toHaveTextContent("Отдел Легаси");
    expect(departmentRowAfter).toHaveTextContent("Отдел Новый");

    fireEvent.click(departmentRowAfter);

    const modal = await screen.findByTestId("modal");
    const badgeTexts = within(modal)
      .getAllByText(/Отдел/, { selector: "span" })
      .map((element) => element.textContent?.trim());
    expect(badgeTexts).toEqual(
      expect.arrayContaining(["Отдел Легаси", "Отдел Новый"]),
    );
  });

  it("отображает отделы из JSON-значения и предупреждает о дубликатах", async () => {
    const jsonDepartment: CollectionItem = {
      _id: "dep-json",
      type: "departments",
      name: "JSON департамент",
      value: '["div-json-1","div-json-2"]',
    };
    const conflictingDepartment: CollectionItem = {
      _id: "dep-conflict",
      type: "departments",
      name: "Конфликтующий департамент",
      value: "div-json-2",
    };
    const divisions: CollectionItem[] = [
      {
        _id: "div-json-1",
        type: "divisions",
        name: "Отдел JSON 1",
        value: "dep-json",
      },
      {
        _id: "div-json-2",
        type: "divisions",
        name: "Отдел JSON 2",
        value: "dep-conflict",
      },
    ];

    mockedFetchAll.mockImplementation(async (type: string) => {
      if (type === "departments") {
        return [jsonDepartment, conflictingDepartment];
      }
      if (type === "divisions") {
        return divisions;
      }
      if (type === "positions") {
        return [];
      }
      return [];
    });

    mockedFetch.mockImplementation(async (type: string) => {
      if (type === "departments") {
        return {
          items: [jsonDepartment, conflictingDepartment],
          total: 2,
        };
      }
      if (type === "divisions") {
        return { items: divisions, total: divisions.length };
      }
      return { items: [], total: 0 };
    });

    renderCollectionsPage();

    const departmentsPanel = await screen.findByTestId(
      "tab-content-departments",
    );
    const departmentRow = within(departmentsPanel).getByTestId(
      "data-table-row-0",
    );
    expect(departmentRow).toHaveTextContent("Отдел JSON 1");
    expect(departmentRow).toHaveTextContent("Отдел JSON 2");

    fireEvent.click(departmentRow);

    const modal = await screen.findByTestId("modal");
    const badgeTexts = within(modal)
      .getAllByText(/Отдел JSON/, { selector: "span" })
      .map((element) => element.textContent?.trim());
    expect(badgeTexts).toEqual(
      expect.arrayContaining(["Отдел JSON 1", "Отдел JSON 2"]),
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "Обнаружены дублирующиеся отделы: Отдел JSON 2.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("открывает вкладку автопарка", async () => {
    mockedFetch.mockImplementation(async (type: string, search = "") => {
      if (type === "fleets") {
        throw new Error("Недостаточно прав для просмотра автопарка");
      }
      const byType = dataset[type] ?? {};
      const key = search || "";
      return byType[key] ?? byType[""] ?? { items: [], total: 0 };
    });

    renderCollectionsPage();

    await screen.findByText("Главный департамент");

    const fleetsTab = screen.getByRole("tab", { name: "Автопарк" });
    fireEvent.click(fleetsTab);

    await screen.findByTestId("fleet-tab");
  });

  it("отображает колонки пользователей во вкладке 'Пользователь'", async () => {
    renderCollectionsPage();

    await screen.findByText("Главный департамент");

    fireEvent.click(screen.getByRole("tab", { name: "Пользователь" }));

    const usersPanel = await screen.findByTestId("tab-content-users");

    await waitFor(() =>
      expect(within(usersPanel).getAllByTestId("column-header").length).toBeGreaterThan(0),
    );

    const headerTexts = within(usersPanel)
      .getAllByTestId("column-header")
      .map((element) => element.textContent ?? "");

    const expectedHeaders = settingsUserColumns.map((column) =>
      extractHeaderText(column.header),
    );

    expect(headerTexts).toEqual(expectedHeaders);
  });

  it("отображает колонки сотрудников во вкладке 'Сотрудник'", async () => {
    renderCollectionsPage();

    await screen.findByText("Главный департамент");

    fireEvent.click(screen.getByRole("tab", { name: "Сотрудник" }));

    const employeesPanel = await screen.findByTestId("tab-content-employees");

    await waitFor(() =>
      expect(within(employeesPanel).getAllByTestId("column-header").length).toBeGreaterThan(0),
    );

    const headerTexts = within(employeesPanel)
      .getAllByTestId("column-header")
      .map((element) => element.textContent ?? "");

    const expectedHeaders = settingsEmployeeColumns.map((column) =>
      extractHeaderText(column.header),
    );

    expect(headerTexts).toEqual(expectedHeaders);
  });

  it("использует данные коллекции для заполнения карточки сотрудника", async () => {
    mockedFetchUsers.mockResolvedValueOnce([
      { telegram_id: 101, username: "101" } as User,
    ]);

    renderCollectionsPage();

    await screen.findByText("Главный департамент");

    fireEvent.click(screen.getByRole("tab", { name: "Сотрудник" }));

    const employeesPanel = await screen.findByTestId("tab-content-employees");

    await waitFor(() =>
      expect(
        within(employeesPanel).getByText("testuser"),
      ).toBeInTheDocument(),
    );
    expect(
      within(employeesPanel).getByText("+380000000000"),
    ).toBeInTheDocument();
    expect(
      within(employeesPanel).getByText("test@example.com"),
    ).toBeInTheDocument();
  });

  it("отображает настройки задач во вкладке 'Задачи'", async () => {
    const fieldItems: CollectionItem[] = [
      {
        _id: "task-field-title",
        type: "task_fields",
        name: "title",
        value: "Название",
        meta: {
          defaultLabel: "Название",
          fieldType: "text",
          order: 0,
          virtual: false,
        },
      },
    ];
    const typeItems: CollectionItem[] = [
      {
        _id: "task-type-perform",
        type: "task_types",
        name: "Выполнить",
        value: "Выполнить",
        meta: {
          defaultLabel: "Выполнить",
          order: 0,
          tg_theme_url: "https://t.me/c/2705661520/627",
          tg_chat_id: "-1002705661520",
          tg_topic_id: 627,
          virtual: false,
        },
      },
    ];

    mockedFetchAll.mockImplementation(async (type: string) => {
      if (type === "task_fields") return fieldItems;
      if (type === "task_types") return typeItems;
      const byType = dataset[type] ?? {};
      const defaultEntry = byType[""] ?? { items: [] };
      return (defaultEntry.items ?? []) as CollectionItem[];
    });

    renderCollectionsPage();

    await screen.findByText("Главный департамент");

    fireEvent.click(screen.getByRole("tab", { name: "Задачи" }));

    await waitFor(() =>
      expect(mockedFetchAll).toHaveBeenCalledWith("task_fields"),
    );

    const tasksPanel = await screen.findByTestId("tab-content-tasks");
    expect(
      within(tasksPanel).getByLabelText("Название типа Выполнить"),
    ).toBeInTheDocument();
    const themeInputs = within(tasksPanel).getAllByPlaceholderText(
      "https://t.me/c/...",
    );
    expect(themeInputs).toHaveLength(2);
  });

  it("показывает фактический логин в таблице и карточке пользователя", async () => {
    const user: User = {
      telegram_id: 101,
      telegram_username: "operator",
      username: "101",
      name: "Оператор",
      role: "user",
    };
    mockedFetchUsers.mockResolvedValueOnce([user]);

    renderCollectionsPage();

    await screen.findByText("Главный департамент");

    fireEvent.click(screen.getByRole("tab", { name: "Пользователь" }));

    const row = await screen.findByTestId("data-table-row-0");
    expect(within(row).getByText("operator")).toBeInTheDocument();

    fireEvent.click(row);

    const modal = await screen.findByTestId("modal");
    expect(within(modal).getByText("operator")).toBeInTheDocument();
  });

  it("возвращает пользователя при поиске по фактическому логину", async () => {
    const user: User = {
      telegram_id: 202,
      telegram_username: "operator",
      username: "202",
      name: "Оператор",
      role: "user",
    };
    mockedFetchUsers.mockResolvedValueOnce([user]);

    renderCollectionsPage();

    await screen.findByText("Главный департамент");

    fireEvent.click(screen.getByRole("tab", { name: "Пользователь" }));

    const usersPanel = await screen.findByTestId("tab-content-users");
    const rowsContainer = within(usersPanel).getByTestId("data-table-rows");

    await waitFor(() => expect(rowsContainer.children).toHaveLength(1));

    const searchInput = within(usersPanel).getByPlaceholderText("Имя или логин");
    fireEvent.change(searchInput, { target: { value: "202" } });

    fireEvent.click(within(usersPanel).getByRole("button", { name: "Искать" }));

    await waitFor(() => expect(rowsContainer.children).toHaveLength(1));
    expect(within(usersPanel).getByText("operator")).toBeInTheDocument();
  });

  it("находит сотрудника по фамилии из карточки", async () => {
    mockedFetchAll.mockImplementation(async (type: string) => {
      if (type === "employees") {
        return [
          {
            _id: "emp-card",
            type: "employees",
            name: "",
            value: JSON.stringify({
              telegram_id: 404,
              username: "petrov",
              firstName: "Иван",
              lastName: "Петров",
            }),
            meta: {
              departmentId: "dep-1",
              divisionId: "div-1",
            },
          },
        ] as CollectionItem[];
      }
      const byType = dataset[type] ?? {};
      const defaultEntry = byType[""] ?? { items: [] };
      return (defaultEntry.items ?? []) as CollectionItem[];
    });

    mockedFetchUsers.mockResolvedValueOnce([
      { telegram_id: 404, username: "404", role: "user" } as User,
    ]);

    renderCollectionsPage();

    await screen.findByText("Главный департамент");

    fireEvent.click(screen.getByRole("tab", { name: "Сотрудник" }));

    const employeesPanel = await screen.findByTestId("tab-content-employees");
    const rowsContainer = within(employeesPanel).getByTestId("data-table-rows");

    await waitFor(() => expect(rowsContainer.children).toHaveLength(1));

    const searchInput = within(employeesPanel).getByPlaceholderText("Имя или логин");
    fireEvent.change(searchInput, { target: { value: "Петров" } });

    fireEvent.click(within(employeesPanel).getByRole("button", { name: "Искать" }));

    await waitFor(() => expect(rowsContainer.children).toHaveLength(1));
    expect(within(employeesPanel).getByText("Петров Иван")).toBeInTheDocument();
  });

  it("показывает подсказку, если департамент сохраняют без отделов", async () => {
    const { parseErrorMessage } = jest.requireActual(
      "../../services/collections",
    ) as typeof import("../../services/collections");
    mockedCreate.mockImplementationOnce(async () => {
      const message = parseErrorMessage(
        400,
        JSON.stringify({ errors: [{ msg: "Значение элемента обязательно" }] }),
        { collectionType: "departments" },
      );
      throw new Error(message);
    });

    renderCollectionsPage();

    await screen.findByText("Главный департамент");

    const addButtons = screen.getAllByRole("button", { name: "Добавить" });
    fireEvent.click(addButtons[0]);

    const form = await screen.findByTestId("collection-form");
    const nameInput = within(form).getByTestId("collection-name");
    fireEvent.change(nameInput, { target: { value: "Новый департамент" } });

    fireEvent.submit(form);

    await screen.findByText("Добавьте хотя бы один отдел в департамент");
  });
});
