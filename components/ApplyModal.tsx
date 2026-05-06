"use client";
import { useState } from "react";

const LEVELS = [
  "Byrjandi — lítil eða engin reynsla",
  "Nokkur reynsla — hef æft af og til",
  "Lengra kominn — æfi reglulega",
];

export default function ApplyModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    goals: "",
    level: "",
    injuries: "",
    schedule: "",
    referral: "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Villa");
      setDone(true);
    } catch {
      setError("Eitthvað fór úrskeiðis. Reyndu aftur eða sendu tölvupóst á rafn@360heilsa.is");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg relative"
        style={{
          background: "var(--background)",
          border: "1px solid var(--border)",
          padding: "48px 40px",
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-5 right-6 text-xl"
          style={{ color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}
        >
          ✕
        </button>

        {done ? (
          <div className="text-center py-8">
            <p className="display mb-4" style={{ fontSize: "2.5rem", color: "var(--accent)" }}>
              TAKK!
            </p>
            <p style={{ color: "var(--foreground)" }}>
              Umsókn móttekin. Ég mun hafa samband fljótlega.
            </p>
            <button onClick={onClose} className="btn-primary mt-8">
              LOKA
            </button>
          </div>
        ) : (
          <>
            {/* Progress */}
            <div className="flex gap-2 mb-8">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  style={{
                    height: "2px",
                    flex: 1,
                    background: s <= step ? "var(--accent)" : "var(--border)",
                    transition: "background 0.3s",
                  }}
                />
              ))}
            </div>

            {step === 1 && (
              <div>
                <p className="display mb-6" style={{ fontSize: "1.8rem", color: "var(--foreground)" }}>
                  GRUNNUPPLÝSINGAR
                </p>
                <div className="space-y-4">
                  <Field label="Nafn *" value={form.name} onChange={(v) => set("name", v)} placeholder="Fullt nafn" />
                  <Field label="Netfang *" value={form.email} onChange={(v) => set("email", v)} placeholder="þitt@netfang.is" type="email" />
                  <Field label="Sími" value={form.phone} onChange={(v) => set("phone", v)} placeholder="+354 xxx xxxx" type="tel" />
                </div>
                <button
                  className="btn-primary mt-8 w-full text-center"
                  onClick={() => setStep(2)}
                  disabled={!form.name || !form.email}
                >
                  ÁFRAM →
                </button>
              </div>
            )}

            {step === 2 && (
              <div>
                <p className="display mb-6" style={{ fontSize: "1.8rem", color: "var(--foreground)" }}>
                  BAKGRUNNUR
                </p>
                <div className="space-y-4">
                  <Textarea
                    label="Hverjar eru þínar áherslur? *"
                    value={form.goals}
                    onChange={(v) => set("goals", v)}
                    placeholder="Uppbygging, styrkur, líðan, heilsa..."
                  />
                  <div>
                    <p className="text-xs mb-2" style={{ color: "var(--muted)", letterSpacing: "0.1em" }}>
                      ÞJÁLFUNARSTAÐA *
                    </p>
                    <div className="space-y-2">
                      {LEVELS.map((l) => (
                        <label
                          key={l}
                          className="flex items-center gap-3 text-sm cursor-pointer"
                          style={{ color: "var(--foreground)" }}
                        >
                          <input
                            type="radio"
                            name="level"
                            value={l}
                            checked={form.level === l}
                            onChange={() => set("level", l)}
                            style={{ accentColor: "var(--accent)" }}
                          />
                          {l}
                        </label>
                      ))}
                    </div>
                  </div>
                  <Textarea
                    label="Meiðsli eða líkamlegar takmarkanir"
                    value={form.injuries}
                    onChange={(v) => set("injuries", v)}
                    placeholder="Ef við á — annars skilið eftir autt"
                  />
                </div>
                <div className="flex gap-4 mt-8">
                  <button className="btn-outline" onClick={() => setStep(1)}>← TIL BAKA</button>
                  <button
                    className="btn-primary flex-1 text-center"
                    onClick={() => setStep(3)}
                    disabled={!form.goals || !form.level}
                  >
                    ÁFRAM →
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <p className="display mb-6" style={{ fontSize: "1.8rem", color: "var(--foreground)" }}>
                  SKIPULAG
                </p>
                <div className="space-y-4">
                  <Textarea
                    label="Hvenær hentar þér að æfa? *"
                    value={form.schedule}
                    onChange={(v) => set("schedule", v)}
                    placeholder="t.d. Mánudagar og miðvikudagar á morgnana kl. 7-9, föstudagar síðdegis..."
                  />
                  <Field
                    label="Hvar heyrðir þú af Rafni/360 Heilsu?"
                    value={form.referral}
                    onChange={(v) => set("referral", v)}
                    placeholder="Vin, samfélagsmiðlum, leit..."
                  />
                </div>
                {error && (
                  <p className="mt-4 text-sm" style={{ color: "#e55" }}>{error}</p>
                )}
                <div className="flex gap-4 mt-8">
                  <button className="btn-outline" onClick={() => setStep(2)}>← TIL BAKA</button>
                  <button
                    className="btn-primary flex-1 text-center"
                    onClick={submit}
                    disabled={loading || !form.schedule}
                  >
                    {loading ? "SENDI..." : "SENDA UMSÓKN"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <p className="text-xs mb-1" style={{ color: "var(--muted)", letterSpacing: "0.1em" }}>
        {label.toUpperCase()}
      </p>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 text-sm"
        style={{
          background: "#1a1a18",
          border: "1px solid var(--border)",
          color: "var(--foreground)",
          outline: "none",
        }}
      />
    </div>
  );
}

function Textarea({
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <p className="text-xs mb-1" style={{ color: "var(--muted)", letterSpacing: "0.1em" }}>
        {label.toUpperCase()}
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full px-4 py-3 text-sm resize-none"
        style={{
          background: "#1a1a18",
          border: "1px solid var(--border)",
          color: "var(--foreground)",
          outline: "none",
        }}
      />
    </div>
  );
}
