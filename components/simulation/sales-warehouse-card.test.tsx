import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { SalesWarehouseCard } from "@/components/simulation/sales-warehouse-card";
import type { CorpMaster, CorpWeekRecord } from "@/lib/simulation/types";

const corp: CorpMaster = { id: "kr", name: "한국", leadTimeWeeks: 0, baseWeeklyForecast: 420, startingDio: 14 };
const record: CorpWeekRecord = { stock: 900, forecast: 400, dio: 14, status: "ok" };

test("dragover는 항상 허용되어 브라우저의 '허용 안 됨' 커서가 뜨지 않는다", () => {
  // dataTransfer.types로 우리 출하 드래그인지 미리 걸러내면, 브라우저에 따라 dragover 시점에
  // 커스텀 MIME 타입이 안 읽혀 preventDefault가 호출되지 않고 드롭 자체가 막히는 문제가 있었다.
  // dragover는 무조건 허용하고, 실제 판정은 항상 안정적인 drop 시점에서 해야 한다.
  render(
    <SalesWarehouseCard
      corp={corp}
      record={record}
      upcomingForecast={[]}
      nextWeekIncoming={0}
      incomingByWeek={[]}
      onAllocate={() => {}}
      onReassign={() => {}}
    />
  );

  const card = screen.getByText("한국").closest('[data-slot="card"]')!;
  const notCancelled = fireEvent.dragOver(card, { dataTransfer: { types: [], getData: () => "" } });
  expect(notCancelled).toBe(false);
});

test("생산법인 드래그를 놓으면 onAllocate가 호출된다", () => {
  const onAllocate = vi.fn();
  render(
    <SalesWarehouseCard
      corp={corp}
      record={record}
      upcomingForecast={[]}
      nextWeekIncoming={0}
      incomingByWeek={[]}
      onAllocate={onAllocate}
      onReassign={() => {}}
    />
  );

  const card = screen.getByText("한국").closest('[data-slot="card"]')!;
  fireEvent.drop(card, {
    dataTransfer: { getData: () => JSON.stringify({ type: "production" }) },
  });

  expect(onAllocate).toHaveBeenCalledWith("kr");
});
