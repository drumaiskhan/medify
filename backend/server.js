const express = require("express");
const crypto = require("node:crypto");
const {
  hashToken,
  passwordHash,
  passwordMatches,
  fail,
  validatePassword,
} = require("./security");
const records = require("./data");
function createApp(pool, { sendMail } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS || 0));
  const origins = (
    process.env.FRONTEND_ORIGINS ||
    "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001"
  )
    .split(",")
    .map((s) => s.trim());
  const production = process.env.NODE_ENV === "production";
  const secure = production || process.env.COOKIE_SECURE === "true";
  const cookie = `Path=/api; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
  const asyncRoute = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store",
    });
    const origin = req.headers.origin;
    if (origin && !origins.includes(origin))
      return res.status(403).json({ error: "Origin not allowed" });
    if (origin) {
      res.set("Access-Control-Allow-Origin", origin);
      res.vary("Origin");
      res.set("Access-Control-Allow-Credentials", "true");
      res.set("Access-Control-Allow-Headers", "Content-Type, Range, Authorization");
      res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    // Browser mutations require an allowlisted origin, preventing cookie-based CSRF.
    if (req.method === "POST" && !origin)
      return res.status(403).json({ error: "Origin header required" });
    next();
  });
  app.use(express.json({ limit: "25mb" }));
  app.use(
    "/api",
    asyncRoute(async (req, res, next) => {
      const authorization=req.headers.authorization;
      const raw = authorization !== undefined ? (/^Bearer ([a-f0-9]{64})$/.exec(authorization)?.[1] || '') : (req.headers.cookie || "")
        .split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith("medify_session="))
        ?.slice(15);
      if (raw)
        req.user = (
          await pool.query(
            "SELECT a.* FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=$1 AND s.expires_at>now()",
            [hashToken(raw)],
          )
        ).rows[0];
      req.sessionToken = raw;
      next();
    }),
  );
  const publicUser = (u) =>
    u
      ? {
          uid: u.id,
          email: u.email,
          // When verification is not required, report every account as verified
          // so the app never asks for an email that cannot be delivered.
          emailVerified: u.email_verified || !records.emailRequired(),
          emailVerificationRequired: records.emailRequired(),
          role: u.role,
        }
      : null;
  const requireUser = (req) => {
    if (!req.user) fail(401, "Sign in required");
    return req.user;
  };
  async function tx(fn) {
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      const value = await fn(db);
      await db.query("COMMIT");
      return value;
    } catch (e) {
      await db.query("ROLLBACK");
      throw e;
    } finally {
      db.release();
    }
  }
  async function session(res, user, db=pool) {
    const token = crypto.randomBytes(32).toString("hex");
    await db.query(
      "INSERT INTO sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '7 days')",
      [hashToken(token), user.id],
    );
    res.set("Set-Cookie", `medify_session=${token}; ${cookie}; Max-Age=604800`);
    // Limit simultaneous devices per student account (admins are exempt).
    const maxDevices = Math.max(1, Number(process.env.MAX_DEVICES || 2));
    if (user.role !== "admin")
      try {
        await db.query(
          "DELETE FROM sessions WHERE account_id=$1 AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE account_id=$1 ORDER BY created_at DESC LIMIT $2)",
          [user.id, maxDevices],
        );
      } catch (e) {
        console.error("Device limit not applied (run npm run migrate):", e.message);
      }
    return token;
  }
  async function throttle(key, max = 20) {
    const r = await pool.query(
      "INSERT INTO rate_limits(key,count,expires_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires_at<now() THEN 1 ELSE rate_limits.count+1 END,expires_at=CASE WHEN rate_limits.expires_at<now() THEN now()+interval '15 minutes' ELSE rate_limits.expires_at END RETURNING count",
      [key],
    );
    if (r.rows[0].count > max)
      fail(429, "Too many attempts. Try again in 15 minutes.");
  }
  async function mailToken(user, kind) {
    if (!sendMail)
      fail(503, "Email delivery is not configured. Contact the administrator.");
    const token = crypto.randomBytes(32).toString("hex");
    await pool.query(
      "INSERT INTO auth_tokens(token_hash,account_id,kind,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
      [hashToken(token), user.id, kind],
    );
    const url = new URL(
      "/auth/action",
      process.env.STUDENT_URL || "http://localhost:3000",
    );
    url.searchParams.set("kind", kind);
    url.searchParams.set("token", token);
    try {
      await sendMail({
        to: user.email,
        subject:
          kind === "reset"
            ? "Reset your MEDIFY password"
            : "Verify your MEDIFY email",
        text: `Open this link within one hour: ${url.href}\nIf you did not request this, ignore this email.`,
      });
    } catch (e) {
      await pool.query("DELETE FROM auth_tokens WHERE token_hash=$1", [
        hashToken(token),
      ]);
      fail(503, "Email could not be delivered. Contact the administrator.");
    }
  }
  app.get(
    "/api/health",
    asyncRoute(async (req, res) => {
      await pool.query("SELECT 1");
      res.json({ status: "ok", database: "postgresql" });
    }),
  );
  app.get(
    "/api/healthz",
    asyncRoute(async (req, res) => {
      await pool.query("SELECT 1");
      res.json({ status: "ok", database: "postgresql" });
    }),
  );
  app.get("/api/auth/me", (req, res) =>
    res.json({ user: publicUser(req.user) }),
  );
  const proofs=require('./payment-proof').proofTools();
  require('./payment-proof').installProofRoutes(app,pool,proofs,tx);
  app.get('/api/registration/options',asyncRoute(async(req,res)=>res.json({planPrices:await require('./coupons').planPrices(pool)})));
  app.post('/api/registration/quote',asyncRoute(async(req,res)=>{
    await throttle('signup-coupon:'+req.ip,20);
    const r=await require('./coupons').evaluate(pool,{code:req.body.code,planId:req.body.planId,yearId:req.body.yearId,userId:'signup-preview'});
    res.json({code:r.coupon.code,finalAmount:r.finalAmount,discountAmount:r.discountAmount,listPrice:r.listPrice});
  }));
  app.post(
    "/api/auth/register",
    asyncRoute(async(req,res,next)=>{await throttle("register:"+req.ip,10);next();}),
    proofs.receive,
    asyncRoute(async (req, res) => {
      try {
      if (!(await require("./library").settings(pool)).registrationOpen)
        fail(403, "New registrations are currently closed");

      const email = String(req.body.email || "")
        .trim()
        .toLowerCase();
      validatePassword(req.body.password);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
        fail(400, "Invalid email");
      const proof=await proofs.validate(req.file);
      const checkout=req.body.checkout===true||req.body.checkout==='true';
      const profile=req.body;
      if(checkout && (!String(profile.fullName||'').trim() || !String(profile.yearId||'').trim()))fail(400,'Enter your full name and academic year.');
      const id = crypto.randomUUID();
      const hash = await passwordHash(req.body.password);
      const result = await tx(async (db) => {
        let u;
        try {
          u = (
            await db.query(
              "INSERT INTO accounts(id,email,password_hash) VALUES($1,$2,$3) ON CONFLICT(email) DO NOTHING RETURNING *",
              [id, email, hash],
            )
          ).rows[0];
        } catch (e) {

          throw e;
        }
        if(!u)fail(409,'Email already registered. Sign in to continue your application.');
        await db.query(
          "INSERT INTO records(collection,id,data) VALUES('users',$1,$2)",
          [
            id,
            {
              email,
              approvalStatus: "PENDING",
              paymentStatus: "UNPAID",
              createdAt: { seconds: Math.floor(Date.now() / 1000) },
            },
          ],
        );
        let paymentId=null;
        if(checkout){
          const year=await records.get(db,'years',profile.yearId);
          if(!year?.published)fail(400,'Select an available academic year.');
          const clean=v=>String(v||'').trim().slice(0,200);
          await records.write(db,u,{collection:'users',id,data:{fullName:clean(profile.fullName),college:clean(profile.college),academicYear:year.name,selectedYearId:profile.yearId,selectedYearName:year.name,curriculum:clean(profile.curriculum)||'KMU',selectedPlanId:profile.planId,selectedPlanName:clean(profile.planName)}});
          const method=profile.method||'jazzcash';
          const reference=clean(profile.transactionId)||('FREE-'+crypto.randomUUID());
          paymentId=method+'_'+reference;
          await records.write(db,u,{collection:'paymentRequests',id:paymentId,data:{...profile,method,transactionId:reference,userName:clean(profile.fullName),yearName:year.name}});
          const payment=await records.get(db,'paymentRequests',paymentId);
          if(payment.amountPKR>0 && (!proof || !clean(profile.transactionId)))fail(400,'Upload payment proof and enter the transaction ID.');
          await proofs.attach(db,paymentId,proof);
          await db.query("UPDATE records SET data=data || $2::jsonb WHERE collection='users' AND id=$1",[id,{planPrice:payment.amountPKR}]);
        } else if(proof)fail(400,'Payment proof requires registration payment details.');
        const token=await session(res,u,db);
        return {u,token,paymentId};
      });
      let verificationWarning=null;
      if(checkout&&records.emailRequired())try{await mailToken(result.u,'verify');}catch(e){verificationWarning=e.message;}
      res.status(201).json({ user: publicUser(result.u),sessionToken:result.token,paymentId:result.paymentId,verificationWarning });
      }catch(e){await proofs.cleanup(req);throw e;}
    }),
  );
  app.post(
    "/api/auth/login",
    asyncRoute(async (req, res) => {
      await throttle("login:" + req.ip);
      const email = String(req.body.email || "")
        .trim()
        .toLowerCase();
      await throttle("email:" + hashToken(email));
      if (
        typeof req.body.password !== "string" ||
        req.body.password.length > 256
      )
        fail(400, "Invalid credentials");
      const u = (
        await pool.query("SELECT * FROM accounts WHERE email=$1", [email])
      ).rows[0];
      if (!u || !(await passwordMatches(req.body.password, u.password_hash)))
        fail(401, "Incorrect email or password");
      const sessionToken=await session(res, u);
      res.json({ user: publicUser(u),sessionToken });
    }),
  );
  app.post(
    "/api/auth/logout",
    asyncRoute(async (req, res) => {
      if (req.sessionToken)
        await pool.query("DELETE FROM sessions WHERE token_hash=$1", [
          hashToken(req.sessionToken),
        ]);
      res.set("Set-Cookie", `medify_session=; ${cookie}; Max-Age=0`);
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/auth/verify-request",
    asyncRoute(async (req, res) => {
      const u = requireUser(req);
      await throttle("verify:" + u.id, 5);
      if (!u.email_verified) await mailToken(u, "verify");
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/auth/reset-request",
    asyncRoute(async (req, res) => {
      await throttle("reset:" + req.ip, 5);
      if (!sendMail)
        fail(
          503,
          "Email delivery is not configured. Contact the administrator.",
        );
      const u = (
        await pool.query("SELECT * FROM accounts WHERE email=$1", [
          String(req.body.email || "")
            .trim()
            .toLowerCase(),
        ])
      ).rows[0];
      if (u) await mailToken(u, "reset");
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/auth/action",
    asyncRoute(async (req, res) => {
      await throttle("action:" + req.ip);
      const { token, kind, password } = req.body;
      if (!["verify", "reset"].includes(kind) || typeof token !== "string")
        fail(400, "Invalid action");
      if (kind === "reset") validatePassword(password);
      await tx(async (db) => {
        const t = (
          await db.query(
            "DELETE FROM auth_tokens WHERE token_hash=$1 AND kind=$2 AND expires_at>now() RETURNING account_id",
            [hashToken(token), kind],
          )
        ).rows[0];
        if (!t) fail(400, "Link is invalid or expired");
        if (kind === "verify")
          await db.query(
            "UPDATE accounts SET email_verified=true WHERE id=$1",
            [t.account_id],
          );
        else {
          await db.query("UPDATE accounts SET password_hash=$2 WHERE id=$1", [
            t.account_id,
            await passwordHash(password),
          ]);
          await db.query("DELETE FROM sessions WHERE account_id=$1", [
            t.account_id,
          ]);
          await db.query(
            "DELETE FROM auth_tokens WHERE account_id=$1 AND kind='reset'",
            [t.account_id],
          );
        }
      });
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/data/read",
    asyncRoute(async (req, res) => {
      const { collection: c, id } = records.ref(req.body);
      if (!id) fail(400, "ID required");
      const data = await records.get(pool, c, id);
      if (!data) return res.json({ id, data: null });
      if (!(await records.readable(pool, req.user, c, id, data)))
        fail(403, "Access denied");
      res.json({ id, data: c === "users" ? records.decorateUser(data) : data });
    }),
  );
  app.post(
    "/api/data/query",
    asyncRoute(async (req, res) => {
      const { collection: c, filters = [] } = records.ref(req.body);
      if (!Array.isArray(filters) || filters.length > 10)
        fail(400, "Invalid filters");
      if (
        ["subjectContent", "subjectParts", "chapterContent"].includes(c) &&
        req.user?.role !== "admin"
      )
        fail(403, "Use a specific content ID");
      if (c === "users" && req.user?.role !== "admin")
        fail(403, "Administrator required");
      if (c === "paymentRequests" && !req.user) fail(401, "Sign in required");
      const params = [c];
      let sql = "SELECT id,data FROM records WHERE collection=$1";
      if (c === "paymentRequests" && req.user.role !== "admin") {
        params.push(req.user.id);
        sql += ` AND data->>'userId'=$${params.length}`;
      }
      for (const f of filters) {
        if (f.sort) continue;
        if (f.op !== "==" || typeof f.field !== "string")
          fail(400, "Unsupported filter");
        params.push(f.field, JSON.stringify(f.value));
        sql += ` AND data->($${params.length - 1}::text)=$${params.length}::jsonb`;
      }
      const rows = (await pool.query(sql, params)).rows;
      const result = [];
      for (const row of rows)
        if (await records.readable(pool, req.user, c, row.id, row.data))
          result.push(row);
      for (const f of filters.filter((f) => f.sort)) {
        result.sort((a, b) => {
          let x = a.data[f.sort],
            y = b.data[f.sort];
          x = x?.seconds ?? x;
          y = y?.seconds ?? y;
          return (
            (x < y ? -1 : x > y ? 1 : 0) * (f.direction === "desc" ? -1 : 1)
          );
        });
      }
      res.json(result);
    }),
  );
  app.post(
    "/api/data/write",
    asyncRoute(async (req, res) => {
      await tx((db) => records.write(db, req.user, req.body));
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/data/batch",
    asyncRoute(async (req, res) => {
      if (req.user?.role !== "admin") fail(403, "Administrator required");
      const { ops } = req.body;
      if (!Array.isArray(ops) || ops.length > 400)
        fail(400, "Maximum 400 operations");
      await tx(async (db) => {
        for (const op of ops) await records.write(db, req.user, op);
      });
      res.json({ ok: true });
    }),
  );
  require("./admin-content").installAdminContent(app, pool);
  require("./library").installLibrary(app, pool);
  require("./notes").installNotes(app, pool);
  require("./coupons").installCoupons(app, pool);
  require("./inbox").installInbox(app, pool);
  require("./registrations").installRegistrations(app,pool);
  app.use((req, res) => res.status(404).json({ error: "Route not found" }));
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) console.error("Request failed:", err.message);
    res
      .status(status)
      .json({
        error:
          status >= 500 && status !== 503
            ? "Server error. Check server logs."
            : err.message,
      });
  });
  return app;
}
module.exports = { createApp };
