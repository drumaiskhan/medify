import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Users,
  Clock,
  Layers,
  ArrowUpRight,
  Upload,
  Settings,
} from "lucide-react";
import { api } from "../lib/client";
export function OverviewPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/admin/overview")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <div className="studio-heading">
        <div>
          <div className="studio-eyebrow">YOUR TEACHING SPACE</div>
          <h1>Welcome to your workspace</h1>
          <p>A clear view of your library, students, and what's next.</p>
        </div>
        <Link className="studio-btn primary" to="/books">
          <Upload /> Add a book
        </Link>
      </div>
      {error && (
        <div role="alert" className="studio-alert">
          {error}
        </div>
      )}
      <div className="studio-grid">
        {[
          {
            name: "Students",
            value: data?.users,
            icon: Users,
            to: "/students",
            note: "Registered accounts",
          },
          {
            name: "Books",
            value: data?.books,
            icon: BookOpen,
            to: "/books",
            note: "Your growing library",
          },
          {
            name: "Pending registrations",
            value: data?.pendingRegistrations,
            icon: Clock,
            to: "/students",
            note: "Awaiting account approval",
          },
          {
            name: "Subjects",
            value:
              data?.counts?.find((c: any) => c.collection === "subjects")
                ?.count || 0,
            icon: Layers,
            to: "/notes",
            note: "Organised study notes",
          },
        ].map(({ name, value, icon: Icon, to, note }) => (
          <Link to={to} className="studio-card" key={name}>
            <div
              className="studio-actions"
              style={{ justifyContent: "space-between" }}
            >
              <Icon size={20} color="#137c72" />
              <ArrowUpRight size={16} color="#8a9c9d" />
            </div>
            <div className="studio-stat">{data ? value : "—"}</div>
            <strong style={{ fontSize: 12 }}>{name}</strong>
            <p className="studio-small" style={{ marginTop: 5 }}>
              {note}
            </p>
          </Link>
        ))}
      </div>
      <div className="studio-banner">
        <div>
          <div className="studio-eyebrow">BUILD A BETTER STUDY EXPERIENCE</div>
          <h2>Good resources. One calm place.</h2>
          <p className="studio-muted">
            Add a cover, choose a year, and let students pick up where they left
            off.
          </p>
        </div>
        <Link className="studio-btn" to="/books">
          Manage library <ArrowUpRight />
        </Link>
      </div>
      <div className="studio-form">
        <section className="studio-card">
          <h2 style={{ fontWeight: 750 }}>Recently added</h2>
          {data?.recent?.length ? (
            data.recent.map((b: any, i: number) => (
              <div className="studio-row" key={i}>
                <div className="studio-actions">
                  <BookOpen size={18} />
                  <span style={{ fontSize: 13 }}>{b.title}</span>
                </div>
                <span className="studio-small">
                  {new Date(b.created_at).toLocaleDateString()}
                </span>
              </div>
            ))
          ) : (
            <div className="studio-empty">
              <BookOpen />
              <h3>Your next chapter starts here</h3>
              <p>Add your first PDF to build the library.</p>
            </div>
          )}
        </section>
        <section className="studio-card">
          <h2 style={{ fontWeight: 750 }}>Quick actions</h2>
          {[
            {
              to: "/notes",
              label: "Upload subject notes",
              text: "Import a Word document into your curriculum.",
              icon: Upload,
            },
            {
              to: "/students",
              label: "Review student approvals",
              text: "Verify manual payments and grant access.",
              icon: Users,
            },
            {
              to: "/settings",
              label: "Make it yours",
              text: "Branding, announcements and reader preferences.",
              icon: Settings,
            },
          ].map(({ to, label, text, icon: Icon }) => (
            <Link className="studio-row" to={to} key={to}>
              <Icon size={20} />
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: 13 }}>{label}</strong>
                <p className="studio-small">{text}</p>
              </div>
              <ArrowUpRight size={16} />
            </Link>
          ))}
        </section>
      </div>
    </>
  );
}
