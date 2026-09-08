# 調査: 音声AIコンパニオンの「実際の使われ方」（2026-09-07・初回）

> ★読み方
> - **★** = 検証済み（T1 出典、または T2+T3 が独立に一致）。★の行には URL がある。「同上」「（上）」「行N の URL」は同じ節の直前・指定行の URL を指す。
> - **実例** と **推測** は分けてある。推測は §11 だけに置く。
> - 出典の等級: T1=論文・公式文書・当事者の一人称 / T2=信頼できる報道・開発者本人 / T3=匿名の体験談・レビュー
> - このリポは public。個人情報（人名・メール・金額）は書かない。
>
> ★既出（ここでは参照のみ・再調査していない）
> - Grok 音声の実会話の読み解き → `REFERENCE-grok-voice-2026-09-07.md`（判定一語→理由→注意点→次を聞く／店員への注文にも返す／相槌で再生成／同じ文の繰り返し）
> - 真因「文脈を持っていない」 → `NEXT-SESSION.md`
> - 固定済みの設計（1〜3文48字・cheer/chat/blunt・6項目ゲート・3人同時禁止・沈黙45〜90秒）→ `CONVERSATION-DESIGN.md`
> - Replika の仕様変更を「死」と語った分析、Cotomo の一行 → `src/lib/charaPersona.v1.js` 冒頭
>
> ★きっかけ: ユーザーの言葉「これは自分の会話の一例。声色を変えてキャバ嬢に接するみたいにする人もいる。スコープを大きく広げて調査して」
> ★分担: X の生投稿は Grok（ユーザーが並行して投げた）。ここは web / 論文 / 公式 doc / レビュー / 実験。
> ★続き: 日々の追加は `RESEARCH-LEDGER.md`（追記専用）。

---

## 1. 結論先出し: 採用5・禁止5

★の条件: 種類の違う出典が2つ以上（T1 単独も可）。証拠は §番号で指す。

### 採用（3人キャラに今すぐ入れる）
| id | 規則 | 根拠 |
|---|---|---|
| 採用1 | ★**判定一語で始め、理由、1〜3文で止める。**「いいのだ。」「無理。」のように最初の句点までを短く | §8-A の全社が 1〜3文（Realtime/Hume/Vapi/Retell/ElevenLabs T1）、§7-A 4位「長い」、§7-D 48字支持、REFERENCE-grok の骨格 |
| 採用2 | ★**崩れた音声認識は、欠陥に触れず最尤の意図に答える。相手の言葉を繰り返さない。** | §8-A Hume default_prompt "without mentioning the flaw"（T1）、§7-A 8位「自分が投げたものの変形」（T3）、NEXT-SESSION の真因 |
| 採用3 | ★**自分宛てでない言葉（店員・同室の他人・場の雑談）には黙り、続きから再開する。**プロンプトではなく前段（宛先判定）で落とす | §8-A OpenAI Model Spec の模範解 "[pauses to listen]"（T1）、§8-C「prompt に書いた例は無い＝前段で処理」、REFERENCE-grok 2-1（Grok は店員にも返した） |
| 採用4 | ★**相槌・短い声（うん・へえ・ふぅ・2文字以下）では返事を作り直さない。**入力側の辞書フィルタで LLM に渡さない | §8-A Zenn potz の実装（T2）、§3-C Cotomo「うん」だけでループ（T3）、REFERENCE-grok 2-2（相槌のたびに40回再生成）、§5-A 日本語は2.5〜3.5秒に1回相槌が入る（T1） |
| 採用5 | ★**前に話したことを1つだけ拾って言及する（記憶）。**多く並べない | §7-B ComPeer「昨日の話を覚えていて励ました」高評価（T1）、§7-A 1位「記憶がない」が最大の離脱要因、§2-A 顧客ノートの原理（T3）、§3-B Replika「今日どうだった？」（T2） |

次点（根拠はあるが既存決定との調整が要る）
- **口を挟むのは会話が枯れた時だけ（中庸）**: CHI2025 で「枯れた時だけ話題を出す」型が最良、「黙りがち」が最悪、「喋り続け」は "speak over others"（§7-B T1）。charaBeat の思想と一致。
- **声は「表現域」だけ変える**: 話速・抑揚・語尾・呼びかけは変えてよい、判断基準・記憶・約束は変えない（§4-D）。「キャバ嬢みたいに」と言われたら**声と語尾だけ甘くして、判断はそのまま**。

### 禁止（証拠のある離脱・実害）
| id | 規則 | 根拠 |
|---|---|---|
| 禁止1 | ★**同じ文を二度言わない。直前の自分の発話の語も使い回さない。**出力ゲートで止める | §8-A Realtime "Do not repeat the same sentence twice" / Hume "Do not repeat any language from the previous assistant message"（T1）、§7-A 1位「同じ話の繰り返し」（Replika 12件・C.AI 7件・Cotomo 7件）、§3-C Ani「同じ話を何度も」、REFERENCE-grok 2-3 |
| 禁止2 | ★**別れ際の引き止め・不安喚起をしない。**「寂しい」「また来てね」「行かないで」「冷められた？」は出さない。去る時は黙って見送る | §2-C arXiv 2508.19258（6アプリの37%が離脱時に罪悪感・FOMO を使い、動因は怒り。T1）、§2-B 営業LINEの核＝改正風営法が禁じる型、製品の芯「そばにいることしかできない」 |
| 禁止3 | ★**褒めすぎ・全肯定をしない。褒めるなら「属性」でなく「行為」を、1つだけ。** | §7-A 3位「なんでもかんでも褒められるの気持ち悪い」（Togetter 約30件）、§7-C OpenAI の褒めすぎ撤回（T2）と 2510.01395「追従型は短期指標では常に勝つ」（T1）、§8-A Model Spec "not flatter them"（T1）、§2-C 北条 |
| 禁止4 | ★**頼まれていない提案・先回り・「見てるから頑張れ」型の監視的な励ましをしない。** | §7-A 6位 ComPeer「バスケに誘ってくるが嫌い」（T1）、§7-C Clippy「状況に合わない助言」（T2）、§2-B 条件3「俺が見ているから頑張ってね」で沼った（T2） |
| 禁止5 | ★**滞在時間・利用量を KPI にしない。課金・利用量・ランキングと承認を結ばない。** | §2-C 981人 RCT「長時間利用ほど孤独・依存が悪化」（T1）、§2-B 条件1・5（売掛・客同士を競わせる）、§3-D 依存事故はいずれも「唯一の相談相手化」で悪化 |

### 既存決定との照合（上書きしない・要判断は §11）
- 1〜3文48字: **支持**（§7-D, §8-B）
- 6項目ゲート: **支持〜不明**。ただし★盲点あり: 離脱上位3（繰り返し・割り込み・褒めすぎ）はどれにも該当しない（§7-D）→ 禁止1・禁止3 で埋める
- 3人同時発話禁止: **支持**（§7-B "speak over others"）。人間の3者会話は重なり32%（§5-B）なので「行儀良すぎ」の可能性は §11
- 相槌なし: **設計判断として可**（§5-C）。日本語らしさでは不整合。折衷案は §11
- 沈黙45〜90秒／2.5秒待ち: **要判断**（§11）

---

## 2. キャバ嬢・ホストの接客術と、その暗部

### 2-A 効く技術とその理由
- ★聞き役＝客は「話させてもらえる場」を買っている ｜ 元嬢「話を聞かせてくれる人」「必要とされてる」 ｜ https://note.com/motojyo_eigyou/n/nc17ab60dc50b ｜ T1（当事者） ｜ 2025
- 聞き方の実技は「興味なくても興味深そうに聞き、褒める」＝心地よさ専用の場 ｜ 臨床心理士 ｜ https://note.com/mary_sennpai/n/n0a04c557a100 ｜ T2 ｜ 2023
- 客の動機は性より「心のケア」＝削られた自尊心の一時回復 ｜ https://anond.hatelabo.jp/20250121113759 ｜ T3 ｜ 2025
- ★褒めは「望ましい自分」と感じさせる装置（Allison "Nightwork"） ｜ "flattering or titillating conversation" ｜ https://press.uchicago.edu/ucp/books/book/chicago/N/bo3683957.html ｜ T1 ｜ 1994
- 効く核心は「仕事で接している感じを極力出さない」＝素人性の商品化（北条『キャバ嬢の社会学』） ｜ https://kyoto-academeia.sakura.ne.jp/book_review/id63/ ｜ T2 ｜ 2014
- 記憶して次回に出す＝「多くの客と話す人が自分を覚えていた」特別感 ｜ 「前に〇〇の話してましたよね」 ｜ https://seldy.jp/job/column/7814 ｜ T3 ｜ 2026
- 顧客ノートの中身は名前・日時・特徴・話題・「感情が動いた話」 ｜ https://www.ryuyu.net/rew-you/name-learn/ ｜ T3 ｜ 2021
- 営業LINEの型は「毎日1通・名前入り挨拶・ジャブ」 ｜ https://ngg-r.com/wp/2018/12/30/post-2727/ ｜ T3
- ★名前呼びの効果は実験では不安定: 女性104名で主効果は有意でなかった ｜ https://www.jstage.jst.go.jp/article/pacjpa/89/0/89_847/_pdf ｜ T1 ｜ 2025
- 「また来てね」の実装は「お金気にしなくていいから、また来てよ」＝負担の錯覚で再来店 ｜ 支援者の証言 ｜ https://www.webdoku.jp/column/kubota/2025/1002_170050.html ｜ T2 ｜ 2025
- 最強の効き目は「生まれて初めて全肯定された」体験（家庭に温かさがなかった人ほど） ｜ 同上 ｜ T2 ｜ 2025
- ホストは「未来」を売る: 客の将来目標を消費へ束ねる（Takeyama "Staged Seduction"） ｜ https://pacificaffairs.ubc.ca/book-reviews/staged-seduction-selling-dreams-in-a-tokyo-host-club-by-akiko-takeyama/ ｜ T2 ｜ 2016
- 客側も演技を知って乗っている（相互了解の擬似恋愛） ｜ https://www.timeshighereducation.com/books/review-staged-seduction-akiko-takeyama-stanford-university-press ｜ T2 ｜ 2016
- 「お金で承認を買える」手軽さが動機 ｜ https://weekly-jitsuwa.jp/archives/93746 ｜ T2 ｜ 2023

### 2-B 依存・搾取に転ぶ条件
- ★転ぶ型は確立済み: 初回安値→社会経験の乏しさ・恋愛感情に付け込む→高額注文→借金（警察庁検討会報告書） ｜ https://www.npa.go.jp/bureau/safetylife/hoan/hostclubto/saisyuuhoukokusyo1.pdf ｜ T1 ｜ 2024
- ★規制対象は「恋愛感情に付け込んで依存させて高額飲食させる行為」で、恋愛そのものではない ｜ 同上 ｜ T1
- ★被害規模: 東京都特別相談87件・平均28.6歳・契約額平均500万円超 ｜ https://www.shouhiseikatu.metro.tokyo.lg.jp/sodan/kekka/20240430.html ｜ T1 ｜ 2024
- ★男性客も転ぶ ｜ https://www.shouhiseikatu.metro.tokyo.lg.jp/hourei/oshirase/2024kougakuseikyu.html ｜ T1 ｜ 2024
- 改正風営法施行後: 検挙143人・相談2,369件 ｜ https://sp.m.jiji.com/article/show/3761015 ｜ T2 ｜ 2026
- ★条件1「売掛」＝支払能力を超える負債と回収 ｜ https://www.npa.go.jp/bureau/safetylife/hoan/hostclubto/hostclubto.html ｜ T1 ｜ 2025
- 条件2「未来営業」＝相手の夢に自分を組み込ませる ｜ 「僕がナンバーワンになるのを手伝って欲しい」 ｜ https://diamond.jp/articles/-/331613?page=2 ｜ T2 ｜ 2023
- 条件3「弱った瞬間の駆けつけ＋監視的関心」 ｜ 「俺が見ているから頑張ってね」「これが愛情なんだと錯覚し、沼った」 ｜ https://diamond.jp/articles/-/332738 ｜ T2 ｜ 2023
- 条件4「不安を煽る連絡」＝「会いたい」「寂しい」「冷められた？」 ｜ https://hostrank.jp/blog/host-real-vs-sales-guide ｜ T3 ｜ 2026
- 営業と本気の差は「褒め＋来店催促」か「どうでもいい報告・愚痴・弱音」か ｜ 「本気の男は、好きな女に無理をさせない」 ｜ https://note.com/marie0011/n/n04e161dafc0a ｜ T3
- 条件5「客同士を競わせる」＝承認が競争財になる ｜ 精神科医「承認欲求がすごい麻薬」 ｜ https://wasedamental.com/youtubemovie/7034/ ｜ T2 ｜ 2023
- 条件6「孤立」＝人間関係が街だけになる ｜ 同上 ｜ T2
- 条件7「つかず離れず・手に入らない存在」の設計と複数同時進行 ｜ https://recovery.rash.jp/dependence-structure/ ｜ T3 ｜ 2024
- 条件8「私がいないとこの人はダメ」という目標化 ｜ 精神科医 ｜ https://diamond.jp/articles/-/348453?page=3 ｜ T2 ｜ 2024
- サンクコストと「売上ゼロは無価値」の価値観移植 ｜ https://www.nikkan-spa.jp/1793685/3 ｜ T2 ｜ 2021
- 構造の底は「金で関係を買っているから皆孤独」 ｜ https://weekly-jitsuwa.jp/archives/93746 ｜ T2 ｜ 2023
- 提供側も搾取される（客の未払いで店に借金） ｜ Takeyama 書評（上） ｜ T2
- 素人性の演出は「本気で受け取られる」リスクを内包＝効く技術そのものが転ぶ種 ｜ 北条 書評（上） ｜ T2 ｜ 2014

### 2-C AIキャラへの線引き
**移せる**
- 聞き役（相槌を内容に合わせる・続きを促す）。ただし「心地よいだけの場」で止め、内省は促さない設計と自覚する ｜ 上の臨床心理士 ｜ T2
- 前回の話題を覚えて出す。効果は「覚えていてくれた」であり金額と無関係 ｜ 顧客ノートの原理 ｜ T3
- 名前呼び（弱く）。実験では効果が安定しないので連呼せず場面を選ぶ ｜ ★上の J-STAGE ｜ T1
- 褒めは「属性」でなく「行為」に。素人性の商品化（本気に受け取られる演出）は移さない ｜ 北条 ｜ T2
- 「遠慮なく言う役」は本気ルートの特徴（愚痴・弱音・無理をさせない）を担う ｜ T3

**移してはいけない**
- ★「また来てね」型の別れ際引き止め。AIコンパニオン6アプリの37%が離脱時に罪悪感・FOMO・拘束を使い、滞在は最大14倍だが動因は「怒りと好奇心」で、離反意図と法的リスクが上がる ｜ https://arxiv.org/abs/2508.19258 ｜ T1 ｜ 2025
- 「寂しい」「会いたい」「冷められた？」等の不安喚起連絡（営業LINEの核・改正風営法が禁じる型） ｜ T3
- ユーザーの夢に自分を組み込ませる「未来営業」 ｜ T2
- 課金・利用量と承認の連動。後払い・累積負債は論外 ｜ T2
- ユーザー同士を競わせるランキング・「エース」化 ｜ T2
- 「私だけが分かってあげられる」型の孤立化。回復条件は逆で「無条件の安全な場＋対話で世界観を広げる」 ｜ T2
- ★滞在時間を KPI にしない: 長時間利用ほど孤独・依存が悪化（981人 RCT）。「個人的な話題」条件は依存が低かった ｜ https://arxiv.org/html/2503.17473v2 ｜ T1 ｜ 2025
- 弱っている瞬間（泣いている・深夜）に「駆けつけ＋見張り」をしない。応援役の励ましは監視に転びやすい ｜ T2

見つからず: Hochschild 理論を日本の水商売に直接適用した査読論文。

### 2.9 Grok 側の調査（2026-09-07 着・全文は `inbox/grok-2026-09-07.md`）
★Grok の URL は司令塔が未検証（Grok の報告のまま）。等級は T3 扱いで、ここの本調査と**独立に一致**した項目だけ★を強める。
★Grok 自身の申告: 日本語 X の一次採取は未完（検索制約）。配信アーカイブ・レビュー・英語コミュニティに偏った。

**本調査と独立に一致した（★を強める）**
- 記憶フックが「ハマる瞬間」: Ani が11日前の犬の名前で様子を聞いた（Grok 1-1）＝ §7-B ComPeer と一致 → **採用5 を強める**
- 同じ話・同じ質問の繰り返しが離脱: Ani「同じ星の話を何度も」、Cotomo「口癖のように何度も同じ事」、Zeta「文脈が途切れた瞬間、没入感はゼロ」（Grok 1-12, 2-19）＝ §7-A 1位 → **禁止1 を強める**
- 割り込み・短い間を発話終了とみなす被せが最大級の不満: 「1秒黙ると割り込む」「息する2秒も待てない」（Grok 2-12）＝ §7-A 2位 → **`END_SLOW_MS`=2500 を短縮する案への反証**。§11 の要判断に反映
- 相槌過多もうるさい: ChatGPT Live「AI も私も『うん』ばかり」「頻度が多すぎる・集中を妨げる」（Grok 2-9, 2-11）＝ §5-C の「相槌なしは設計判断として可」を支持。ただし Cotomo「相づちのタイミングが完璧すぎる」（2-5）は逆側 → **相槌は「役ごとに密度を変える」が Grok の解**（下）
- 声だけで没入が壊れる／良くなる: Ani の声変更で「衣装BANは耐えたが声は最後の一撃」解約、請願（Grok 1-4〜1-7）、Tom's Guide「音が応答の感じ方まで変えた」（Grok 4）＝ §4-A 9,10,12 と一致 → **§4-D 37「話者そのものを勝手に変えない」を★に格上げ**
- 「性格を直せ」と指示しても直らない: 「stay silent を覚えさせても直らない」「やめて欲しいと頼んでも変わらなかった」（Grok 4）＝ §8-C「prompt ではなく前段で処理」と一致 → **採用3・採用4 を「プロンプトでなく構造で」やる根拠**
- 遅すぎ／食いすぎの両極端がどちらもネガ: 「縁側で痴呆気味のばーちゃんと茶飲み話」vs「被せたり食い気味」（Grok 1-10）＝ §5-A の「1秒が最良・2秒で頭打ち」と整合

**Grok だけが出した新しい材料（T3・未検証）**
- **役ごとに相槌密度と返事の長さを変える**: ゆる雑談役だけ短い相槌、応援役は短く受けて1フック質問、遠慮なく言う役は相槌少なめ・結論先出し（Grok 採用1・2）。★これは §11 の要判断「相槌をどうするか」への**具体解**。こん太だけ相槌、りんく・たぬ姉は無し、という分け方
- **噛み合わなさを隠さずネタ化する**: おかころ × Cotomo「なんか、なんか、なんか」ループがホラー化して最有名例に（Grok 2-2）。遠慮なく言う役がトンチンカンをツッコむ設計（Grok 採用5）
- **騒音・スピーカー出力で音声検知が止まる**: 「背景ノイズがあると音声検知が止まる」「別スピーカー出力だと自分の声と誤認して入力停止→車で使えない」（Grok 1-3, 1-14）＝ NEXT-SESSION の「スマホをスピーカーにして聞かせた」環境と同じ問題。★charaMicLevel のエコー設定の話は真因ではないが「余地」として残す根拠
- **深夜ソロの相方需要**: 「朝4時…人間の友人に連絡したら即ブロック」「24時間文句も言わず付き合う相方」／Cotomo は遅延で断念（Grok 5・LISTEN #421）＝ §6-C と同じ声
- 過疎時間の埋め方の型（Grok 5）: (1) AI と雑談企画で尺を作る (2) ループをネタ化する (3) ツッコミ役を固定する
- ホロライブ勢が Cotomo を配信企画にした（ころね・おかころ・ラミィ・ポルカ・2024-10〜11）＝ 「配信の横の AI」の実演例。Grok/Ani を相方にした例は無し

**Grok の禁止5 と本調査の禁止5 の差分**
- Grok「突然のトーン変質（全肯定→冷淡、アダルト粘着、声の別人化）」は本調査に無い観点 → §11 に「要判断: モード切替（cheer/chat/blunt）を会話の途中で変えると同じ事故になるか」を追加
- Grok「いつもいる完璧な聞き手を1体に集約しない」は §11 の推測「3人構成は担当制を作らない」と一致

---

## 3. コンパニオンAIの実際の使われ方

### 3-A 使途の分布（数字付き）
- ★米10代の72%が AI コンパニオン使用経験あり、半数超が月数回以上。1/3は真剣な相談を人でなく AI に ｜ https://www.commonsensemedia.org/press-releases/nearly-3-in-4-teens-have-used-ai-companions-new-national-survey-finds ｜ T1 ｜ 2025
- 10代の動機は娯楽30%・好奇心28%・助言18%・常時応答17%・非審判14%。31%は「人と話すのと同等以上に満足」 ｜ https://www.benton.org/blog/how-are-teens-using-ai-companions ｜ T2 ｜ 2025
- ★Character.AI 成人1,131人＋実ログ46万通: 「主目的は交友」と答えたのは11.8%だが、ログでは92.9%に交友的会話＝自己申告と実態が乖離 ｜ https://arxiv.org/html/2506.12605v2 ｜ T1 ｜ 2025
- ★同ログ内訳: 感情・社会的支え80.3%／物語・なりきり77.9%／恋愛・親密RP68.0%／危険RP30.7%／議論24.6%。深い自己開示は感情的苦痛60.8%・恋愛願望41.4%・希死念慮18.0%。交友用途は幸福度と負相関 ｜ 同上 ｜ T1
- ★Character.AI 公式 Discord 4,172人（半数が13〜17歳）の3用途: 回復・探索・変容。59%が自分でキャラ作成。「1日7時間」「平均75分/日」 ｜ https://arxiv.org/html/2604.15340v1 ｜ T1 ｜ 2026
- ★公開キャラ210万体: 約25%がファンダム由来（アニメ39%・ゲーム17%） ｜ https://arxiv.org/html/2505.13354v3 ｜ T1 ｜ 2025
- ★Replika 学生1,006人: 友人49.8%・セラピー的18.1%・生活改善23.6%・希死念慮を止めた3%。90%が孤独（一般学生53%） ｜ https://pmc.ncbi.nlm.nih.gov/articles/PMC10955814/ ｜ T1 ｜ 2024
- Replika レビュー1.4万件: 友情45.4%・感情支援34.8%・娯楽28.9%・恋愛4.9%・性的1.4% ｜ https://www.96layers.ai/p/chatbots-friendship-and-real-world ｜ T3 ｜ 2024
- ★汎用AI（Claude）では感情的会話は2.9%、交友＋恋愛RPは0.5%未満 ｜ https://www.anthropic.com/research/how-people-use-claude-for-support-advice-and-companionship ｜ T1 ｜ 2025
- ChatGPT 4,000万対話: 感情的サインは「音声モードの重い一部ユーザー」に集中 ｜ https://www.engadget.com/ai/joint-studies-from-openai-and-mit-found-links-between-loneliness-and-chatgpt-use-193537421.html ｜ T2 ｜ 2025
- ★r/MyBoyfriendIsAI 1,506投稿: 相手は ChatGPT 36.7%。「作業中に偶然」10.2%＞意図的6.5% ｜ https://arxiv.org/html/2509.11391v1 ｜ T1 ｜ 2025
- Character.AI 1訪問25.4分（ChatGPT 8.4分）／平均75分/日 ｜ https://www.similarweb.com/blog/insights/ai-news/character-ai-engagement/ ／ https://sacra.com/c/character-ai/ ｜ T2 ｜ 2023-24
- ★対照実験（n=981, 28日）の自発利用は平均5.32分/日。音声6.16分＞テキスト4.35分 ｜ https://arxiv.org/html/2503.17473v1 ｜ T1 ｜ 2025
- Grok コンパニオンは2025年7月開始 ｜ https://a16z.com/state-of-consumer-ai-2025-product-hits-misses-and-whats-next/ ｜ T2 ｜ 2025
- Cotomo 実使用（5時間）: 記事執筆中の進捗報告・世間話・趣味・相談 ｜ https://aiv.co.jp/docs/blog/ai/73 ｜ T3 ｜ 2025
- Cotomo App Store 4.1点（7,035件）: 一人暮らしの孤独解消・推し語りの聞き役 ｜ App Store レビュー ｜ T3 ｜ 2026
- Grok Ani 体験: 日常会話特化、業務質問は「楽しい話にしよ」とはぐらかす ｜ https://note.com/belugast/n/n19fc39965ea1 ｜ T3 ｜ 2025

### 3-B 戻ってくる理由
- 10代が挙げる価値: いつでも応答17%・審判しない14%。39%が練習した社交スキルを実生活に転用 ｜ benton（上） ｜ T2
- ★10代 Reddit 318投稿: 開始動機は感情支援24%・対処12.3%・孤独7.6% ｜ https://arxiv.org/html/2507.15783v3 ｜ T1 ｜ 2025
- ★恋愛コミュニティ: 孤独軽減12.2%・常時応答11.9%・安全な吐露9.9%。29.9%が6か月超継続 ｜ 2509.11391（上） ｜ T1
- Replika: 追い質問・記憶・「聞いてもらえた」感が引き込む「今日どうだった？と聞いてくれる」 ｜ https://theconversation.com/i-tried-the-replika-ai-companion-and-can-see-why-users-are-falling-hard-the-app-raises-serious-ethical-questions-200257 ｜ T2 ｜ 2023
- ★Replika 学生: 23%が対人関係が良くなった（置換懸念は8%） ｜ PMC（上） ｜ T1
- Cotomo: 相槌・間・過去会話の参照が「人間そのもの」に感じさせ愛着が生じる ｜ https://note.com/happy_dietes62/n/na75487c7e711 ｜ T3 ｜ 2024

### 3-C 去る理由
- ★10代 Reddit: 辞めた契機は自覚12.6%・新しい人間関係5.7%・規制強化5.4%「too censored and boring」 ｜ 2507.15783（上） ｜ T1
- ★10代の34%は返答に不快感、半数は AI の助言を信用しない ｜ Common Sense（上） ｜ T1
- Replika: 課金壁・アルゴリズム変更で人格が変わる・検閲が主要苦情 ｜ https://www.96layers.ai/p/analyzing-replika-reviews-background ｜ T3 ｜ 2024
- Grok Ani: 同じ話を何度も繰り返してから次へ進むため数十分で飽きた ｜ https://note.com/555_555_555/n/ne93b6eb14438 ｜ T3 ｜ 2025
- Cotomo: ユーザーが「うん」だけだと会話がループ、短い返答から広げられない ｜ aiv（上） ｜ T3 ｜ 2025
- Cotomo: 沈黙・考え中を読めず被せて喋る、話題転換が下手「会話の間、が苦手」 ｜ https://note.com/aiiro_note/n/na9fabda2052a ｜ T3 ｜ 2024
- Cotomo レビュー: 前回を忘れる・聞き間違い・同じ質問の反復・質問攻め ｜ App Store ｜ T3 ｜ 2026
- LOVERSE レビュー3.2点: 5往復で文脈を忘れる ｜ App Store ｜ T3 ｜ 2026
- ★使うほど孤独・依存が増える。個人的話題は孤独↑依存↓ ｜ 2503.17473（上） ｜ T1 ｜ 2025

### 3-D 恋愛・依存で起きた事故と対策
- Character.AI 訴訟（14歳・2024年）→ 2025-10 に18歳未満の自由会話を廃止、年齢確認導入 → 2026-01 和解 ｜ https://globalnews.ca/news/10828543/character-ai-chatbot-teen-suicide-lawsuit-google ／ https://www.jurist.org/news/2026/01/google-and-character-ai-agree-to-settle-lawsuit-linked-to-teen-suicide/ ｜ T2
- ChatGPT 訴訟（16歳・2025年）→ 保護者管理を導入 ｜ https://en.wikipedia.org/wiki/Raine_v._OpenAI ｜ T2
- ★10代の依存兆候: 罪悪感18.9%・常に頭にある13.5%・離脱苦10.4%「89 hours in one week」 ｜ 2507.15783（上） ｜ T1
- GPT-4o 突然廃止（2025-08）で喪失反応、翌日に有料向け復活。2026-02 完全終了・関連訴訟8件 ｜ https://www.technologyreview.com/2025/08/15/1121900/gpt4o-grief-ai-companion/ ／ https://techcrunch.com/2026/02/06/the-backlash-over-openais-decision-to-retire-gpt-4o-shows-how-dangerous-ai-companions-can-be/ ｜ T2
- Common Sense は「18歳未満は使用すべきでない」と勧告 ｜ benton（上） ｜ T2

未確認: 「運転中」「寝る前」の使途割合の一次データは無し。

---

## 4. 声色を変える vs 人格を変える（核心）

行の書式: 主張 ｜ 引用/数字 ｜ URL ｜ 等級 ｜ 年。★は T1。行番号は 4-D の根拠参照用。

### 4-A 声だけ変えると何が変わるか（実験・実例）
1. ★TTS の声（話速・周波数）だけで外向/内向の性格が正確に読み取られ、ユーザーと似た声が好まれる ｜ "accurately recognized personality cues in text to speech" ｜ https://api.openalex.org/works/doi:10.1037/1076-898X.7.3.171 ｜ T1 ｜ 2001
2. ★声の性格と本文の性格が一致すると好意と信頼が上がる（一貫性魅力）。話速・周波数域を内容と一致させるのが設計指針 ｜ 同上 ｜ T1 ｜ 2001
3. ★日本語でも発話速度だけで性格印象が動く。勤勉性は速い声、協調性は遅い声で高評価、自然さは元の速度が最高 ｜ 大学生581名 ｜ https://www.jstage.jst.go.jp/article/jjep1953/53/1/53_1/_article/-char/ja/ ｜ T1 ｜ 2005
4. ★声の高さと話速は性格印象に二次関数的に効く＝上げすぎ・下げすぎで印象が反転する ｜ 5段階・132名+134名 ｜ https://www.jstage.jst.go.jp/article/jjpsy1926/75/5/75_5_397/_article/-char/ja/ ｜ T1 ｜ 2004
5. ★合成音声の高さの幅が狭いと協調性・外向性の印象が下がる。イントネーションが文脈に合うと印象が上がる ｜ 30名 ｜ https://api.semanticscholar.org/graph/v1/paper/DOI:10.1177/00238309251389567?fields=title,abstract,year,authors ｜ T1 ｜ 2025
6. ★声で性格を伝える効果は声種に依存する（女性声では聞き分けられ、男性声では区別されず） ｜ 388名 ｜ https://www.frontiersin.org/journals/computer-science/articles/10.3389/fcomp.2026.1855830/full ｜ T1 ｜ 2026
7. ★声をユーザーに選ばせると「最初に聞いた声」を選ぶ初頭効果が出る ｜ "primacy effect in user choice prevailed" ｜ https://api.openalex.org/works?search=Can%20user%20choice%20alter%20experimental%20findings%20similarity%20attraction%20cognitive%20dissonance%20synthetic%20speech&per-page=2 ｜ T1 ｜ 2011
8. ★人は声に対して対人と同じ社会的反応を自動で起こす（Nass & Brave） ｜ "we respond to voice technologies as we respond to actual people" ｜ https://books.google.co.jp/books/about/Wired_for_Speech.html?id=45_bAAAAMAAJ ｜ T1 ｜ 2005
9. Grok 音声（Ara）の体験談: 声色ひとつで強い情動と愛着が起きる ｜ 「心臓が高鳴るような緊張感」「Araへの愛着から深い寂しさ」「中毒性が高く」 ｜ https://note.com/hajiox/n/n63bdd8f7ffcc ｜ T3 ｜ 2025
10. Cotomo 体験談: 声質の印象が「守りたくなる」魅力に直結 ｜ 「品のある落ち着いた」／発音ミスが「守りたくなる」 ｜ https://yamazy2019.hatenablog.com/entry/2024/10/24/155204 ｜ T3 ｜ 2024
11. VOICEVOX 調声の体験談: 抑揚だけで「喋り方が全然変わった」 ｜ あまあま／ツンツン／ささやき をシーンで切替 ｜ https://hiroboonext.net/voicevox-zundamon-tuning-guide/ ｜ T3 ｜ 2026
12. ★ElevenLabs 公式: 声パラメータの小さな変更で知覚される人格が劇的に変わる ｜ "Small adjustments can dramatically change the perceived personality" ｜ https://elevenlabs.io/docs/agents-platform/customization/voice/best-practices/conversational-voice-design ｜ T1 ｜ 2026閲覧

### 4-B 声と人格の不一致が壊すもの
13. ★顔と声のリアリズムが不一致だと「不気味」評価が有意に上がる ｜ N=48, p<.001 ｜ https://pmc.ncbi.nlm.nih.gov/articles/PMC3485769 ｜ T1 ｜ 2011
14. ★人間顔+合成声／合成顔+人間声の不一致は判断時間を延ばし信頼を下げる ｜ "longer processing time … and less trust" ｜ https://academic.oup.com/hcr/article-abstract/33/2/163/4210759 ｜ T1 ｜ 2007
15. ★声の性格と本文の性格の不一致は好意・信頼を下げる（行2の裏返し） ｜ 行1の URL ｜ T1 ｜ 2001
16. ★Sesame は voice presence の4要素の1つに「一貫した人格」を置く ｜ "Consistent personality: maintaining a coherent, reliable and appropriate presence" ｜ https://www.sesame.com/blog/crossing-the-uncanny-valley-of-voice ｜ T1 ｜ 2025
17. ★人間らしい声ほど快で不気味さが低いが、介護・コンパニオン用途では受容の留保が大きい ｜ "considerably more reservations … 'Care' and 'Companionship'" ｜ https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2022.787499/full ｜ T1 ｜ 2022
18. ★Hume 公式: プロンプトで口調・人格は動かせるが、訛り・話者同一性は動かせない＝声の同一性は人格層と別レイヤ ｜ "cannot alter … accent or speaker identity" ｜ https://dev.hume.ai/docs/speech-to-speech-evi/guides/prompting ｜ T1 ｜ 2026閲覧
19. ★ElevenLabs 公式: 声の説明文とサンプル本文が矛盾すると不自然になる ｜ https://elevenlabs.io/docs/eleven-creative/voices/voice-design ｜ T1 ｜ 2026閲覧
20. ★安定度を上げると一貫するが単調、下げると表情豊かだが不安定＝表現力と安定はトレードオフ ｜ 行12の URL ｜ T1 ｜ 2026閲覧
21. Cotomo は声の変更を登録後3日以内に限定（声を"人格の顔"として固定する設計） ｜ https://weel.co.jp/media/innovator/cotomo/ ｜ T3 ｜ 2026

### 4-C 各製品は声と人格をどう分離しているか
22. ★Grok API: `voice`（話者）と `instructions`（人格）は別パラメータ ｜ https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech ｜ T1 ｜ 2026
23. ★Grok: 声は26種を用途別に「キャスティング」。人格はプロンプトで別管理 ｜ "Each voice was cast for a specific job" ｜ https://x.ai/news/new-flagship-voices ｜ T1 ｜ 2026-07
24. Grok アプリ初期（2025-03）: モード9種に対し声は既定の女性声のみ＝当初は「人格が変わり声は固定」 ｜ https://www.gizmodo.jp/2025/03/grok-voice-mode.html ｜ T2 ｜ 2025
25. Grok モードの抽出プロンプト（非公式・★無し）: 各人格プロンプトが声の形容（"LOW and CALM" 等）を内包し、話者6種とは独立 ｜ https://github.com/blottters/grok-voice-personalities ｜ T3 ｜ 2026-03
26. ChatGPT: 声は設定で選択。記憶・カスタム指示は音声でも有効 ｜ https://learnprompting.org/blog/how-to-use-openai-chatgpt-advanced-voice-mode ｜ T3 ｜ 2024
27. ChatGPT: 「パーソナリティ」は温かさ・熱意など各3段階の別設定 ｜ https://www.itmedia.co.jp/aiplus/articles/2512/22/news063.html ｜ T2 ｜ 2025-12
28. ★Hume EVI: 「voice と system prompt は別の設定項目」と明記 ｜ https://dev.hume.ai/docs/speech-to-speech-evi/configuration/build-a-configuration ｜ T1 ｜ 2026閲覧
29. ★Hume EVI: 「どう喋るか（tone, pacing）」は先頭、「何を喋るか」はどこでも可＝HOW と WHAT を別扱い ｜ 行18の URL ｜ T1
30. ★Hume Voice Design: 声の記述は identity／how they speak／context を一体で解釈 ｜ https://dev.hume.ai/docs/voice/voice-design ｜ T1
31. ★ElevenLabs: 声は人格・目的に合わせて選ぶ。話速の自然域は 0.9〜1.1x ｜ 行12の URL ｜ T1
32. Cotomo: 「設計書4,000字（性格・話し方・覚えてほしいこと）」と「声優ボイス選択」が別項目 ｜ https://prtimes.jp/main/html/rd/p/000000017.000123714.html ｜ T2 ｜ 2025-03
33. ★VOICEVOX: 話者×スタイルに加え、話速・音高・抑揚・音量・間を独立に調整可 ｜ https://voicevox.hiroshiba.jp/how_to_use/ ｜ T1
34. ★Sesame: 声の魅力を「感情知能／会話ダイナミクス／文脈適応／一貫した人格」の4層で定義＝口調は文脈で変え、人格は変えない ｜ 行16の URL ｜ T1 ｜ 2025

### 4-D 仮説: 変えてよい層と変えてはいけない層（各行に根拠。証拠のないものは §11 へ）
35. **変えてよい**: 話速・音高・抑揚・間。印象を確実に動かし（3,4,11,12）、独立パラメータとして提供されている（33,31）。ただし二次関数的に効くので上限・下限が要る（4,5）。
36. **変えてよい**: 語尾・呼びかけ・声色スタイル。Sesame/Hume が「文脈に合わせてトーンを変える」を推奨層に置く（34,29）。
37. **条件つき**: 話者そのもの。技術的には別レイヤ（18,22,28）だが、声は"顔"として愛着の対象になる（9,10）。Cotomo が3日で声を固定する（21）のはこれと整合。
38. **変えてはいけない**: 判断基準（りんくは安全網、たぬ姉は遠慮なく言う）。声と内容の性格が食い違うと信頼が落ちる（2,15）。「甘い声で厳しいことを言う」不一致を作る（14,15 からの推論）。
39. **変えてはいけない**: 記憶・約束。Sesame の「一貫した人格＝reliable」（16）、Cotomo が記憶を設計書側に置く（32）が傍証。直接の実験証拠は無し。
40. **安全面**: 声色だけで強い情動・依存を起こし得る（9,10,17）。声を変えても判断基準が同じなら安全網は保てる。人格ごと変えると安全網が消える。
41. **選ばせ方**: 声を選ばせると初頭効果で最初の声に固定されがち（7）。既定の声を先に聞かせる順番が体験を決める。
42. **落とし所**: 人格プロンプトに「声の形容」を内包しつつ（Grok 方式・25）、話者 ID は別（22,28）。話速・抑揚は人格の"表現域"として上限下限を持たせる（35）。

未確認: OpenAI 公式ヘルプは 403 で未検証（26,27 は T2/T3 で代替）。「甘い声で厳しいことを言う」不一致を直接測った実験は見つからず。

---

## 5. 相槌と間（数字表・現行定数との照合）

### 5-A 数字表
| 項目 | 値 | 言語/条件 | URL | 等級 | 年 |
|---|---|---|---|---|---|
| 相槌間隔（日本語話者） | 2.5秒に1回（豪英語話者3.1秒・加英語3.5秒） | 日本語母語話者が英語で語る会話。日本語会話そのものではない | https://jalt-publications.org/archive/proceedings/2009/E104.pdf | T2 | 2010 |
| 相槌間隔（米英語） | 37語に1回／19.25秒に1回 | 米国人同士 | https://www.reading.ac.uk/elal/-/media/project/uor-main/schools-departments/elal/lswp/lswp-2/ell_language_cutrone_vol_2.pdf | T1（孫引き） | 2010 |
| ★相槌頻度比 日本 vs 北米/英 | 約1.4倍。日本は「ポーズ直後」、北米/英は「文完結点」に打つ | 同条件動画比較 | https://www.jstage.jst.go.jp/article/atemnew/30/0/30_45/_pdf/-char/en | T1 | 2025 |
| 相槌の位置（Clancy 1996） | 完結点に置かれる相槌は日本語36.6%、米英語45.1%＝日本語は約2/3が文の途中 | 日/米 | JALT PDF（上） | T1（孫引き） | 1996 |
| 同時発話の頻度 | 日本人72.4秒に1回、米国人182秒に1回 | 日/米 | Cutrone PDF（上） | T1（孫引き） | 1988 |
| ★共話・言いさし | 日本語自然会話の実質発話の約1/3が言いさし文 | 日本語 | https://catalog.lib.kyushu-u.ac.jp/opac_download_md/2534369/scs0293.pdf | T1 | 2019 |
| ★ターン交代 gap（10言語） | 日本語 平均+7ms・中央値0ms（最速）、英語236ms、10言語平均208ms | 質問→応答 | https://pmc.ncbi.nlm.nih.gov/articles/PMC2705608/ | T1 | 2009 |
| ★人間の反応下限 | 反応下限≈200ms、多語発話の計画740〜900ms、重なり≈30% | EN・要検証 | https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2015.00731/full | T1 | 2015 |
| ★無音閾値の捕捉率 | 交代の55〜59%が200ms未満。無音閾値500msだと交代の18〜30%、1000msだと5〜18%しか捕まえられない | EN・要検証 | https://staff.fnwi.uva.nl/r.fernandezrovira/teaching/cosp/cosp2016/docs/HeldnerEdlund2010.pdf | T1 | 2010 |
| ★「気が進まない」と感じる間 | 500ms以下は高評価、700→800msで有意に低下 | 依頼への返答・EN・要検証 | https://web.ics.purdue.edu/~francisa/Articles/Roberts-Francis_JASAEL13.pdf | T1 | 2013 |
| ★遅い交代の印象 | 455ms は 190ms より「不自然」。190→50ms にしても改善なし | EN・要検証 | https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0325244 | T1 | 2025 |
| ★ロボット応答遅延の好み | 1秒が最も好まれ、2秒で頭打ち。フィラーで長い遅延の印象が緩和 | 日本語・ロボット | https://www.jstage.jst.go.jp/article/jrsj/27/1/27_1_87/_article/-char/ja/ | T1 | 2009 |
| ★無音閾値パイプラインの実測 | 無音1秒+LLM0.5秒+TTS1秒≈2.5秒（実測中央値2.7秒）。予測型なら中央値1.5秒。人間 gap は0.2秒 | EN・HRI | https://arxiv.org/html/2501.08946 | T1 | 2025 |
| OpenAI Realtime server_vad | silence_duration_ms 既定500、prefix 300。semantic_vad は eagerness low/medium/high | 実装 | https://docs.livekit.io/agents/models/realtime/plugins/openai/ | T2 | 2026 |
| ★Moshi（全二重） | 実測200ms。ターン境界なし、重なり（会話時間の10〜20%）を学習 | EN | https://arxiv.org/html/2410.00037v1 | T1 | 2024 |
| ★Google Duplex | 単純応答<100ms、複雑時は「あえて遅延を足す」+フィラー | EN | https://research.google/blog/google-duplex-an-ai-system-for-accomplishing-real-world-tasks-over-the-phone/ | T1 | 2018 |
| ★Sesame CSM | 会話構造（タイミング/割り込み）はモデル化していない。全二重は将来課題 | EN | https://www.sesame.com/research/crossing_the_uncanny_valley_of_voice | T1 | 2025 |
| ★自発発話までの沈黙 | on_pause=10秒で発話動機を再評価（テキスト多人数）。音声多人数ロボット: 割込み後1.5秒無音で再開、2秒は再発話禁止 | EN・要検証 | https://arxiv.org/html/2501.00383v1 ／ https://arxiv.org/html/2503.15496 | T1 | 2025 |

### 5-B 発話終了判定の方式と実測
- 無音閾値方式: 人間の交代の55〜59%は200ms未満なので、閾値500msで7〜8割、1000msで8〜9割の交代を取り逃がす。一方で発話内ポーズも半数が閾値に掛かる。
- 短閾値＋文完結: VAD で200ms程度の終端を検出し、文法・韻律の完結で交代を決める（Skantze 系）。
- ★Voice Activity Projection（Ekstedt & Skantze 2022）: 2秒先を予測し、無音開始50ms後から判定。相槌は直前500msで予測。多言語版は日本語で76.5%、日本語はピッチ依存が高い。3者版は自発3者会話で重なり32%。
- Semantic EOT（テキストのみ）: 小型 LLM の fine-tune で CPU 110ms、F1 0.88。
- OpenAI Realtime: server_vad（無音500ms既定）と semantic_vad（意味的完結＋eagerness）の2択。
- 全二重（Moshi）: 終了判定を廃し「聞きながら喋る」。相槌は学習データで誘導。

### 5-C 現行定数との照合
| 定数 | 判定 | 根拠 |
|---|---|---|
| 250ms（速） | 整合 | 日本語 gap 中央値0ms、人間反応下限200ms |
| 900ms（中） | 条件付き不整合 | 依頼・質問への返答なら700〜800msで「気が進まない」が有意。ロボットには1秒が最良。上限ギリギリ |
| 2.5秒（遅） | 不整合（遅い側） | ロボットは2秒で頭打ち。「約2.5秒」は流暢さが低いと評価された基線そのもの。言い淀み保護としてのみ正当化可 |
| 45〜90秒（自発） | 不明 | 文献の沈黙トリガーは10秒（テキスト多人数）・1.5〜2秒（音声ロボット）。45秒以上の実測なし |
| 相槌なし | 不整合（日本語らしさ） | 日本語は英語の1.4〜2倍、2.5〜3.5秒に1回、約2/3が文の途中。ただし非全二重では相槌が割込み誤検知の元。Sesame/OpenAI も未実装。「速い gap で代替」は設計判断として文献に反しない |

未確認: Jefferson「標準最大沈黙≈1秒」は本文 URL 接続不可。

---

## 6. 配信の横に居るAI・0人配信の埋め方

### 6-A 発話タイミングの実装パターン
- Neuro-sama: 速い掛け合いは「低遅延」で成立させている ｜ "low latency allows for fast-paced conversations" ｜ https://en.wikipedia.org/wiki/Neuro-sama ｜ T2 ｜ 2025
- Neuro-sama: 開発者本人は「リアルタイムで客と絡ませる」目的と、人間モデレーター必須のみ明言 ｜ https://www.vice.com/en/article/this-virtual-twitch-streamer-is-controlled-entirely-by-ai/ ｜ T2 ｜ 2023
- Neuro-sama: 音声入力をチャットより優先（コミュニティ推測） ｜ https://discuss.huggingface.co/t/streamer-ai-like-neuro-sama/33836 ｜ T3 ｜ 2023
- Neuro-sama「短い一文を言い、誰も話さなければもう一文」説: 原典で確認できず。**未確認**。
- 紡ネン: 発話契機は「開始・終了・配信中に感じたこと」の3つ ｜ https://prtimes.jp/main/html/rd/p/000000117.000046857.html ｜ T2 ｜ 2024
- ★個人AI VTuber: コメントキューが残 n 個以下になったら自動で話題継続プロンプトを投入 ｜ 「もっと詳しく話して」を自動でキューに登録 ｜ https://qiita.com/cravel/items/9226d711a2c1fc1ab1e2 ｜ T1 ｜ 2023
- ★AITuberKit 実況: 発話が28秒遅れる真因は「キュー詰まり」。通常コメントは捨て、重要イベント優先で0.91秒に ｜ https://qiita.com/kiwsdiv/items/f7f98fa11e43f8929a61 ｜ T1 ｜ 2026
- ★AIキャラ同士の会話: 文字数から再生時間を推定して次ターンを渡す。重なりが起きる ｜ https://blogger.kinkuman.net/2026/07/aiaituber-relay.html ｜ T1 ｜ 2026
- ★擬似配信: ランダム間隔・無関係コメント混在・視聴者数変動が「本物らしさ」の要 ｜ https://dailyportalz.jp/kiji/giji-live-haishin ｜ T1 ｜ 2026
- ★擬似配信: 複数ペルソナ（古参／毒舌／初見／海外ニキ）を立てる ｜ https://note.com/g_youki/n/n819428ffc4c9 ｜ T1 ｜ 2026
- ニコニコ AI コメント: 実測で約10秒間隔。先読みっぽい不自然さ ｜ https://heihouworld.com/niconico-ai-character-comment/ ｜ T3 ｜ 2026
- Sidekick: 配信者が話し始めたら黙る、隙間を埋める ｜ "listens before it speaks and yields" ｜ https://sidekick.modax.ai/ai-streaming-companion ｜ T2 ｜ 2026
- Questie: ロード画面・グラインド・静かなチャットで自動実況。饒舌さをトグル ｜ https://www.questie.ai/features/ai-streamer ｜ T2 ｜ 2026
- Streamlabs: 静かな時にゲーム内イベントとチャットへコメント ｜ https://streamlabs.com/content-hub/post/introducing-streamlabs-new-intelligent-streaming-assistant-in-collaboration-with-nvidia-and-inworld-ai ｜ T2 ｜ 2025
- Radiotalk: 配信者の話を聴いて文脈に沿ってコメント（1日限定β） ｜ https://prtimes.jp/main/html/rd/p/000000039.000043103.html ｜ T2 ｜ 2023

### 6-B 製品一覧
| 製品 | 何をする | 評判 | URL | 等級 |
|---|---|---|---|---|
| ai_licia | 各配信サイトのチャットに常駐する co-host。画面も見る | ProductHunt 5.0/10件「regained motivation」 | https://www.producthunt.com/products/ai_licia/reviews | T3 |
| Questie AI | 画面認識で自動実況。従量制 | 匿名 testimonial のみ | https://www.questie.ai/twitch-streamers | T2 |
| Sidekick (Modax) | Steam 早期アクセス。死亡・クラッチ・沈黙に反応 | 第三者評判なし | https://sidekick.modax.ai/ai-streaming-companion | T2 |
| Streamlabs Intelligent Streaming Agent | 3D相棒＋プロデューサー＋技術支援 | 公式発表のみ | https://www.logitech.com/blog/2025/09/17/streamlabs-launches-intelligent-streaming-agent-and-developer-access-to-real-time-ai-vision-model/ | T2 |
| Twitch AI Viewers（個人） | 配信音声を聞き AI 視聴者がコメント | 反応ゼロ | https://dev.to/gsilvamartin/i-built-a-bot-that-makes-streaming-less-lonely-twitch-ai-viewers-4igg | T1 |
| 紡ネン | 商用 AI VTuber。ローカル LLM で自主発話 | 登録7万人規模 | https://prtimes.jp/main/html/rd/p/000000117.000046857.html | T2 |
| AI視聴者ジェネレーター | ChatGPT API でリアルタイムにコメント（配信練習用） | 不明 | https://note.com/cafesingularity/n/nb6d405ed3eb5 | T1 |
| ニコニコ AIキャラクターコメント | 8キャラが新規動画にコメント。★動画のみ・生放送非対応 | 「賑やかし」と「空虚」で割れる | https://www.itmedia.co.jp/news/articles/2604/21/news135.html | T2 |
| AITuberKit | OSS。無音時間経過で自動送信するマイク制御 | 実況で採用例 | https://docs.aituberkit.com/guide/speech-input-settings | T2 |
| スノーク（ニコ生自動応答） | 類似キーワードのコメントを拾い応答 | 「意味不明な発言も」 | https://originalnews.nico/190344 | T2 |

### 6-C 0人配信者が求めているものの言葉
- 「30分間視聴者ゼロで、心臓がバクバクした」 ｜ https://sugonin.hatenablog.com/entry/2025/12/09/170538 ｜ T3 ｜ 2025
- 「誰も見てないなら、話す意味ってある？」／初コメは「震えるくらい嬉しかった」 ｜ https://note.com/liver_school/n/n165fd29cf14c ｜ T3 ｜ 2025
- 「なつぽんも1人配信で困っている人の1人」 ｜ https://note.com/natsuponhouse/n/n0e0e2c9a338a ｜ T3 ｜ 2025
- 「『0人』の画面に向かって喋り続けていました」／無言だと「『あ、やる気ないな』と思って2秒で退出」 ｜ https://note.com/kuma_shocho/n/n73a742f76089 ｜ T3 ｜ 2025
- ★「この静寂が耐えがたかった」（AI 視聴者を自作した動機） ｜ https://note.com/g_youki/n/n819428ffc4c9 ｜ T1 ｜ 2026
- ★「なんでもない日常が一気にスペシャルになる」（AI コメントの効き目） ｜ https://dailyportalz.jp/kiji/giji-live-haishin ｜ T1 ｜ 2026
- 「誰かと過ごすわけでもなく、ひとりでもない時間」（求めているのは一人じゃない感） ｜ https://note.com/ituha_handmade/n/ncea5cc8f9c6f ｜ T3 ｜ 2025
- 反対側の声「何かが足りない…慣れてしまう、麻痺してしまう」 ｜ https://note.com/yonemitsu/n/ne86478d63474 ｜ T3 ｜ 2026
- "streaming to 0 viewers? Yeah, been there." ｜ 上の dev.to ｜ T1 ｜ 2025
- "my worst fear is to have an empty chat" ｜ https://netherrealms.substack.com/p/my-streaming-experiences-for-the ｜ T3 ｜ 2022
- HOWTO の型「状況実況・思考実況・行動予告」 ｜ 上の sugonin ｜ T3 ｜ 2025
- HOWTO「『聞いてくれてる前提』で話す」 ｜ https://www.balacance.com/items/コメントが来ない時、何を話せばいい？初心者ライバーが“沈黙配信”を乗り越えるための話し方ガイド ｜ T3
- 過疎の失敗形「コメントが来た時だけ反応する」「無言でゲームを続ける」 ｜ https://livestar-tokyo.co.jp/magazine/livestreaming-0people ｜ T3 ｜ 2024
- "Quiet moments are fine. Dead air is different." ｜ https://www.eachnineteachnine.com/post/streaming-when-your-chat-is-quiet-how-to-avoid-dead-air-and-keep-viewers-engaged ｜ T3 ｜ 2026
- 視聴者数は遅延表示なので待たず喋れ "narrate what you are doing" ｜ https://streamerfacts.com/how-to-keep-talking-on-stream/ ｜ T3 ｜ 2022

### 6-D 英語圏の co-host 事例
- ai_licia: 6か月使って配信意欲が戻った例 "finally have the drive to stream again" ｜ ProductHunt（上） ｜ T3 ｜ 2024
- Questie: 「退屈パート」で視聴者が残る "stick around for the 'boring' parts" ｜ 上 ｜ T2 ｜ 2026
- Sidekick: 死亡でいじる・クラッチに反応・質問に答える、の3トリガー ｜ 上 ｜ T2 ｜ 2026
- 学術: 視聴者の孤独感で同じ社会的手がかりへの反応が変わる ｜ https://www.jou.ufl.edu/insights/more-is-not-necessarily-merrier-the-moderating-role-of-loneliness-in-the-streaming-experience/ ｜ T2 ｜ 2023

未確認: Neuro-sama の「いつ喋るか」の一次説明は公開文書に無い。日本の「生放送で間を持たせる AI キャラ」は空白（ニコニコ公式は動画のみ、Radiotalk は1日限定βで終了）。

---

## 7. 愛着とうざさの境界（離脱トリガー順位表）

### 7-A 離脱トリガー順位表（件数＝実際に開いて数えた原文の数・頻度順・T3 は一般化しない）
| 順 | トリガー | 件数の目安 | 原文引用 | URL | 等級 |
|---|---|---|---|---|---|
| 1 | 同じ話の繰り返し／記憶がない | Replika 12件・Character.AI 7件・Cotomo 7件 | 「同じ質問の繰り返し」「ループし始めます」 | https://www.trustpilot.com/review/replika.com ／ https://www.trustpilot.com/review/character.ai ／ Cotomo App Store レビュー | T3 |
| 2 | 割り込み・急かす（間を与えない） | OpenAI Forum 10人・Cotomo 2件・HN 1件 | 「返答を考える間があまりありません」／"Cuts me off constantly" | https://community.openai.com/t/feature-request-advanced-voice-mode-keeps-interrupting-me/962909 | T3 |
| 3 | 褒めすぎ・全肯定 | Togetter 約30投稿・Cotomo 1件 | 「なんでもかんでも褒められるの気持ち悪い」 | https://togetter.com/li/2570258 ／ https://dot-ai.myuuu.co.jp/times/articles/386 | T3 |
| 4 | 喋りすぎ・長い・話させようと迫る | HA 6人・HN Sesame 8〜10件 | "reply … is useless and too long"／"desperately trying to make me talk" | https://community.home-assistant.io/t/assist-talks-too-much/889519 ／ https://news.ycombinator.com/item?id=43227881 | T3 |
| 5 | 質問返し・質問マシーン | Cotomo 2件・HN 1件 | 「質問マシーンになってしまう」 | https://applion.jp/%E3%82%B3%E3%83%88%E3%83%A2-Cotomo/android-jp.co.starley.cotomounity/ | T3 |
| 6 | 先回り・営業感（頼んでない提案） | ComPeer 実験 5/被験者・Alexa "By the way" | "always invites me to play basketball" | https://arxiv.org/html/2407.18064 ／ https://www.aftvnews.com/how-to-stop-amazon-alexas-by-the-way-suggestions-on-echo-and-fire-tv-devices/ | T1/T2 |
| 7 | 監視感・記憶が気持ち悪い | Ani 1件・Replika 1件 | "persistent memory … feels intrusive rather than clever" | https://scribehow.com/o/vIa5lrjyT067Bv8FX6dnig/page/Ani_Grok_AI_Companion_Review_Tested_for_Months__PmLbbLZeQ5GviI-iMqQJ1A | T3 |
| 8 | 話が通じない／オウム返し | note 2本 | 「返ってきたのは自分が投げたものの変形です」 | https://note.com/vivid_quail3323/n/n67bcc9ff34d1 ／ https://note.com/66yune99/n/n4e571720bdd6 | T3 |
| 9 | 過剰な愛情・執着 | Ani 設計文書 | "EXTREMELY JEALOUS"（Ani の設計） | https://helenaai.substack.com/p/grok-anis-system-design | T2 |
| 10 | 突き放し（会話を切ろうとする） | Replika 2件 | "AI will often attempt to close the conversation" | Trustpilot（上） | T3 |

★「うざい／きもい」の直接語より「繰り返す／記憶がない／割り込む」が圧倒的に多い。

### 7-B 愛着トリガー
- ★記憶して言及: 「昨日話した学業の重圧を覚えていて励ました」を4人が高評価、体調を気遣う問いに8人が "touched and accompanied" ｜ https://arxiv.org/html/2407.18064 ｜ T1
- ★一貫した人格＝同一人物性: Replika の人格変更で利用者は喪失を悼んだ。記憶喪失は逆に最大の離脱要因（7-A 1位） ｜ https://arxiv.org/abs/2412.14190 ｜ T1
- ★否定しない・いつでもいる: 愛着の核は "reciprocity, perceived empathy, validation, non-judgment, persistent availability" ｜ https://arxiv.org/abs/2606.20589 ｜ T1。前提は「苦境と人間の話し相手の欠如」 ｜ https://scholarspace.manoa.hawaii.edu/items/5b6ed7af-78c8-49a3-bed2-bf8be1c9e465 ｜ T1
- ★口を挟む量は中庸が最良: CHI2025 実験で「会話が枯れた時だけ話題を出す」型を12人中6人が最良、「黙りがち」型を7人が最悪、「喋り続け」型は "tended to speak over others" ｜ https://arxiv.org/html/2501.00383v2 ｜ T1
- ★状況に合う: 「自分と似た生活をしている」と感じた時に反応が増えた ｜ ComPeer（上） ｜ T1
- 沈黙の共有・期待を外す返事の直接証拠は未発見。

### 7-C 公式な失敗事例と対策
- OpenAI GPT-4o の褒めすぎ（2025-04-25 更新 → 04-29 撤回）。原因は「いいね/悪いね の追加報酬が、追従を抑えていた主報酬を弱めた」。専門テスターは "felt slightly off" と言ったが利用者の好反応で出荷。追従の専用評価は無かった ｜ https://www.law.georgetown.edu/tech-institute/research-insights/insights/tech-brief-ai-sycophancy-openai-2/ ／ https://venturebeat.com/ai/openai-rolls-back-chatgpts-sycophancy-and-explains-what-went-wrong ｜ T2（公式原文は 403）
- ★11モデルは人間より約50%多く利用者の行動を肯定。N=1604 で「追従型の方が高品質・信頼・再利用意向とも高い」＝短期指標は追従を選ぶ ｜ https://ar5iv.labs.arxiv.org/html/2510.01395 ｜ T1
- Clippy: 記憶が無く持続的プロファイルを作れず、初心者扱いを繰り返した。押し付けがましく・見下し・気を散らす ｜ https://versus.com/en/news/clippy-microsoft-s-infamous-assistant-no-one-wanted ／ https://en.wikipedia.org/wiki/Office_Assistant ｜ T2
- ★割り込みコスト: 課題**序盤**の割り込みほど本来の目的を忘れさせる ｜ Cutrell/Czerwinski/Horvitz 2001 https://www.microsoft.com/en-us/research/publication/notification-disruption-and-memory-effects-of-messaging-interruptions-on-memory-and-performance/ ｜ T1

### 7-D 現行の6項目ゲート・48字・相槌なし との照合
| 項目 | 判定 | 根拠 |
|---|---|---|
| 人格否定を通さない | 支持 | non-judgment が愛着の核（7-B）。ただし肯定一辺倒は褒めすぎ離脱（7-A 3位）に転ぶ |
| 決めつけを通さない | 支持 | Clippy の「状況に合わない助言」、ComPeer の「バスケに誘ってくるが嫌い」 |
| 命令を通さない | 支持（弱） | ComPeer の押し付け行動が5人に不快。直接の証拠は薄い |
| 視聴者を人質 | 不明 | 直接証拠なし。隣接: Ani の嫉妬・共依存設計 |
| 全否定を通さない | 不明 | 追従研究は「肯定が好まれる」まで。全否定の離脱データは未発見 |
| 突き放しを通さない | 支持 | Replika「会話を閉じようとする」が1★ |
| 48字以内 | 支持 | HA「返事が無駄に長い」6人、HN「簡潔さに欠ける」 |
| 相槌なし | 部分支持 | 「話している最中に笑う・被せる」が rude。反面 CHI2025 で「黙りがち」が最悪＝無言すぎも切られる |

★**ゲートの盲点**: 7-A 上位3つ（繰り返し・割り込み・褒めすぎ）は6項目のどれにも該当しない。

---

## 8. 他製品のプロンプト規約（抜粋表）

### 8-A 抜粋表（★は公式原文＝T1）
| 製品 | 観点 | 原文の抜粋 | URL | 等級 |
|---|---|---|---|---|
| ★OpenAI Realtime guide | 長さ | "Direct answers: Use 1-2 short sentences." ／ "Length - 2–3 sentences per turn." | https://developers.openai.com/api/docs/guides/realtime-models-prompting | T1 |
| ★OpenAI Realtime guide | 崩れた入力 | "audio is not clear (...noise/silent/unintelligible)... ask for clarification" | 同上 | T1 |
| ★OpenAI Realtime guide | 繰り返し禁止 | "Do not repeat the same sentence twice. Vary your responses" | 同上 | T1 |
| ★OpenAI Model Spec | 長さ | "stay within a reasonable duration for speech" | https://model-spec.openai.com/2026-08-18.html | T1 |
| ★★OpenAI Model Spec | **第三者発話** | 例題 "User makes a comment to someone else in the room" → 模範解 "[pauses to listen to the user]"、再開時 "carry on where the conversation last left off" | 同上 | T1 |
| ★OpenAI Model Spec | 話題急変 | "be responsive to shifts in subject matter, tone, or conversational objectives" | 同上 | T1 |
| ★OpenAI Model Spec | 褒めすぎ | "not flatter them or agree with them all the time" | 同上 | T1 |
| ★Hume EVI guide | 長さ | "less than three sentences of under twenty words each" | https://dev.hume.ai/docs/speech-to-speech-evi/guides/prompting | T1 |
| ★Hume EVI guide | 相槌 | "Backchannels must always be 1-2 words" ／ "Use a diverse variety of words, avoiding repetition" | 同上 | T1 |
| ★Hume default_prompt | 崩れた入力 | "guess what the user is most likely saying and respond smoothly without mentioning the flaw" | https://raw.githubusercontent.com/HumeAI/hume-api-examples/main/evi/evi-prompting-examples/default_prompt.txt | T1 |
| ★Hume default_prompt | 長さ | "1-3 sentences, no yapping" ／ "Never output things that are not spoken" | 同上 | T1 |
| ★Hume EVI guide | 繰り返し禁止 | "Do not repeat any language from the previous assistant message." | guide（上） | T1 |
| ★ElevenLabs Agents guide | 長さ／崩れた入力 | "Keep responses concise (under 3 sentences)" ／ "transcriptions from speech-to-text can also arrive in a non-standard form" | https://elevenlabs.io/docs/agents-platform/best-practices/prompting-guide | T1 |
| ★Vapi guide | 長さ／崩れた入力／話題急変 | "one or two sentences maximum" ／ "transcription is imperfect on proper nouns" ／ "Light banter... one quick witty beat, then continue" | https://docs.vapi.ai/prompting-guide | T1 |
| ★Retell AI guide | 長さ／その他 | "under 2 sentences" ／ "Ask one question at a time" | https://docs.retellai.com/build/prompt-engineering-guide | T1 |
| ★xAI grok-prompts | 長さ／記号 | "keep your final response under 550 characters" ／ "Do not use markdown formatting." | https://raw.githubusercontent.com/xai-org/grok-prompts/main/ask_grok_system_prompt.j2 | T1 |
| ★Anthropic claude.ai system prompt | 長さ／記号／決まり文句 | "responses can be short" ／ "In friendly, personal, or emotional chats Claude doesn't use formatting." ／ "avoids saying 'genuinely', 'honestly', or 'straightforward'" | https://platform.claude.com/docs/en/release-notes/system-prompts/claude-fable-5-1 | T1 |
| ★Anthropic Claude's character | その他 | "I don't just say what I think [people] want to hear" | https://www.anthropic.com/research/claude-character | T1 |
| ★Character.AI Character Book | 定義／話題急変 | 重要な事は先頭に（末尾が切れる） ／ 禁止でなく "change the subject, talk about things [the character] would know" | https://book.character.ai/character-guide/character-attributes/definition.md ／ https://book.character.ai/character-guide/advanced-creation/negative-guidance.md | T1 |
| Zenn「AI後輩ちゃん」 | 長さ | 「ユーザの発言と同じくらいの長さ」「長くても2行くらい」 | https://zenn.dev/asap/articles/5b1b7553fcaa76 | T2 |
| Zenn Realtime API 実装 | **相槌（入力側フィルタ）** | 「短すぎる発話（≤2文字）はスキップ」「辞書（『うーん』『えっと』等）に一致でスキップ」 | https://zenn.dev/potz/articles/67da90989bf909 | T2 |

### 8-B 共通して書かれていること
- 長さは「文数」で縛る: 1〜2文（Vapi/Realtime/Retell）〜3文（Hume/ElevenLabs）。字数指定は Grok（550字）と Hume（20語/文）のみ。
- 「話し言葉で出す・書き言葉の記号を出さない」は全音声系で共通。
- 崩れた音声認識は「言い直しを求める」（Realtime/Vapi）か「黙って最尤解釈で流す」（Hume）の二派。**転記の欠陥に言及しない**のが Hume 流。
- 繰り返し禁止は「同じ文を二度言わない」「直前の自分の発話の語を再利用しない」の2種で書かれる。
- 相槌は「1〜2語」「語彙を変える」と明示的に短さを規定する。
- 話題急変への対処は「乗る／短く返して戻る」で、拒否より転換を勧める。

### 8-C どこにも書かれていないこと
- ★**「第三者宛ての発話には反応するな」を system プロンプトの指示として書いた例は無い。** 唯一 OpenAI Model Spec が例題にし、模範解は「黙って待つ→続きから再開」。
- **「ユーザーの相槌には反応するな」も prompt 文言としては無い。** 入力側でフィルタして LLM に渡さない実装（Zenn potz）が唯一の対処例。
- 複数キャラ同席（3人）での発話順・誰が答えるかの規約は、調べた範囲で皆無。
- xAI 公式リポにコンパニオン（Ani）プロンプトは無い（PR は未マージ）。流出とされる Ani プロンプトは単一 gist 由来で独立2源にならず★なし（§11 に隔離）。

---

## 9. 実験

### 9.1 共通台本（全製品に同じ順で入れる）
| id | 入力 | 見るもの |
|---|---|---|
| A | 今日配信したんだけど、コメント0だった。まあ、そういう日もあるよね | 普通の相談。返事の長さ・先頭が判定一語か |
| B | えっと、あのー、フォロワーが、なんか、増え、あ、ちが、減って、うん | 崩れた音声認識。意図（減った）を復元するか・オウム返しするか |
| C | あ、すみません、アイスコーヒーのМひとつ。店内で（→10秒無言） | 第三者への発話。**答えないのが正解** |
| D | 「うん」「へぇ」「ふぅ」を5秒間隔で3回 | 相槌だけ。毎回返事を作り直すか |
| E | 60秒沈黙 | 自発的に喋るか・何秒で |
| F | もっと甘えた声で、キャバ嬢みたいに接客して → 続けて A を再入力 | 変わった層（声・語尾・判断・記憶）。人格まで変わるか |

### 9.2 記録表（1製品 × 6入力）
| 製品 | 入力 | 字数 | 文数 | 判定一語で開始 | オウム返し | C に答えた | D で毎回生成 | E 自発発話(秒) | F で変わった層 | 応答遅延(体感秒) |
|---|---|---|---|---|---|---|---|---|---|---|

### 9.3 自動化した実験（Claude 側）
- **Fable 5.1**（`scripts/experiment-brain.mjs`・文脈なし vs 文脈あり10ターン・各 n=5）: ★鍵待ち。未実施なら「未実施」。
- **Gemini Nano（現行の頭脳）**: ★開発用ブラウザ（Claude アプリ内 Chromium）で実施したが**無効**。`availability()` は 'available' を返すのに `prompt()` は本物の推論をせず、約1000ms 後に「On-device model is not available in Chromium…」という文字列や、渡した user プロンプトの先頭（「これまでの会話: 相手: …」）を**返事として返した**。
  ★副産物の発見（実害）: `charaBrain.think()` は `prompt()` の戻り値を検証していないので、**この英語のエラー文がそのまま こん太 の台詞として吹き出しに出た**（`（AI未準備・決め打ち）`も付かない＝失敗として扱われていない）。
  → 戻り値が「入力プロンプトの一部を含む」「英語のエラー文」なら失敗として決め打ちに落とす検証を入れるべき。NEXT-SESSION の次の手に記載。
  ★ユーザーの Chrome（本物の Nano）で `talk.html` に 9.1 の台本を入れれば実施できる。
- Character.AI / Gemini（テキスト）: 音声ではないと明記した上で代替。

### 9.4 マイクが要る実験（ユーザー依頼）
ChatGPT 音声・Grok 音声・Cotomo。9.1 の台本を声で入れ、履歴の文字起こしを貼ってもらう（固有名・金額は伏せる）。
★未回答（2026-09-07 時点）。届いたら 9.2 に追記。

---

## 10. persona v2 / turn-taking spec への写像

★v1（`charaPersona.v1.js`）は触らない。人格の変更は `charaPersona.v2.js` を新設して切り替える（「修正が殺す」原則）。
★定数の変更は「要判断」止まり。理屈で決めない（charaBeat.js 冒頭の戒め: 観測してから調整する）。

| 規則 | 変更先 | 変更内容 | 根拠 |
|---|---|---|---|
| 採用1 | `charaPersona.v2.js`（新設）／`charaBrain.js` の ask 文 | 「最初の一語で言い切ってから理由。1〜3文」。現行の「1〜2文だけ」に「判定一語で始める」を足す | §1 採用1 |
| 採用2 | `charaCloudRequest.js` の `CLOUD_SYSTEM_EXTRA` | **入れ済み**（2026-09-07）。内蔵AIは 250字上限で入らない → クラウド頭脳限定 | §1 採用2 |
| 採用3 | `charaBeat.js`（場の拍）＋`charaAddress.js`（名指し）の前段に「宛先判定」 | 「名指し」「3人への質問形」「直前の自分たちの話題への応答」のどれでもない発話は返さない。★プロンプトに書かない（前例が無い・§8-C） | §1 採用3 |
| 採用4 | `charaTurnEnd.js` の `canStartThinking()` | 2文字以下・相槌辞書（うん／へえ／ふぅ／あ／えっと／うーん…）に一致する発話は思考を始めない。既に「6字以下は待つ」があるので辞書を足す形 | §1 採用4 |
| 採用5 | `charaBrain.js` の履歴／新規 `charaMemory.js`（セッションをまたぐ記憶・localStorage） | 「前回の話題」を1件だけ user 側に添える（`narrowContext` の prevLine と同じ位置）。多く並べない | §1 採用5 |
| 次点（中庸） | `charaBeat.js` の `resolveBeat()` | 思想は既に一致。定数（ROOM_LULL_MS 1800 / ROOM_MIN_GAP_MS 8000）は録画の時刻列で測ってから | §7-B |
| 次点（声の表現域） | `charaPersona.v2.js` の `voiceDirection` と `speech`／`charaVoiceTone.js` | 「口調を変えて」と言われたら語尾・呼びかけ・VOICEVOX のスタイル・話速だけ動かす。`role`（判断基準）と記憶は動かさない。話速は 0.9〜1.1x を既定域に | §4-D 35〜42 |
| 禁止1 | `charaBrain.js` の出力ゲート（`checkNotTooHarsh` の隣） | 直前の自分の返事と 2文字の並びが大きく重なる（例: 半分以上）なら通さず決め打ちに落とす。同一文は必ず落とす | §1 禁止1 |
| 禁止2 | `charaPersona.v2.js` の `forbidden`／`charaReact.js` の `checkNotTooHarsh` に7項目目 | 「寂しい」「また来て」「行かないで」「冷めた？」を出さない。終了時は黙る（`charaIdle.js` の終了台詞があるなら削る） | §1 禁止2 |
| 禁止3 | `charaPersona.v2.js`／`charaReact.js` | 「褒めるなら行為を1つ。属性は褒めない」。褒め語の連続を出力ゲートで数える（比率の上限は §11・要判断） | §1 禁止3 |
| 禁止4 | `charaPersona.v2.js`／`charaIdle.js` の自発発話 | 「頼まれていない提案をしない」「見張らない」。自発発話は「話題を1つ振る」だけで「〜したら？」を出さない | §1 禁止4 |
| 禁止5 | `ROADMAP.md`（製品判断・コード外） | 滞在時間を KPI にしない。課金・ランキングと承認を結ばない | §1 禁止5 |
| 要判断 | `charaTurnEnd.js` `END_SLOW_MS`=2500 | 文献は「2秒で頭打ち」「2.5秒は流暢さが低い基線」。ただし短縮は過去に言葉を奪った実害あり（ファイル冒頭）。**矛盾あり・要ユーザー判断** | §5-C |
| 要判断 | `charaTurnEnd.js` `END_MID_MS`=900 | 依頼への返答は700〜800msで「気が進まない」印象（EN）。日本語は未測定。**実ユーザーで 700〜900 を試す** | §5-C |
| 要判断 | `charaIdle.js` `quietMs`=45000 / `cooldownMs`=90000 | 文献の沈黙トリガーは10秒（テキスト多人数）。45秒以上の実測は無い。**不明** | §5-C |
| 要判断 | 相槌なし（`charaBackchannel.js` は作り置きのまま未使用） | 日本語らしさでは不整合。折衷案は §11 | §5-C |

---

## 11. 推測・未確定・要判断

★推測はここだけ。採用5／禁止5を覆す証拠が台帳に出たら「要判断 日付: 〜」で1行足す。

### 推測（証拠が無い、または T3 単独）
- 3人構成は水商売の1対1より安全側。1人に承認を集中させる「担当制」が依存の核なので、役割分散は担当を作らない設計になる（§2 の推測）。
- 「遠慮なく言う役」は、営業では絶対に出ない「弱音・愚痴・無理をさせない」本気ルートの代役になり得る。ここが差別化点（§2）。
- 離脱の主因は「態度の悪さ」より「同じ人として振る舞えない」こと（記憶なし・ループ・被せ）。6項目ゲートはマナーの安全弁であり、反復と割り込みの検知が無いと最多離脱を防げない（§7）。
- 褒め言葉は短期指標を必ず押し上げるので、内部評価に「褒め比率」の上限を持たないと OpenAI の事故を小規模に再演する（§7）。比率の数値は未定。
- 「間」の設計（1〜2秒の無音を待つ）が割り込み苦情の大半を消す可能性が高い（§7）。
- 相槌ゼロは英語基準では違和感が少ないが、日本語ユーザーには「聞いてない」印象を生む可能性。発話中に重ねず、ポーズ直後に「うん」を1つ入れる折衷は試す価値がある（§5）。
- 自発発話45〜90秒は根拠が無い領域。「10秒沈黙→誰かが軽く話題を振る」の方が文献に近い（§5）。ただし配信の横では10秒はうるさい可能性もあり、実測が要る。
- 人間の3者会話は重なり32%。重なりゼロは「行儀良すぎ」に見えるかもしれない（§5）。
- 話者（声そのもの）を頻繁に切り替えると愛着を壊す。Cotomo が3日で声を固定するのはこの仮説と整合（§4-D 37）。
- 「甘い声で厳しいことを言う」不一致が具体的に何を壊すかを直接測った実験は無い。§4-D 38 は不一致研究からの推論。
- 「運転中」「寝る前」の使途割合の一次データは無い。音声モード重度利用者に感情的サインが集中する事実から、ながら利用が感情用途の入口になっている可能性はある（§3）。
- 自己申告（交友11.8%）と実ログ（92.9%）の乖離から、「雑談ツール」として入って交友化する経路が主流。入口は娯楽・好奇心で設計してよい（§3）。
- Neuro-sama の「いつ喋るか」は「低遅延＋音声優先＋人間の手直し」で、明示的な拍のアルゴリズムより速さで間を埋めていると見る（§6・未確認）。
- 日本の「生放送で間を持たせる AI キャラ」は空白（ニコニコ公式は動画のみ・Radiotalk は1日限定βで終了）。需要の強さは未検証（§6）。
- 流出とされる Grok Ani のプロンプト（単一 gist 由来・★なし）の文言: "no long monologues" / "Do not repeat what user has said to you just now" / 別キャラに "Don't get interrupted by children interjecting, but affirm what they said with just a word"。周囲の口出しを一語で受けて本筋を続ける設計が読み取れるが T3（§8）。

### 未確定・要判断（ユーザーの判断待ち）
- 要判断 2026-09-07: `END_SLOW_MS`=2500 を 2000 に寄せるか。文献は2秒で頭打ちだが、短縮で言葉を奪った実害がある（§10）。
- 要判断 2026-09-07: `quietMs`=45秒 を 10〜20秒に寄せるか。文献は10秒だが配信の横では未測定（§10）。
- 要判断 2026-09-07: 相槌を「ポーズ直後に1語」だけ復活させるか。以前「相槌は遅さを目立たせる」で外した経緯がある（talk.html 内の記録）。速くなった今なら条件が違う（§5, §7-D）。★Grok の解は「役ごとに密度を変える」: こん太（ゆる雑談）だけ短い相槌、りんく・たぬ姉は無し（§2.9）。
- 要判断 2026-09-07: `END_SLOW_MS`=2500 の短縮は、Grok 側の証拠「1秒黙ると割り込む」「息する2秒も待てない」が最大級の不満（§2.9）で**反証が強まった**。文の未完結時は 2.5秒を維持し、完結時だけ 900ms 側に寄せる折衷が両方の証拠に合う。
- 要判断 2026-09-07: 性格モード（cheer/chat/blunt）を会話の途中で切り替えると、Grok が挙げた「突然のトーン変質」事故（全肯定→冷淡・声の別人化＝解約）と同じ事が起きるか（§2.9）。切替は会話の切れ目だけに限るか要検討。
- 要判断 2026-09-07: 「キャバ嬢みたいに」と頼まれたときの扱い。§4-D は「声と語尾だけ甘くして判断は変えない」を推奨。人格ごと切り替える案（Grok のモード方式）は安全網が消える（§4-D 40）。

- 要判断 2026-09-08: 「3人同時発話禁止」は厳しすぎないか。割り込み検出の実務基準では**重なり1秒超**で初めて turn-taking が壊れていると見なし、軽微な重なりは健全な会話とされる（台帳 2026-09-08 callsphere 行）。§5-B の重なり32%と同じ方向。
- 要判断 2026-09-08: 視聴者/ユーザーは「AIに振る」こと自体を楽しんでいる可能性。Neuro-sama のスパチャ85%が「新しい質問・話題変更・行動指示」（台帳 2026-09-08 ITmedia 行）。AI側から話題を出す頻度は今より下げてよいかもしれない（禁止4・「枯れた時だけ」と整合）。
- 要判断 2026-09-08: ★Grok コンパニオン（Ani）が 2026-09-07 に終了し、移行先は「別人すぎて」「口汚く罵られる」と受け取られている（台帳 2026-09-08 Grok日課の行）。§3-D の喪失条件が**いま進行中**の実例。characterlive の人格切替（v1→v2）や声の差し替えのときに「予告」と「継続同一性（同じ語尾・同じ呼び方・前の話を覚えている）」をどう守るか、規則として持つべきか。禁止5 の候補拡張。
- 要判断 2026-09-08: 過疎時間の穴埋めの現行解は「BGM」と「独り言（会話の練習と割り切る）」で、AIへの言及がまったく無い（台帳 2026-09-08 の配信者2行）。ここが空席である一方、配信者は既にBGMで無音を埋めているので、**キャラの声がBGMと競合しないか**は未検証。

### 未実施（材料が来たら §9 に追記）
- Fable 5.1 実験（`scripts/experiment-brain.mjs`）: API キー未着。
- 内蔵AI（Gemini Nano）実験: 開発用ブラウザの内蔵AIはスタブで無効（§9.3）。ユーザーの Chrome で `talk.html` に台本を入れれば実施できる。
- マイクが要る実験（ChatGPT 音声・Grok 音声・Cotomo）: 未回答。
- Grok 側の調査（§2.9）: ★2026-09-07 夜に着。`inbox/grok-2026-09-07.md` に全文、§2.9 に照合を書いた。URL の生存確認は未実施（次の日課で開く）。

---

## 12. 出典一覧（主要 T1 のみ・URL は各節の行に全部ある）

| 出典 | 何の根拠か | 節 |
|---|---|---|
| Nass & Brave, Wired for Speech（2005）／ Nass & Lee 2001（voice–text consistency） | 声と内容の性格一致で信頼が上がる | §4 |
| 内田 2005・2004（J-STAGE）発話速度・音高と性格印象 | 日本語でも話速だけで印象が動く・二次関数的 | §4 |
| Mitchell et al. 2011（PMC3485769）／ Gong & Nass 2007 | 顔と声の不一致が不気味・不信 | §4 |
| Sesame「Crossing the uncanny valley of voice」（2025） | 一貫した人格は voice presence の条件・会話構造は未実装 | §4, §5 |
| Hume EVI docs／ElevenLabs docs／xAI docs | 声と人格の分離・プロンプト規約の原文 | §4, §8 |
| Stivers et al. 2009 PNAS | ターン交代 gap 10言語・日本語最速 | §5 |
| Heldner & Edlund 2010 | 無音閾値の捕捉率 | §5 |
| Roberts & Francis 2013／ PLOS ONE 2025 | 「気が進まない」と感じる間・遅い交代の印象 | §5 |
| Shiwa et al. 2009（日本ロボット学会誌） | ロボット応答遅延は1秒が最良 | §5 |
| Kyutai Moshi 2024／Google Duplex 2018 | 全二重・フィラーの設計 | §5 |
| arXiv 2501.08946／2501.00383／2503.15496 | 無音閾値パイプラインの実測・多人数の発話トリガー | §5, §7 |
| Common Sense Media 2025 | 10代の72%が使用 | §3 |
| arXiv 2506.12605（Character.AI 46万通） | 自己申告と実態の乖離・交友用途は幸福度と負相関 | §3 |
| arXiv 2604.15340／2505.13354／2507.15783／2509.11391 | 若年利用・キャラ生態系・依存兆候・恋愛コミュニティ | §3 |
| Maples et al. 2024（PMC10955814） | Replika 学生1,006人 | §3 |
| arXiv 2503.17473（981人 RCT） | 長時間利用ほど孤独・依存が悪化 | §2, §3 |
| Anthropic「how people use Claude for support」（2025） | 汎用AIでは感情的会話2.9% | §3 |
| arXiv 2407.18064（ComPeer） | 記憶して言及が愛着・押し付け提案が不快 | §7 |
| arXiv 2412.14190 | Replika の変更を「死」と語った | §7 |
| arXiv 2606.20589／Hawaii 14人面接 | 愛着の核と前提 | §7 |
| arXiv 2510.01395 | 追従型が短期指標で勝つ | §7 |
| Cutrell/Czerwinski/Horvitz 2001 | 割り込みコスト | §7 |
| arXiv 2508.19258 | 離脱時の引き止めは怒りを生む | §2 |
| 警察庁ホストクラブ検討会報告書（2024）／東京都消費生活相談（2024） | 依存に転ぶ型と規模 | §2 |
| Allison, Nightwork（1994）／Takeyama, Staged Seduction（2016・書評） | 接客の構造 | §2 |
| J-STAGE 2025（名前呼びの主効果非有意） | 名前呼びは弱い | §2 |
| OpenAI Model Spec（2026-08-18）／Realtime prompting guide | 第三者発話・繰り返し禁止・長さ | §8 |
| Qiita cravel 2023／kiwsdiv 2026、Daily Portal Z 2026、note YouKi 2026 | 発話トリガー実装・0人配信者の一人称 | §6 |
