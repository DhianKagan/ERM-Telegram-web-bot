/**
 * Назначение: пример страниц с графиками.
 * Основные модули: React, Next.js, Tailwind.
 */
import { mdiChartLine } from "@mdi/js";
import SectionMain from "../../_components/Section/Main";
import SectionTitleLineWithButton from "../../_components/Section/TitleLineWithButton";
import ChartLineSampleComponentBlock from "../_components/ChartLineSample/ComponentBlock";
import { Metadata } from "next";
import { getPageTitle } from "../../_lib/config";

export const metadata: Metadata = {
  title: getPageTitle("Charts"),
};

export default function ChartsPage() {
  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiChartLine} title="Charts" main />
      <ChartLineSampleComponentBlock />
    </SectionMain>
  );
}
