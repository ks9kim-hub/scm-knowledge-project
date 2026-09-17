import { createClient } from "@supabase/supabase-js"

// Next.js는 테스트 환경(NODE_ENV=test)에서 .env.local을 일부러 불러오지 않는다. 그래서
// vitest에서 이 모듈을 import만 해도(실제 호출 없이) 값이 비어 있어 예외가 나지 않도록
// 자리표시자로 대체한다 — 실제 dev/build에서는 항상 .env.local 값이 채워진다.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "placeholder-key"
)
