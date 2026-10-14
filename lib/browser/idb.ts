// 浏览器端 SQLite 字节持久层：整库以 Uint8Array 存进 IndexedDB。
//
// 为什么存整库字节而不是逐行：sql.js 是内存库，唯一的落盘方式是 db.export() 全量导出。
// 代价是每次写后要重写一次全库（当前本地库量级约几百 KB，单次导出/写入约几十毫秒），
// 换来的是 node 轨道与浏览器轨道共用同一份 DDL 与同一套 drizzle 查询，业务零改动。
//
// 位置：数据只存在于「这台设备 + 这个浏览器 + 这个源(origin)」，
// 清浏览器数据即丢库 —— 因此必须配合「导出/导入 .db 文件」作为唯一备份手段。

const IDB_NAME = "xiye-browser";
const IDB_STORE = "kv";
const IDB_KEY = "sqlite-db";

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) {
        req.result.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });
}

/** 读库字节；首次使用（库里还没东西）返回 null */
export async function readDbBytes(): Promise<Uint8Array | null> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
    req.onsuccess = () => {
      const v = req.result;
      resolve(v ? new Uint8Array(v as ArrayBuffer) : null);
    };
    req.onerror = () => reject(req.error ?? new Error("indexedDB get failed"));
  });
}

/** 写库字节（整库覆盖） */
export async function writeDbBytes(bytes: Uint8Array): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    // 复制成独立 ArrayBuffer 再存：避免 Transferable/实时视图失效导致存了空 buffer
    const copy = bytes.slice().buffer;
    tx.objectStore(IDB_STORE).put(copy, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("indexedDB put failed"));
    tx.onabort = () => reject(tx.error ?? new Error("indexedDB put aborted"));
  });
}

/** 删库（导入 .db 覆盖前的清理） */
export async function clearDbBytes(): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("indexedDB delete failed"));
  });
}
