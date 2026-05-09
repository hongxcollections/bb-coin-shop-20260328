import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trophy, Medal, Coins, Sparkles, Calendar, CheckCircle2, XCircle, Award, Users } from "lucide-react";

function rankBadge(r: number | null | undefined) {
  if (r === 1) return { label: "🥇 第 1 位", cls: "bg-yellow-100 text-yellow-800 border-yellow-300" };
  if (r === 2) return { label: "🥈 第 2 位", cls: "bg-gray-100 text-gray-800 border-gray-300" };
  if (r === 3) return { label: "🥉 第 3 位", cls: "bg-amber-100 text-amber-800 border-amber-300" };
  if (r) return { label: `第 ${r} 位答中`, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  return { label: "未答中", cls: "bg-rose-50 text-rose-700 border-rose-200" };
}

export default function DailyChallenge() {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const { data: today, isLoading } = trpc.dailyChallenge.today.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const { data: leaderboard } = trpc.dailyChallenge.leaderboard.useQuery({ limit: 20 });
  const { data: myStats } = trpc.dailyChallenge.myStats.useQuery(undefined, { enabled: isAuthenticated });

  const [country, setCountry] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [justSubmittedResult, setJustSubmittedResult] = useState<null | {
    isCorrect: boolean; answerRank: number | null; pointsAwarded: number;
    correctAnswer: { country: string; year: number; category: string; tolerance: number; description: string | null };
  }>(null);

  const submitMut = trpc.dailyChallenge.submitAnswer.useMutation();

  const challenge = today?.hasChallenge ? today.challenge : null;
  const myAnswer = today?.hasChallenge ? today.myAnswer : null;
  const reveal = today?.hasChallenge ? today.reveal : null;
  const winners = today?.hasChallenge ? today.winners : [];
  const stats = today?.hasChallenge ? today.stats : { total: 0, correct: 0 };
  const opts = today?.hasChallenge ? today.options : { countries: [], categories: [] };

  const alreadyAnswered = !!myAnswer;
  const showResult = justSubmittedResult || (myAnswer && reveal ? {
    isCorrect: myAnswer.isCorrect === 1,
    answerRank: myAnswer.answerRank as number | null,
    pointsAwarded: myAnswer.pointsAwarded as number,
    correctAnswer: { ...reveal },
  } : null);

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      toast.error("請先登入");
      return;
    }
    if (!challenge) return;
    if (!country || !category || !year || isNaN(Number(year))) {
      toast.error("請填齊國家、年代、種類");
      return;
    }
    setSubmitting(true);
    try {
      const r = await submitMut.mutateAsync({
        challengeId: challenge.id,
        answerCountry: country,
        answerYear: Number(year),
        answerCategory: category,
      });
      setJustSubmittedResult(r);
      utils.dailyChallenge.today.invalidate();
      utils.dailyChallenge.leaderboard.invalidate();
      utils.dailyChallenge.myStats.invalidate();
      if (r.isCorrect) {
        toast.success(`答中！+${r.pointsAwarded} 分${r.answerRank && r.answerRank <= 3 ? "（前三名！）" : ""}`);
      } else {
        toast.error("答錯啦，明日再嚟挑戰！");
      }
    } catch (e: any) {
      toast.error(e?.message || "提交失敗");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-white">
      <Header />
      <div className="container max-w-5xl py-6 md:py-10">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-b from-amber-500 via-orange-400 to-orange-200 p-6 md:p-8 mb-6 shadow-lg">
          <div className="flex items-center gap-2 text-white/90 text-sm">
            <Sparkles className="w-4 h-4" />
            <span className="whitespace-nowrap">每日一藏品挑戰</span>
            {today?.hkDate && <span className="opacity-70">· {today.hkDate}</span>}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mt-2 drop-shadow">
            估中今日錢幣 · 攞分上榜
          </h1>
          <p className="text-white/95 text-sm mt-1">
            每日一張罕見錢幣／紙幣，估中 國家 + 年代 + 種類 即得分。前三名得 🥇🥈🥉 勳章。
          </p>
          {myStats && isAuthenticated && (
            <div className="flex flex-wrap gap-2 mt-4 text-xs">
              <span className="bg-white/20 backdrop-blur text-white px-3 py-1 rounded-full">
                <Coins className="inline w-3 h-3 mr-1" /> 總積分 {myStats.totalPoints}
              </span>
              <span className="bg-white/20 backdrop-blur text-white px-3 py-1 rounded-full">
                ✓ 答中 {myStats.correctCount} / {myStats.totalAttempts}
              </span>
              <span className="bg-white/20 backdrop-blur text-white px-3 py-1 rounded-full">
                🥇 {myStats.goldCount} · 🥈 {myStats.silverCount} · 🥉 {myStats.bronzeCount}
              </span>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="text-center text-muted-foreground py-20">載入緊…</div>
        )}

        {!isLoading && !challenge && (
          <Card>
            <CardContent className="py-16 text-center">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-lg font-medium">今日尚未發佈挑戰</p>
              <p className="text-sm text-muted-foreground mt-1">明日 00:00 後再嚟睇睇～</p>
              {leaderboard && leaderboard.length > 0 && (
                <p className="text-xs text-muted-foreground mt-4">下方仍可查看排行榜</p>
              )}
            </CardContent>
          </Card>
        )}

        {!isLoading && challenge && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Image */}
            <Card className="overflow-hidden">
              <div className="aspect-square bg-stone-100 flex items-center justify-center">
                <img
                  src={challenge.imageUrl}
                  alt="今日錢幣"
                  className="w-full h-full object-contain"
                  loading="eager"
                />
              </div>
              {challenge.hint && (
                <div className="px-4 py-3 text-xs text-amber-800 bg-amber-50 border-t">
                  💡 提示：{challenge.hint}
                </div>
              )}
              <div className="px-4 py-2 text-xs text-muted-foreground border-t flex items-center gap-3">
                <Users className="w-3.5 h-3.5" /> 已 {stats.total} 人作答 · 正確 {stats.correct} 人
              </div>
            </Card>

            {/* Answer / Result */}
            <div>
              {showResult ? (
                <Card className={showResult.isCorrect ? "border-emerald-300" : "border-rose-300"}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      {showResult.isCorrect ? (
                        <><CheckCircle2 className="w-5 h-5 text-emerald-600" /> 答中！</>
                      ) : (
                        <><XCircle className="w-5 h-5 text-rose-500" /> 答錯</>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {showResult.isCorrect && (
                      <div className={`text-sm px-3 py-2 rounded-md border ${rankBadge(showResult.answerRank).cls}`}>
                        {rankBadge(showResult.answerRank).label} · 獲得 +{showResult.pointsAwarded} 分
                      </div>
                    )}
                    <div className="text-sm space-y-1.5 bg-stone-50 p-3 rounded-md">
                      <div><span className="text-muted-foreground">正確答案：</span></div>
                      <div>🌍 國家：<b>{showResult.correctAnswer.country}</b></div>
                      <div>📅 年代：<b>{showResult.correctAnswer.year}</b>（容許 ±{showResult.correctAnswer.tolerance} 年）</div>
                      <div>🪙 種類：<b>{showResult.correctAnswer.category}</b></div>
                    </div>
                    {showResult.correctAnswer.description && (
                      <div className="text-xs text-stone-600 bg-amber-50 border border-amber-200 p-3 rounded-md whitespace-pre-wrap">
                        📖 {showResult.correctAnswer.description}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground pt-2">每日凌晨 00:00（HK）會有新挑戰，記得返嚟！</p>
                  </CardContent>
                </Card>
              ) : alreadyAnswered ? (
                <Card>
                  <CardContent className="py-10 text-center">
                    <p className="text-sm text-muted-foreground">你今日已作答</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">你嘅答案</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-xs">🌍 國家</Label>
                      <Select value={country} onValueChange={setCountry}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="揀國家" /></SelectTrigger>
                        <SelectContent>
                          {opts.countries.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">📅 年代（西元年份）</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        placeholder="例如 1898"
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className="mt-1"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">系統會容許 ±5 年（每題可不同）</p>
                    </div>
                    <div>
                      <Label className="text-xs">🪙 種類</Label>
                      <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="揀種類" /></SelectTrigger>
                        <SelectContent>
                          {opts.categories.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {!isAuthenticated ? (
                      <div className="text-center py-2">
                        <Link href="/login">
                          <Button className="w-full bg-amber-500 hover:bg-amber-600">登入後作答</Button>
                        </Link>
                      </div>
                    ) : (
                      <Button
                        className="w-full bg-amber-500 hover:bg-amber-600"
                        onClick={handleSubmit}
                        disabled={submitting || !country || !category || !year}
                      >
                        {submitting ? "提交中…" : "提交答案（每日只可一次）"}
                      </Button>
                    )}
                    <p className="text-[11px] text-muted-foreground text-center">
                      評分：1st +5 · 2nd +3 · 3rd +2 · 其他答中 +1
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Today's winners */}
              {winners && winners.length > 0 && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-600" /> 今日答中名單
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {winners.map((w: any) => (
                      <div key={w.id} className="flex items-center gap-2 text-sm">
                        <span className="w-6 text-center font-mono text-xs">
                          {w.rank === 1 ? "🥇" : w.rank === 2 ? "🥈" : w.rank === 3 ? "🥉" : `${w.rank}.`}
                        </span>
                        {w.userPhoto && (
                          <img src={w.userPhoto} alt="" className="w-6 h-6 rounded-full object-cover" />
                        )}
                        <span className="flex-1 truncate">{w.userName || "（會員）"}</span>
                        <span className="text-amber-700 font-medium text-xs">+{w.pointsAwarded}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-600" /> 累計排行榜（Top 20）
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!leaderboard || leaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">暫無排名，快啲嚟搶 first blood！</p>
            ) : (
              <div className="divide-y">
                {leaderboard.map((u: any, idx: number) => {
                  const isMe = user?.id === u.userId;
                  return (
                    <div key={u.userId} className={`flex items-center gap-3 py-2 ${isMe ? "bg-amber-50 -mx-2 px-2 rounded" : ""}`}>
                      <span className="w-7 text-center font-mono text-sm">
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`}
                      </span>
                      {u.userPhoto ? (
                        <img src={u.userPhoto} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-stone-200" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{u.userName || "（會員）"} {isMe && <span className="text-xs text-amber-600">(你)</span>}</div>
                        <div className="text-[11px] text-muted-foreground">
                          答中 {u.correctCount} 次 · 🥇{u.goldCount} 🥈{u.silverCount} 🥉{u.bronzeCount}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-amber-700 font-bold">{u.totalPoints}</div>
                        <div className="text-[10px] text-muted-foreground">分</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
