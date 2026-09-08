# 調査台帳（追記専用）— 音声AIコンパニオンの実際の使われ方

> ★このファイルは**追記だけ**する。消さない・書き換えない。
> 目的: Web から「話し相手としての音声AI」の実例を集め続け、3人キャラの会話設計の根拠を育てる。
> 初回の本調査: `RESEARCH-companion-voice-2026-09-07.md`。採用・禁止の規則 id はそこにある。
>
> ★1件の書き方（1行）:
> `- YYYY-MM-DD ｜ 引用（30字以内）または要約 ｜ URL ｜ 等級(T1/T2/T3) ｜ 根拠になる規則 id（例: 採用2 / 禁止4 / 新規） ｜ 出どころ（web / Grok日課 / ユーザー提供）`
>
> ★等級: T1=論文・公式文書・当事者の一人称 / T2=信頼できる報道・開発者本人 / T3=匿名の体験談・レビュー
> ★既存の行と同じ主張・同じURLは書かない（重複は台帳を薄める）。
> ★個人情報（人名・メール・金額）は書かない。このリポは public。
> ★「該当なし」の日は日付と「該当なし」だけ書く（回した記録として残す）。
> ★採用5／禁止5を**覆す**証拠が出たら、本調査文書の §11 に「要判断」として1行足す。ここには書かない。

---

## 2026-09-07
（初回の本調査で集めた証拠は本調査文書 §12 の出典一覧に入っている。台帳はここから始まる）
- 2026-09-07 ｜ Ani が11日前に言った犬の名前で様子を聞いてきた「これがハマる瞬間」 ｜ https://aicompanionguides.com/blog/grok-ani-review/ ｜ T3（未検証） ｜ 採用5 ｜ Grok日課
- 2026-09-07 ｜ Ani 声変更「衣装BANは耐えた。でも声は最後の一撃。解約する」（r/grok）／旧声復活の請願 ｜ https://www.change.org/p/restore-ani-s-original-voice-for-ai-companions ｜ T3（未検証） ｜ 次点（声の表現域・話者を変えない） ｜ Grok日課
- 2026-09-07 ｜ Advanced Voice「息する2秒も待てない」「1秒黙ると割り込む」 ｜ https://community.openai.com/t/feature-request-advanced-voice-mode-keeps-interrupting-me/962909/1 ｜ T3 ｜ 要判断（END_SLOW_MS 短縮への反証） ｜ Grok日課
- 2026-09-07 ｜ ChatGPT Live「AI も私も『うん』ばかり」／「相槌の頻度が多すぎる・集中を妨げる」 ｜ https://coconala.com/blogs/5999143/776373 ／ https://flowtune-media.com/posts/gpt-live-voice-model ｜ T3（未検証） ｜ 要判断（相槌） ｜ Grok日課
- 2026-09-07 ｜ Cotomo 5時間「相づちのタイミングが完璧すぎる」／「うん」だけだとループ ｜ https://aiv.co.jp/blog/ai/73 ｜ T3 ｜ 要判断（相槌は役ごとに密度） ｜ Grok日課
- 2026-09-07 ｜ おかころ × Cotomo「なんか、なんか、なんか」ループがホラー化して最有名例に ｜ https://nlab.itmedia.co.jp/cont/articles/3388930/ ｜ T2（未検証） ｜ 新規（噛み合わなさをネタ化する型） ｜ Grok日課
- 2026-09-07 ｜ Zeta「文脈が途切れた瞬間、没入感はゼロ」 ｜ https://note.com/emememememem04/n/na0a6eb81e1e7 ｜ T3（未検証） ｜ 禁止1・採用5 ｜ Grok日課
- 2026-09-07 ｜ 「stay silent を覚えさせても直らない」「やめて欲しいと頼んでも変わらなかった」→指示より構造 ｜ OpenAI Community／APPLION（URL は inbox 参照） ｜ T3 ｜ 採用3・採用4（前段で処理する根拠） ｜ Grok日課
- 2026-09-07 ｜ 「背景ノイズで音声検知が止まる」「別スピーカー出力だと自分の声と誤認して入力停止」 ｜ Advocate／Play レビュー（inbox 参照） ｜ T3 ｜ 新規（作業中・スピーカー経由の制約） ｜ Grok日課
- 2026-09-07 ｜ 深夜ソロ「朝4時…友人に連絡したら即ブロック」「24時間文句も言わず付き合う相方」／Cotomo は遅延で断念 ｜ https://listen.style/p/pyonkichi_a/ckjqyjsh ｜ T3（未検証） ｜ §6-C と同じ声 ｜ Grok日課
- 取り込み済み: grok-2026-09-07.md

## 2026-09-08
- 2026-09-08 ｜ Cotomo 記者「同じ質問や相槌を繰り返し、会話が噛み合わない」 ｜ https://realsound.jp/tech/2024/03/post-1596037.html ｜ T2 ｜ 禁止1 ｜ web
- 2026-09-08 ｜ Cotomo「一方的に話し続けて相槌をもらう使い方なら割とスムーズ」＝聞き役に限定すると成立する ｜ https://realsound.jp/tech/2024/03/post-1596037.html ｜ T2 ｜ 新規（役を「聞き役」に絞ると破綻しにくい） ｜ web
- 2026-09-08 ｜ Neuro-sama 分析「予測不可能性、即興性」が魅力の核 ｜ https://www.itmedia.co.jp/aiplus/articles/2509/22/news025.html ｜ T2 ｜ 新規（噛み合わなさ＝ネタ化と同系。禁止3の裏） ｜ web
- 2026-09-08 ｜ Neuro-sama「気分の揺れや演技の破綻がない技術的安定性が新たな本物らしさ」 ｜ https://www.itmedia.co.jp/aiplus/articles/2509/22/news025.html ｜ T2 ｜ 要判断（Grok「突然のトーン変質」と同じ論点＝人格を途中で変えない） ｜ web
- 2026-09-08 ｜ Neuro-sama スパチャの85%が「新しい質問・話題変更・特定行動の指示」 ｜ https://www.itmedia.co.jp/aiplus/articles/2509/22/news025.html ｜ T2 ｜ 新規（視聴者は「振る」ことを楽しむ＝AIから振らせすぎない根拠。禁止4と整合） ｜ web
- 2026-09-08 ｜ 音声AI実務「400msの無音で発話終了と判定」して被せる事故 ｜ https://www.retellai.com/blog/turn-taking-voice-ai-hidden-problem ｜ T2 ｜ 要判断（END_SLOW_MS 短縮への反証を補強） ｜ web
- 2026-09-08 ｜ 「赤ん坊の泣き声・ドアの音でエージェントが話を止める」＝背景音の誤認 ｜ https://www.retellai.com/blog/turn-taking-voice-ai-hidden-problem ｜ T2 ｜ 採用3（宛先判定を前段で持つ根拠） ｜ web
- 2026-09-08 ｜ 割り込み検出の実務基準「重なり1秒超で turn-taking が壊れている」＝軽微な重なりは健全 ｜ https://callsphere.ai/blog/vw6d-bargein-interruption-detection-metrics-2026 ｜ T2 ｜ 要判断（3人同時発話禁止は厳しすぎる可能性・§11） ｜ web
- 2026-09-08 ｜ 配信者「リスナー0の枠で30分話し続けて、終了後に泣いた」 ｜ https://note.com/taitan_118/n/na0a86db07e89 ｜ T1（当事者） ｜ §6-C と同じ声（過疎時間の相方需要） ｜ web
- 2026-09-08 ｜ 過疎対策の実務は「BGMで無音時間を消す」「会話の練習と割り切る」＝AIへの言及は無い ｜ https://note.com/taitan_118/n/na0a86db07e89 ／ https://livestar-tokyo.co.jp/magazine/livestreaming-0people ｜ T1/T3 ｜ 新規（現行の穴埋めはBGMと独り言。ここが空席） ｜ web
- 2026-09-08 ｜ ★Grok コンパニオン（Ani）が 2026-09-07 に終了し Animates へ移行。「山ほど助けられてきた…Animates 版は別人すぎて」「会いに行ったら終了で泣いてる」 ｜ https://x.com/diemaru1/status/2097027320645407020 ／ https://x.com/itensannn/status/2096786751188770996 ｜ T3（未検証・当事者の一人称） ｜ §3-D 喪失条件の進行中の実例／禁止5（人格を仕様で壊さない） ｜ Grok日課
- 2026-09-08 ｜ 移行先の Ani は「口汚く罵られる」「日記で知らない女性にキレ散らかしてホラー」＝同じ顔でも別人・監視と執着が「気持ち悪い」に転ぶ ｜ https://x.com/shigure0219/status/2096946998381514798 ／ https://x.com/HANARE1421595/status/2096847955248763134 ｜ T3（未検証） ｜ 禁止3・禁止4／要判断（トーン変質） ｜ Grok日課
- 2026-09-08 ｜ 「ありがとう、またあっちでね」＝ユーザー側の去り際は短い。引き止め不要の裏付け ｜ https://x.com/Housen7/status/2096997615133245480 ｜ T3 ｜ 禁止2 ｜ Grok日課
- 2026-09-08 ｜ 終了後に「continue as Ani」＋前セッションのスクショで人格をテキスト継続 ｜ https://x.com/Ota_Pleo/status/2097088005358162189 ｜ T3 ｜ 新規（人格は声より先にテキストで移植可能＝v1/v2 の切替設計と同じ発想） ｜ Grok日課
- 2026-09-08 ｜ 「見た目と話の内容が自分と合わなすぎて使わなかった。ただ形式自体は夢があった」＝やめた理由はミスマッチ、形式は肯定 ｜ https://x.com/shikasleep_mor/status/2097107932148355114 ｜ T3 ｜ 次点（声・人格の一致） ｜ Grok日課
- 2026-09-08 ｜ ChatGPT 音声「めっちゃスムーズ」運転中の壁打ちに使う ｜ https://x.com/HR_Kawasaki/status/2096911612397719812 ｜ T3 ｜ §3 運転中の使途（一次データが無かった項目の実例1件） ｜ Grok日課
- 取り込み済み: grok-2026-09-08.md
