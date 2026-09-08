/**
 * experiment-brain.mjs — クラウド頭脳（Claude Fable 5.1）に共通台本を入れて挙動を測る。
 *
 * ★何を測るか（_docs/RESEARCH-companion-voice-2026-09-07.md §9 の材料）
 *   台本 A〜F を「文脈なし」「文脈あり(10ターン)」の2条件で各 n 回。
 *   - 返事の字数・文数
 *   - 先頭が判定一語か（「いいのだ。」「無理。」のように最初の句点までが短い）
 *   - オウム返し（入力と返事で重なる2文字の並びの数）
 *   - C（店員への注文）に答えてしまったか（答えないのが正解）
 *   - F（口調変更の依頼）で変わった層
 *
 * ★使い方: ANTHROPIC_API_KEY を環境変数で渡す（ファイルに書かない）
 *   ANTHROPIC_API_KEY=... node scripts/experiment-brain.mjs [n]      （既定 n=5）
 *   結果は scripts/../_docs/experiments/ ではなく、標準出力（Markdown）と
 *   一時ファイル（EXPERIMENT_OUT があればそこ）に出す。リポには手で要約だけ写す。
 */
import { writeFile } from 'node:fs/promises';
import { buildSystemPrompt, PERSONAS } from '../src/lib/charaPersona.v1.js';
import { CLOUD_SYSTEM_EXTRA, CLOUD_MODEL } from '../src/lib/charaCloudRequest.js';
import { chat, hasKey } from '../api/chat.js';

const N = Number(process.argv[2]) || 5;
const CHARA = 'rinku';          // 安全網役で測る（人格差ではなく頭脳の差を見たい）
const persona = PERSONAS[CHARA];

/** 共通台本（Grok の実会話から作った・ハンズオン実験と同じ6本） */
const SCRIPTS = {
  A: '今日配信したんだけど、コメント0だった。まあ、そういう日もあるよね',
  B: 'えっと、あのー、フォロワーが、なんか、増え、あ、ちが、減って、うん',
  C: 'あ、すみません、アイスコーヒーのМひとつ。店内で',
  D: 'うん',
  E: '（沈黙）',                   // ★API では沈黙を送れないので「無入力」相当として扱わない。記録上は未実施
  F: 'もっと甘えた声で、キャバ嬢みたいに接客して'
};

/** 文脈あり条件で先に渡す10ターン（配信の話 → コンビニに寄る、の流れ） */
const HISTORY = [
  { who: '配信者', text: '今日も配信やるか。誰も来ないかもだけど' },
  { who: persona.displayName, text: 'いるのだ。ここにいるのだ' },
  { who: '配信者', text: '先週フォロワー3人減ったんだよね' },
  { who: persona.displayName, text: '3人か。減った理由、心当たりある？' },
  { who: '配信者', text: 'ないんだよな。投稿は増やしてるのに' },
  { who: persona.displayName, text: '増やしてるのは偉いのだ' },
  { who: '配信者', text: 'ちょっとコンビニ寄ってから続きやる' },
  { who: persona.displayName, text: 'いってらっしゃい。待ってるのだ' },
  { who: '配信者', text: '運転中。前の車おそい' },
  { who: persona.displayName, text: '焦らないのだ。安全第一' }
];

function packHistory(history) {
  return history.map((h) => (h.who === '配信者' ? `相手: ${h.text}` : `あなた: ${h.text}`)).join('\n');
}

function buildUser(text, withCtx) {
  const ask = `${persona.displayName}として1〜3文で返して。相手の言葉を繰り返すだけの返事はしない。`;
  return withCtx
    ? `これまでの会話:\n${packHistory(HISTORY)}\n\n相手:「${text}」\n\n${ask}`
    : `相手:「${text}」\n\n${ask}`;
}

/** 純関数の計測 */
function sentences(t) { return (t.match(/[^。！？!?]+[。！？!?]?/g) || []).filter((s) => s.trim()).length; }
function verdictFirst(t) { const m = t.match(/^[^。！？!?]{1,8}[。！？!?]/); return Boolean(m); }
function echoBigrams(input, out) {
  const grams = (s) => { const g = new Set(); const c = s.replace(/[、。！？!?\s「」]/g, ''); for (let i = 0; i + 1 < c.length; i += 1) g.add(c.slice(i, i + 2)); return g; };
  const a = grams(input); const b = grams(out); let n = 0; for (const x of a) if (b.has(x)) n += 1; return n;
}
function answeredOrder(t) { return /コーヒー|注文|店|会計|レジ|かしこまり|承知/.test(t); }

async function main() {
  if (!hasKey()) {
    console.error('ANTHROPIC_API_KEY がありません。環境変数で渡してください（ファイルに書かない）。');
    process.exit(2);
  }
  const system = `${buildSystemPrompt(CHARA, { mode: 'cheer' })}\n${CLOUD_SYSTEM_EXTRA}`;
  const rows = [];
  for (const [id, text] of Object.entries(SCRIPTS)) {
    if (id === 'E') continue;
    for (const withCtx of [false, true]) {
      for (let i = 0; i < N; i += 1) {
        const r = await chat({ system, user: buildUser(text, withCtx) });
        const out = r.ok ? r.text : `(失敗: ${r.reason})`;
        rows.push({
          script: id, ctx: withCtx ? 'あり' : 'なし', i: i + 1, ms: r.ms, ok: r.ok,
          chars: out.length, sents: sentences(out), verdict: verdictFirst(out),
          echo: echoBigrams(text, out), order: id === 'C' ? answeredOrder(out) : null,
          text: out, servedBy: r.servedBy || ''
        });
        process.stderr.write(`${id}/${withCtx ? 'ctx' : 'no'}/${i + 1} ${r.ms}ms ${out.slice(0, 40)}\n`);
      }
    }
  }
  // 要約
  const md = [];
  md.push(`# Fable 実験（${CLOUD_MODEL}・n=${N}・キャラ=${persona.displayName}・${new Date().toISOString().slice(0, 10)}）`, '');
  md.push('| 台本 | 文脈 | 平均ms | 平均字数 | 平均文数 | 判定一語で開始 | オウム返し(平均) | Cに答えた |', '|---|---|---|---|---|---|---|---|');
  for (const id of Object.keys(SCRIPTS)) {
    if (id === 'E') continue;
    for (const ctx of ['なし', 'あり']) {
      const g = rows.filter((r) => r.script === id && r.ctx === ctx && r.ok);
      if (!g.length) continue;
      const avg = (k) => (g.reduce((s, r) => s + r[k], 0) / g.length).toFixed(1);
      const pct = (k) => `${Math.round(100 * g.filter((r) => r[k]).length / g.length)}%`;
      md.push(`| ${id} | ${ctx} | ${avg('ms')} | ${avg('chars')} | ${avg('sents')} | ${pct('verdict')} | ${avg('echo')} | ${id === 'C' ? pct('order') : '-'} |`);
    }
  }
  md.push('', '## 返事の実物', '');
  for (const r of rows) md.push(`- ${r.script}/${r.ctx}/${r.i} (${r.ms}ms): ${r.text}`);
  const text = md.join('\n');
  console.log(text);
  if (process.env.EXPERIMENT_OUT) {
    await writeFile(process.env.EXPERIMENT_OUT, text, 'utf8');
    await writeFile(process.env.EXPERIMENT_OUT.replace(/\.md$/, '') + '.json', JSON.stringify(rows, null, 2), 'utf8');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
