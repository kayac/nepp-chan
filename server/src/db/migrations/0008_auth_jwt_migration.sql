-- WebAuthn → JWT 認証移行
-- 既存ユーザーは削除前提（再招待で対応）

-- 依存テーブルを先に削除
DROP TABLE IF EXISTS admin_credentials;
DROP TABLE IF EXISTS auth_challenges;
DROP TABLE IF EXISTS admin_sessions;

-- 既存テーブルを削除して新スキーマで再作成
DROP TABLE IF EXISTS admin_invitations;
DROP TABLE IF EXISTS admin_users;

-- 管理者ユーザー（email → username, passwordHash 追加）
CREATE TABLE admin_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'admin',
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- 管理者招待（email → username）
CREATE TABLE admin_invitations (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE,
  invited_by TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

-- 管理者セッション（Refresh Token ストア）
CREATE TABLE admin_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_accessed_at TEXT
);
