/** @jest-environment jsdom */
// Назначение файла: проверяет сброс поиска при переключении вкладок настроек.
// Основные модули: React, @testing-library/react, CollectionsPage.
import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import CollectionsPage from "./CollectionsPage";
import type { CollectionItem } from "../../services/collections";
import { fetchCollectionItems } from "../../services/collections";

jest.mock("../../services/collections", () => ({
  fetchCollectionItems: jest.fn(),
  createCollectionItem: jest.fn(),
  updateCollectionItem: jest.fn(),
  removeCollectionItem: jest.fn(),
}));

jest.mock("../../services/users", () => ({
  fetchUsers: jest.fn().mockResolvedValue([]),
  createUser: jest.fn(),
  updateUser: jest.fn(),
}));

jest.mock("../../services/fleets", () => ({
  fetchFleetVehicles: jest
    .fn()
    .mockResolvedValue({ fleet: { id: "", name: "" }, vehicles: [] }),
  patchFleetVehicle: jest.fn(),
  replaceFleetVehicle: jest.fn(),
}));

jest.mock("./FleetVehiclesGrid", () => () => <div data-testid="fleet-grid" />);
jest.mock("./VehicleEditDialog", () => () => <div data-testid="vehicle-dialog" />);

jest.mock(
  "../../components/Breadcrumbs",
  () =>
    ({ items }: { items: any[] }) => (
      <nav data-testid="breadcrumbs">{items.length}</nav>
    ),
);

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

jest.mock("./CollectionForm", () => ({ form }: { form: { name: string } }) => (
  <div data-testid="collection-form">{form?.name}</div>
));

jest.mock("./UserForm", () => ({ form }: { form: { name: string } }) => (
  <div data-testid="user-form">{form?.name}</div>
));

describe("CollectionsPage", () => {
  const mockedFetch = fetchCollectionItems as jest.MockedFunction<
    typeof fetchCollectionItems
  >;
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
  };

  beforeEach(() => {
    mockedFetch.mockReset();
    mockedFetch.mockImplementation(async (type: string, search = "") => {
      const byType = dataset[type] ?? {};
      const key = search || "";
      return byType[key] ?? byType[""] ?? { items: [], total: 0 };
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("возвращает список при смене вкладки, не перенося предыдущий фильтр", async () => {
    render(<CollectionsPage />);

    await screen.findByText("Главный департамент");

    const searchInput = screen.getByPlaceholderText("Поиск");
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
      "Поиск",
    ) as HTMLInputElement;
    expect(activeSearch.value).toBe("");
  });

  it("показывает сообщение об отсутствии доступа к автопарку", async () => {
    mockedFetch.mockImplementation(async (type: string, search = "") => {
      if (type === "fleets") {
        throw new Error("Недостаточно прав для просмотра автопарка");
      }
      const byType = dataset[type] ?? {};
      const key = search || "";
      return byType[key] ?? byType[""] ?? { items: [], total: 0 };
    });

    render(<CollectionsPage />);

    await screen.findByText("Главный департамент");

    const fleetsTab = screen.getByRole("tab", { name: "Автопарк" });
    fireEvent.click(fleetsTab);

    await waitFor(() => {
      expect(
        screen.queryByText("Недостаточно прав для просмотра автопарка"),
      ).not.toBeNull();
    });
  });
});
