import { drizzle } from 'drizzle-orm/mysql2';
import { createPool } from 'mysql2/promise';
import { migrate } from 'drizzle-orm/mysql2/migrator';

const pool = createPool('mysql://uatuser:uatpass456@mainline.proxy.rlwy.net:34622/bbcoinshop_uat');
const db = drizzle(pool);
console.log('開始跑 UAT migrations...');
await migrate(db, { migrationsFolder: './drizzle' });
console.log('✅ Migrations 完成，所有資料表已重建！');
await pool.end();
