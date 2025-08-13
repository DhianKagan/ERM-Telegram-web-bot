// График количества задач за период
import React, { useEffect, useState } from "react";
import ReactApexChart from "react-apexcharts";
import { useTheme } from "next-themes";
import authFetch from "../utils/authFetch";

interface ChartState {
  series: { data: number[] }[];
  categories: string[];
}

export default function TasksChart() {
  const [series, setSeries] = useState<ChartState["series"]>([{ data: [] }]);
  const [categories, setCategories] = useState<ChartState["categories"]>([]);
  const { theme } = useTheme();

  useEffect(() => {
    authFetch("/api/v1/tasks/report/chart")
      .then((r) => (r.ok ? r.json() : { data: [], labels: [] }))
      .then(({ data, labels }) => {
        setSeries([{ data }]);
        setCategories(labels);
      })
      .catch(() => {});
  }, []);

  const options = {
    chart: {
      height: 200,
      type: "line",
      fontFamily: "Inter, sans-serif",
      toolbar: { show: false },
      background: theme === "dark" ? "#24303F" : undefined,
    },
    colors: ["#3C50E0"],
    stroke: { width: 2, curve: "smooth" },
    xaxis: {
      categories,
      labels: { style: { colors: theme === "dark" ? "#DEE4EE" : "#6B7280" } },
    },
    yaxis: {
      labels: { style: { colors: theme === "dark" ? "#DEE4EE" : "#6B7280" } },
    },
  };

  return (
    <ReactApexChart
      series={series}
      options={options}
      type="line"
      height={200}
    />
  );
}
