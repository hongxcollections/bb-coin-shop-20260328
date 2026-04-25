/**
 * 將 UAT 資料庫資料複製到 Production（緊急恢復用）
 * UAT:        mainline.proxy.rlwy.net:34622    / bbcoinshop_uat
 * Production: interchange.proxy.rlwy.net:59081 / bbcoinshop
 */
import mysql2 from 'mysql2/promise';

const UAT  = { host: 'mainline.proxy.rlwy.net',   port: 34622,  user: 'uatuser', password: 'uatpass456', database: 'bbcoinshop_uat', connectTimeout: 20000 };
const PROD = { host: 'interchange.proxy.rlwy.net', port: 59081,  user: 'bbuser',  password: 'bbpass123',  database: 'bbcoinshop',     connectTimeout: 20000 };

const SKIP_TABLES = new Set(['__drizzle_migrations']);

async function copyTable(src: mysql2.Connection, dst: mysql2.Connection, table: string) {
  // 確認目標表存在
  try {
    await dst.execute(`SELECT 1 FROM \`${table}\` LIMIT 1`);
  } catch {
    console.log(`  ⚠️  ${table}: Production 沒有此表，略過`);
    return;
  }

  const [rows] = await src.execute(`SELECT * FROM \`${table}\``);
  const data = rows as Record<string, unknown>[];

  if (data.length === 0) {
    console.log(`  ⏩ ${table}: 空資料表，略過`);
    return;
  }

  // 取得兩邊的共同欄位（避免欄位不一致問題）
  const [srcCols] = await src.execute(`DESCRIBE \`${table}\``);
  const [dstCols] = await dst.execute(`DESCRIBE \`${table}\``);
  const srcFields = new Set((srcCols as any[]).map(r => r.Field));
  const dstFields = new Set((dstCols as any[]).map(r => r.Field));
  const commonFields = [...srcFields].filter(f => dstFields.has(f));

  await dst.execute(`DELETE FROM \`${table}\``);

  const cols = commonFields.map(c => `\`${c}\``).join(', ');
  const batchSize = 200;
  let inserted = 0;

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const placeholders = batch.map(() => `(${commonFields.map(() => '?').join(', ')})`).join(', ');
    const values = batch.flatMap(row => commonFields.map(f => row[f]));
    await dst.execute(`INSERT INTO \`${table}\` (${cols}) VALUES ${placeholders}`, values);
    inserted += batch.length;
  }

  console.log(`  ✅ ${table}: 已複製 ${inserted} 筆記錄`);
}

async function main() {
  console.log('🔗 連接資料庫...');
  const src = await mysql2.createConnection(UAT);
  const dst = await mysql2.createConnection(PROD);

  await dst.execute('SET FOREIGN_KEY_CHECKS = 0');

  try {
    const [tableRows] = await src.execute('SHOW TABLES');
    const tables = (tableRows as Record<string, string>[]).map(r => Object.values(r)[0]);
    const copyTables = tables.filter(t => !SKIP_TABLES.has(t));

    console.log(`\n📦 UAT 有 ${tables.length} 個資料表，複製到 Production\n`);

    for (const table of copyTables) {
      await copyTable(src, dst, table);
    }

    console.log('\n🎉 完成！UAT 所有資料已同步到 Production');

    // 最終確認
    const checks = ['users','auctions','merchantProducts','deposit_transactions','site_settings'];
    console.log('\n📊 Production 資料確認：');
    for (const t of checks) {
      try {
        const [r] = await dst.execute('SELECT COUNT(*) as cnt FROM \`' + t + '\`');
        console.log('  -', t + ':', (r as any[])[0].cnt, '筆');
      } catch { console.log('  -', t + ': 無法查詢'); }
    }
  } finally {
    await dst.execute('SET FOREIGN_KEY_CHECKS = 1');
    await src.end();
    await dst.end();
  }
}

main().catch(err => {
  console.error('❌ 複製失敗:', err.message);
  process.exit(1);
});
