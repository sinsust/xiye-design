-- M3/M4：brain_notes 的 obsidian 直连溯源列（决策 13/14）
-- 桌面运行态落地前仅做列预留，不做 watcher/写回；obsidian 内容在 vault 为授权源，
-- 本列只存「只读索引镜像」的溯源标识（vault 名 / 相对路径 / note id / 同步时间）。
alter table brain_notes add column if not exists obsidian_vault text;
alter table brain_notes add column if not exists obsidian_rel_path text;
alter table brain_notes add column if not exists obsidian_note_id text;
alter table brain_notes add column if not exists obsidian_synced_at text;