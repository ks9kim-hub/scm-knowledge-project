import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { ProductionWarehouseCard } from "@/components/simulation/production-warehouse-card";
import type { CorpId, Shipment } from "@/lib/simulation/types";

function shipment(id: string, destination: CorpId): Shipment {
  return { id, destination, quantity: 100, departWeek: 1, arrivalWeek: 3, status: "pending" };
}

test("같은 목적지로 가는 대기 중 출하는 하나의 박스로 합쳐 총량을 보여준다", () => {
  const pending = [shipment("a", "us"), shipment("b", "us"), shipment("c", "gb")];
  render(<ProductionWarehouseCard pending={pending} stock={1000} onCancel={() => {}} />);

  expect(screen.getByTitle(/미국로 총 200개/)).toBeInTheDocument();
  expect(screen.getByTitle(/영국로 총 100개/)).toBeInTheDocument();
});

test("베트남처럼 이름이 긴 법인도 잘리지 않고 전체 이름이 보인다", () => {
  const pending = [shipment("a", "vn")];
  render(<ProductionWarehouseCard pending={pending} stock={1000} onCancel={() => {}} />);

  expect(screen.getByText("베트남")).toBeInTheDocument();
});

test("dragover는 항상 허용되어 브라우저의 '허용 안 됨' 커서가 뜨지 않는다", () => {
  render(<ProductionWarehouseCard pending={[]} stock={1000} onCancel={() => {}} />);

  const card = screen.getByText("생산법인 · 한국").closest('[data-slot="card"]')!;
  const notCancelled = fireEvent.dragOver(card, { dataTransfer: { types: [], getData: () => "" } });
  expect(notCancelled).toBe(false);
});

test("생산법인 재고를 드래그하면 LG TV 모양을 드래그 미리보기로 쓴다", () => {
  render(<ProductionWarehouseCard pending={[]} stock={1000} onCancel={() => {}} />);

  const box = screen.getByTitle("드래그해서 판매법인 창고로 출하 (1회 100개)");
  const dataTransfer = { setData: vi.fn(), getData: vi.fn(), setDragImage: vi.fn(), effectAllowed: "" };
  fireEvent.dragStart(box, { dataTransfer });

  expect(dataTransfer.setDragImage).toHaveBeenCalled();
});

test("합쳐진 박스를 드래그하면 대표 출하 하나(100개)만 이동한다", () => {
  const pending = [shipment("a", "us"), shipment("b", "us")];
  render(<ProductionWarehouseCard pending={pending} stock={1000} onCancel={() => {}} />);

  const box = screen.getByTitle(/미국로 총 200개/);
  const dataTransfer = { setData: vi.fn(), getData: vi.fn(), setDragImage: vi.fn(), effectAllowed: "" };
  fireEvent.dragStart(box, { dataTransfer });

  expect(dataTransfer.setDragImage).toHaveBeenCalled();

  expect(dataTransfer.setData).toHaveBeenCalledWith(
    "application/x-miri-shipment",
    JSON.stringify({ type: "pending", shipmentId: "a" })
  );
});
