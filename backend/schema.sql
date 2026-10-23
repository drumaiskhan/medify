BEGIN;
CREATE TABLE IF NOT EXISTS accounts (
 id text PRIMARY KEY, email text NOT NULL UNIQUE, password_hash text NOT NULL,
 role text NOT NULL DEFAULT 'student' CHECK(role IN ('student','admin')),
 email_verified boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY, account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_account ON sessions(account_id);
CREATE TABLE IF NOT EXISTS auth_tokens (
 token_hash text PRIMARY KEY, account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('reset','verify')), expires_at timestamptz NOT NULL
);
-- JSONB preserves the source app's existing field shapes and curriculum IDs.
CREATE TABLE IF NOT EXISTS records (
 collection text NOT NULL CHECK(collection IN ('years','blocks','subjects','chapters','subjectContent','subjectParts','chapterContent','users','paymentRequests','settings')),
 id text NOT NULL, data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(collection,id)
);
CREATE INDEX IF NOT EXISTS records_data ON records USING gin(data);
CREATE INDEX IF NOT EXISTS records_user ON records(collection,(data->>'userId'));
CREATE TABLE IF NOT EXISTS rate_limits (key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL);
COMMIT;

-- Additive library extension; existing accounts and curriculum records are preserved.
CREATE TABLE IF NOT EXISTS site_settings (
 id integer PRIMARY KEY CHECK(id=1), data jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS books (
 id text PRIMARY KEY, title text NOT NULL, author text NOT NULL DEFAULT '',
 description text NOT NULL DEFAULT '', year_id text NOT NULL, category text NOT NULL DEFAULT '',
 published boolean NOT NULL DEFAULT false, is_free boolean NOT NULL DEFAULT false,
 pdf_path text NOT NULL, cover_path text, page_count integer NOT NULL CHECK(page_count>0),
 file_bytes bigint NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS books_year_published ON books(year_id,published);
CREATE TABLE IF NOT EXISTS book_progress (
 account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 book_id text NOT NULL REFERENCES books(id) ON DELETE CASCADE,
 page integer NOT NULL DEFAULT 1, favorite boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(account_id,book_id)
);
CREATE TABLE IF NOT EXISTS book_marks (
 id text PRIMARY KEY, account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 book_id text NOT NULL REFERENCES books(id) ON DELETE CASCADE,
 page integer NOT NULL, kind text NOT NULL CHECK(kind IN ('bookmark','note','highlight','ink')),
 data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS book_marks_owner ON book_marks(account_id,book_id);

-- Device limit support and per-student reading state (highlights, last position).
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE IF NOT EXISTS note_state (
 account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 subject_id text NOT NULL, data jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(account_id,subject_id)
);

-- Discount coupons. Prices stay authoritative on the server; a coupon only lowers the amount
-- recorded on a payment request. One use per student; a rejected payment releases its use.
CREATE TABLE IF NOT EXISTS coupons (
 id text PRIMARY KEY, code text NOT NULL UNIQUE,
 discount_type text NOT NULL CHECK(discount_type IN ('percent','fixed')),
 discount_value numeric(12,2) NOT NULL CHECK(discount_value>0),
 active boolean NOT NULL DEFAULT true,
 max_uses integer CHECK(max_uses IS NULL OR max_uses>0),
 used_count integer NOT NULL DEFAULT 0,
 expires_at timestamptz, plan_ids text[], year_ids text[],
 note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS coupon_redemptions (
 coupon_id text NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
 account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 payment_id text NOT NULL, discount_amount numeric(12,2) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(coupon_id,account_id)
);
CREATE INDEX IF NOT EXISTS coupon_redemptions_payment ON coupon_redemptions(payment_id);

-- v1.6: feedback and in-app notifications. Additive and safe to rerun.
CREATE TABLE IF NOT EXISTS feedback (
 id text PRIMARY KEY, account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 category text NOT NULL DEFAULT 'general', message text NOT NULL,
 rating integer CHECK(rating BETWEEN 1 AND 5),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','replied','reviewed')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feedback_account ON feedback(account_id,created_at DESC);
CREATE TABLE IF NOT EXISTS feedback_replies (
 id text PRIMARY KEY, feedback_id text NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
 author_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 author_role text NOT NULL CHECK(author_role IN ('admin','student')), message text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feedback_replies_thread ON feedback_replies(feedback_id,created_at);
CREATE TABLE IF NOT EXISTS notifications (
 id text PRIMARY KEY, account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 title text NOT NULL, body text NOT NULL DEFAULT '', type text NOT NULL DEFAULT 'info', link text,
 is_read boolean NOT NULL DEFAULT false, batch_id text, audience text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_owner ON notifications(account_id,created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_batch ON notifications(batch_id);
