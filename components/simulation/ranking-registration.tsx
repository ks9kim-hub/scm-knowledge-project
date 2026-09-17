"use client"

import { useState } from "react"

import { Trophy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { loadSavedNickname, saveNickname, submitRanking, type RankingResult } from "@/lib/supabase/rankings"
import { cn } from "cn"

interface RankingRegistrationProps {
  score: number
  periodWeeks: number
}

export function RankingRegistration({ score, periodWeeks }: RankingRegistrationProps) {
  const [nickname, setNickname] = useState(() => loadSavedNickname())
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle")
  const [result, setResult] = useState<RankingResult | null>(null)
  const [errorMessage, setErrorMessage] = useState("")

  const trimmedNickname = nickname.trim()

  async function handleSubmit() {
    if (!trimmedNickname || status === "submitting") return
    setStatus("submitting")
    setErrorMessage("")
    try {
      const rankingResult = await submitRanking(trimmedNickname, score, periodWeeks)
      saveNickname(trimmedNickname)
      setResult(rankingResult)
      setStatus("idle")
    } catch (error) {
      setStatus("error")
      setErrorMessage(error instanceof Error ? error.message : "순위 등록 중 문제가 발생했습니다.")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <Trophy data-icon="inline-start" />
          순위 등록
        </CardTitle>
        <CardDescription>닉네임을 등록하면 전체 참가자 중 몇 등인지 확인할 수 있습니다.</CardDescription>
      </CardHeader>
      <CardContent>
        {result ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              <span className="font-medium">{trimmedNickname}</span>님, {score}점으로 전체{" "}
              {result.total.toLocaleString("ko-KR")}명 중{" "}
              <span className="font-semibold text-primary">{result.rank.toLocaleString("ko-KR")}등</span>
              입니다!
            </p>

            {result.topRankings.length > 0 && (
              <div className="overflow-x-auto">
                <p className="mb-1.5 text-xs/relaxed text-muted-foreground">
                  전체 순위표 (상위 {result.topRankings.length}명)
                </p>
                <table className="w-full min-w-[320px] border-collapse text-xs/relaxed">
                  <thead>
                    <tr>
                      <th className="p-1 text-left font-medium text-muted-foreground">등수</th>
                      <th className="p-1 text-left font-medium text-muted-foreground">닉네임</th>
                      <th className="p-1 text-right font-medium text-muted-foreground">점수</th>
                      <th className="p-1 text-right font-medium text-muted-foreground">기간</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.topRankings.map((entry, index) => {
                      const isMine = entry.nickname === trimmedNickname && entry.score === score
                      return (
                        <tr
                          key={index}
                          className={cn("border-t border-border", isMine && "bg-primary/10 font-medium")}
                        >
                          <td className="p-1">{index + 1}등</td>
                          <td className="p-1">{entry.nickname}</td>
                          <td className="p-1 text-right tabular-nums">{entry.score}점</td>
                          <td className="p-1 text-right text-muted-foreground">{entry.periodWeeks}주</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="ranking-nickname">닉네임</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="ranking-nickname"
                  value={nickname}
                  maxLength={20}
                  placeholder="예: 재고요정"
                  onChange={(event) => setNickname(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleSubmit()
                  }}
                  disabled={status === "submitting"}
                />
                <Button onClick={handleSubmit} disabled={!trimmedNickname || status === "submitting"}>
                  {status === "submitting" && <Spinner data-icon="inline-start" />}
                  등록하기
                </Button>
              </div>
              {status === "error" && <FieldDescription className="text-destructive">{errorMessage}</FieldDescription>}
            </Field>
          </FieldGroup>
        )}
      </CardContent>
    </Card>
  )
}
