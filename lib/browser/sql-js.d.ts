// sql.js 1.14.2 未随包发布类型定义（dist 下无 .d.ts），此处声明本项目实际用到的最小面。
// 仅覆盖 lib/browser/sqlite.ts 与 drizzle-orm/sql-js 需要的签名，不是完整类型。
declare module "sql.js" {
  export interface QueryExecResult {
    columns: string[];
    values: unknown[][];
  }

  export class Database {
    constructor(data?: Uint8Array | null);
    /** 执行 SQL（可含多条语句）；第二个参数为可选绑定值 */
    run(sql: string, params?: unknown[]): this;
    /** 执行并返回结果集 */
    exec(sql: string, params?: unknown[]): QueryExecResult[];
    /** 取回整个库的字节（落盘用） */
    export(): Uint8Array;
    /** 释放 wasm 内存 */
    delete(): void;
  }

  export interface SqlJsStatic {
    Database: typeof Database;
  }

  export interface SqlJsConfig {
    /** 返回 .wasm 的加载地址 */
    locateFile?: (file: string) => string;
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}
