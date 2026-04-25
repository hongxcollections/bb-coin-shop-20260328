/**
 * 將 Production 資料庫資料複製到 UAT
 * Production: interchange.proxy.rlwy.net:59081 / bbcoinshop
 * UAT:        mainline.proxy.rlwy.net:34622    / bbcoinshop_uat
 */
import mysql2 from 'mysql2/promise';

const PROD = { host: 'interchange.proxy.rlwy.net', port: 59081, user: 'bbuser',  password: 'bbpass123',  database: 'bbcoinshop',     connectTimeout: 20000 };
const UAT  = { host: 'mainline.proxy.rlwy.net',   port: 34622,  user: 'uatuser', password: 'uatpass456', database: 'bbcoinshop_uat', connectTimeout: 20000 };

// 跳過這些資料表（系統自有，不需複製）
const SKIP_TABLES = new Set(['__drizzle_migrations']);

async function copyTable(prod: mysql2.Connection, uat: mysql2.Connection, table: string) {
  const [rows] = await prod.execute(`SELECT * FROM \`${table}\``);
  const data = rows as Record<string, unknown>[];

  if (data.length === 0) {
    console.log(`  ⏩ ${table}: 空資料表，略過`);
    return;
  }

  // 清空 UAT 資料表
  await uat.execute(`DELETE FROM \`${table}\``);

  // 批次 INSERT（每 200 筆一批）
  const cols = Object.keys(data[0]).map(c => `\`${c}\``).join(', ');
  const batchSize = 200;
  let inserted = 0;

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const placeholders = batch.map(() => `(${Object.keys(data[0]).map(() => '?').join(', ')})`).join(', ');
    const values = batch.flatMap(row => Object.values(row));
    await uat.execute(`INSERT INTO \`${table}\` (${cols}) VALUES ${placeholders}`, values);
    inserted += batch.length;
  }

  console.log(`  ✅ ${table}: 已複製 ${inserted} 筆記錄`);
}

async function main() {
  console.log('🔗 連接資料庫...');
  const prod = await mysql2.createConnection(PROD);
  const uat  = await mysql2.createConnection(UAT);

  // 關閉外鍵約束（避免插入順序問題）
  await uat.execute('SET FOREIGN_KEY_CHECKS = 0');

  try {
    const [tableRows] = await prod.execute('SHOW TABLES');
    const tables = (tableRows as Record<string, string>[]).map(r => Object.values(r)[0]);
    const copyTables = tables.filter(t => !SKIP_TABLES.has(t));

    console.log(`\n📦 Production 有 ${tables.length} 個資料表，複製 ${copyTables.length} 個到 UAT\n`);

    for (const table of copyTables) {
      await copyTable(prod, uat, table);
    }

    console.log('\n🎉 複製完成！所有 Production 資料已同步到 UAT');
  } finally {
    await uat.execute('SET FOREIGN_KEY_CHECKS = 1');
    await prod.end();
    await uat.end();
  }
}

main().catch(err => {
  console.error('❌ 複製失敗:', err.message);
  process.exit(1);
});
