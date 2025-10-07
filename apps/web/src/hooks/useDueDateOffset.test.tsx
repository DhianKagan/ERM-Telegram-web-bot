/** @jest-environment jsdom */
// Назначение файла: проверяет, что useDueDateOffset сохраняет выбранный дедлайн.
// Основные модули: React, react-hook-form, @testing-library/react, useDueDateOffset.
import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { useForm } from "react-hook-form";
import useDueDateOffset from "./useDueDateOffset";

describe("useDueDateOffset", () => {
  it("не перезаписывает вручную установленный срок при отправке", async () => {
    const submitSpy = jest.fn();

    const Wrapper: React.FC = () => {
      const { register, setValue, watch, handleSubmit } = useForm<{
        startDate?: string;
        dueDate?: string;
      }>({
        defaultValues: { startDate: "", dueDate: "" },
      });
      const formatInputDate = React.useCallback(
        (value: Date) => value.toISOString().slice(0, 16),
        [],
      );
      const { handleDueDateChange } = useDueDateOffset({
        startDateValue: watch("startDate"),
        setValue,
        defaultOffsetMs: 60 * 60 * 1000,
        formatInputDate,
      });
      return (
        <form onSubmit={handleSubmit(submitSpy)}>
          <input
            data-testid="start"
            id="test-start-date"
            {...register("startDate")}
          />
          <input
            data-testid="due"
            id="test-due-date"
            {...register("dueDate", { onChange: handleDueDateChange })}
          />
          <button type="submit">Отправить</button>
        </form>
      );
    };

    const { getByTestId, getByText } = render(<Wrapper />);
    fireEvent.change(getByTestId("start"), {
      target: { value: "2024-02-01T09:00" },
    });
    fireEvent.change(getByTestId("due"), {
      target: { value: "2024-02-02T12:30" },
    });
    fireEvent.click(getByText("Отправить"));

    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1));
    expect(submitSpy.mock.calls[0][0]).toMatchObject({
      dueDate: "2024-02-02T12:30",
    });
  });
});
