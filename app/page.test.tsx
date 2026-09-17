import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import Home from "@/app/page";

test("시작 화면에서 기간을 고르고 시작하면 재고 보드로 넘어간다", () => {
  render(<Home />);

  expect(screen.getByText("재고밸런스 마스터")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "시작하기" }));

  expect(screen.getByText(/주차 \/ 총/)).toBeInTheDocument();
});

test("가장 짧은 1개월 기간을 골라 마지막 주까지 넘기면 되짚기 화면으로 끝난다", () => {
  render(<Home />);

  fireEvent.click(screen.getByRole("button", { name: "👶 입문자 모드 (1개월)" }));
  fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
  for (let i = 0; i < 4; i++) {
    fireEvent.click(screen.getByRole("button", { name: "다음 주" }));
  }

  expect(screen.getByText("주차별 되짚기")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "새 판 시작하기" })).toBeInTheDocument();
});
